use sqlx::{PgPool, Row};

use crate::drivers::DatabaseError;
use crate::models::{
    ColumnInfo, ConnectionSummary, DatabaseInfo, DatabaseOverviewResponse, EnumTypeInfo,
    ExtensionInfo, FunctionInfo, SchemaInfo, SchemaObjectsResponse, SequenceInfo, TableInfo,
    TriggerInfo,
};

pub async fn database_overview(
    pool: &PgPool,
    summary: &ConnectionSummary,
) -> Result<DatabaseOverviewResponse, DatabaseError> {
    let db_rows = sqlx::query(
        "SELECT d.datname AS name,
                pg_catalog.pg_get_userbyid(d.datdba) AS owner,
                pg_catalog.pg_encoding_to_char(d.encoding) AS encoding,
                CASE WHEN pg_catalog.has_database_privilege(d.datname, 'CONNECT')
                     THEN pg_catalog.pg_database_size(d.datname)
                     ELSE NULL END AS size_bytes,
                CASE WHEN pg_catalog.has_database_privilege(d.datname, 'CONNECT')
                     THEN pg_catalog.pg_size_pretty(pg_catalog.pg_database_size(d.datname))
                     ELSE NULL END AS size_pretty
         FROM pg_catalog.pg_database d
         WHERE NOT d.datistemplate
         ORDER BY d.datname",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let databases = db_rows
        .into_iter()
        .map(|r| DatabaseInfo {
            name: r.try_get("name").unwrap_or_default(),
            owner: r.try_get("owner").ok(),
            encoding: r.try_get("encoding").ok(),
            size_bytes: r.try_get("size_bytes").ok().flatten(),
            size_pretty: r.try_get("size_pretty").ok().flatten(),
        })
        .collect();

    let schemas = list_schemas(pool).await?;

    let ext_rows = sqlx::query(
        "SELECT e.extname AS name,
                e.extversion AS version,
                n.nspname AS schema,
                pg_catalog.obj_description(e.oid, 'pg_extension') AS description
         FROM pg_catalog.pg_extension e
         JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
         ORDER BY e.extname",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let extensions = ext_rows
        .into_iter()
        .map(|r| ExtensionInfo {
            name: r.try_get("name").unwrap_or_default(),
            version: r.try_get("version").unwrap_or_default(),
            schema: r.try_get("schema").ok(),
            description: r.try_get("description").ok().flatten(),
        })
        .collect();

    Ok(DatabaseOverviewResponse {
        summary: summary.clone(),
        databases,
        schemas,
        extensions,
    })
}

pub async fn list_schemas(pool: &PgPool) -> Result<Vec<SchemaInfo>, DatabaseError> {
    let rows = sqlx::query(
        "SELECT n.nspname AS name,
                pg_catalog.pg_get_userbyid(n.nspowner) AS owner,
                (n.nspname IN ('pg_catalog', 'information_schema') OR n.nspname LIKE 'pg_%') AS is_system,
                COALESCE(SUM(CASE WHEN c.relkind IN ('r', 'p', 'f') THEN 1 ELSE 0 END), 0)::bigint AS table_count,
                COALESCE(SUM(CASE WHEN c.relkind IN ('v', 'm') THEN 1 ELSE 0 END), 0)::bigint AS view_count
         FROM pg_catalog.pg_namespace n
         LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid
         WHERE n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
         GROUP BY n.nspname, n.nspowner
         ORDER BY is_system, n.nspname",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| SchemaInfo {
            name: r.try_get("name").unwrap_or_default(),
            owner: r.try_get("owner").ok(),
            is_system: r.try_get("is_system").unwrap_or(false),
            table_count: r.try_get("table_count").unwrap_or(0),
            view_count: r.try_get("view_count").unwrap_or(0),
        })
        .collect())
}

pub async fn list_schema_objects(
    pool: &PgPool,
    schema: &str,
) -> Result<SchemaObjectsResponse, DatabaseError> {
    let rel_rows = sqlx::query(
        "SELECT c.relname AS name,
                n.nspname AS schema,
                c.relkind::text AS relkind,
                GREATEST(c.reltuples, 0)::bigint AS row_count_estimate,
                pg_catalog.obj_description(c.oid, 'pg_class') AS comment,
                EXISTS (
                    SELECT 1 FROM pg_catalog.pg_constraint con
                    WHERE con.conrelid = c.oid AND con.contype = 'p'
                ) AS has_primary_key
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1
           AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
         ORDER BY c.relname",
    )
    .bind(schema)
    .fetch_all(pool)
    .await?;

    let mut tables = Vec::new();
    let mut views = Vec::new();
    let mut materialized_views = Vec::new();

    for r in rel_rows {
        let relkind: String = r.try_get("relkind").unwrap_or_else(|_| "r".to_string());
        let kind = match relkind.as_str() {
            "v" => "view",
            "m" => "materialized_view",
            "p" => "partitioned_table",
            "f" => "foreign_table",
            _ => "table",
        };
        let info = TableInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: Some(schema.to_string()),
            kind: kind.to_string(),
            row_count_estimate: r.try_get("row_count_estimate").ok(),
            comment: r.try_get("comment").ok().flatten(),
            has_primary_key: r.try_get("has_primary_key").unwrap_or(false),
            is_strict: false,
            without_rowid: false,
        };
        match kind {
            "view" => views.push(info),
            "materialized_view" => materialized_views.push(info),
            _ => tables.push(info),
        }
    }

    let func_rows = sqlx::query(
        "SELECT p.proname AS name,
                n.nspname AS schema,
                CASE WHEN p.prokind = 'p' THEN 'procedure' ELSE 'function' END AS kind,
                COALESCE(pg_catalog.pg_get_function_result(p.oid), 'void') AS return_type,
                pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
                l.lanname AS language,
                pg_catalog.pg_get_functiondef(p.oid) AS definition
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_catalog.pg_language l ON l.oid = p.prolang
         WHERE n.nspname = $1 AND p.prokind IN ('f', 'p')
         ORDER BY p.proname",
    )
    .bind(schema)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let functions = func_rows
        .into_iter()
        .map(|r| FunctionInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: Some(schema.to_string()),
            kind: r.try_get("kind").unwrap_or_else(|_| "function".to_string()),
            return_type: r
                .try_get("return_type")
                .unwrap_or_else(|_| "void".to_string()),
            arguments: r.try_get("arguments").unwrap_or_default(),
            language: r.try_get("language").ok(),
            definition: r.try_get("definition").ok().flatten(),
        })
        .collect();

    let seq_rows = sqlx::query(
        "SELECT c.relname AS name,
                n.nspname AS schema,
                pg_catalog.format_type(s.seqtypid, NULL) AS data_type,
                s.seqstart AS start_value,
                s.seqincrement AS increment_by,
                s.seqmin AS min_value,
                s.seqmax AS max_value
         FROM pg_catalog.pg_sequence s
         JOIN pg_catalog.pg_class c ON c.oid = s.seqrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1
         ORDER BY c.relname",
    )
    .bind(schema)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let sequences = seq_rows
        .into_iter()
        .map(|r| SequenceInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: Some(schema.to_string()),
            data_type: r
                .try_get("data_type")
                .unwrap_or_else(|_| "bigint".to_string()),
            start_value: r.try_get("start_value").ok(),
            increment_by: r.try_get("increment_by").ok(),
            min_value: r.try_get("min_value").ok(),
            max_value: r.try_get("max_value").ok(),
            last_value: None,
        })
        .collect();

    let enum_rows = sqlx::query(
        "SELECT t.typname AS name,
                n.nspname AS schema,
                array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
         FROM pg_catalog.pg_type t
         JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
         JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
         WHERE n.nspname = $1 AND t.typtype = 'e'
         GROUP BY t.typname, n.nspname
         ORDER BY t.typname",
    )
    .bind(schema)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let enum_types = enum_rows
        .into_iter()
        .map(|r| EnumTypeInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: Some(schema.to_string()),
            values: r.try_get::<Vec<String>, _>("values").unwrap_or_default(),
        })
        .collect();

    let trig_rows = sqlx::query(
        "SELECT tg.tgname AS name,
                c.relname AS table_name,
                pg_catalog.pg_get_triggerdef(tg.oid, true) AS definition
         FROM pg_catalog.pg_trigger tg
         JOIN pg_catalog.pg_class c ON c.oid = tg.tgrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND NOT tg.tgisinternal
         ORDER BY c.relname, tg.tgname",
    )
    .bind(schema)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let triggers = trig_rows
        .into_iter()
        .map(|r| TriggerInfo {
            name: r.try_get("name").unwrap_or_default(),
            table_name: r.try_get("table_name").unwrap_or_default(),
            event: "TRIGGER".to_string(),
            timing: "SQL".to_string(),
            definition: r.try_get("definition").ok(),
        })
        .collect();

    Ok(SchemaObjectsResponse {
        schema: schema.to_string(),
        tables,
        views,
        materialized_views,
        functions,
        sequences,
        enum_types,
        triggers,
    })
}

pub(super) async fn read_pg_columns(
    pool: &PgPool,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnInfo>, DatabaseError> {
    let rows = sqlx::query(
        "SELECT a.attname AS name,
                pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
                CASE WHEN tn.nspname NOT IN ('pg_catalog', 'public')
                     THEN tn.nspname || '.' || t.typname
                     ELSE t.typname END AS udt_name,
                NOT a.attnotnull AS nullable,
                a.attnum::int AS ordinal_position,
                pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_value,
                (a.attidentity <> '') AS is_identity,
                (a.attgenerated <> '') AS is_generated,
                pg_catalog.col_description(c.oid, a.attnum) AS comment,
                EXISTS (
                    SELECT 1 FROM pg_catalog.pg_constraint con
                    WHERE con.conrelid = c.oid
                      AND con.contype = 'p'
                      AND a.attnum = ANY(con.conkey)
                ) AS primary_key,
                EXISTS (
                    SELECT 1 FROM pg_catalog.pg_constraint con
                    WHERE con.conrelid = c.oid
                      AND con.contype = 'u'
                      AND array_length(con.conkey, 1) = 1
                      AND con.conkey[1] = a.attnum
                ) AS is_unique,
                COALESCE(
                    (SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
                     FROM pg_catalog.pg_enum e
                     WHERE e.enumtypid = a.atttypid),
                    ARRAY[]::text[]
                ) AS enum_values
         FROM pg_catalog.pg_attribute a
         JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
         JOIN pg_catalog.pg_namespace tn ON tn.oid = t.typnamespace
         LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE n.nspname = $1
           AND c.relname = $2
           AND a.attnum > 0
           AND NOT a.attisdropped
         ORDER BY a.attnum",
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let is_identity: bool = r.try_get("is_identity").unwrap_or(false);
            let is_generated: bool = r.try_get("is_generated").unwrap_or(false);
            let default_value: Option<String> = r.try_get("default_value").ok().flatten();
            let auto_increment = is_identity
                || default_value
                    .as_deref()
                    .map(|d| d.to_ascii_lowercase().contains("nextval("))
                    .unwrap_or(false);
            ColumnInfo {
                name: r.try_get("name").unwrap_or_default(),
                data_type: r
                    .try_get("data_type")
                    .unwrap_or_else(|_| "text".to_string()),
                udt_name: r.try_get("udt_name").ok(),
                nullable: r.try_get("nullable").unwrap_or(true),
                primary_key: r.try_get("primary_key").unwrap_or(false),
                is_unique: r.try_get("is_unique").unwrap_or(false),
                is_identity,
                is_generated,
                generation_expression: if is_generated {
                    default_value.clone()
                } else {
                    None
                },
                auto_increment,
                default_value: if is_generated { None } else { default_value },
                ordinal_position: r.try_get("ordinal_position").unwrap_or(0),
                comment: r.try_get("comment").ok().flatten(),
                enum_values: r
                    .try_get::<Vec<String>, _>("enum_values")
                    .unwrap_or_default(),
            }
        })
        .collect())
}
