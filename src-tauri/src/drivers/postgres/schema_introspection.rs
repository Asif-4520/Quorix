use std::collections::HashMap;

use sqlx::{PgPool, Row};

use super::overview::list_schemas;
use crate::drivers::DatabaseError;
use crate::models::{
    ColumnInfo, ForeignKeyInfo, FunctionInfo, IndexInfo, SchemaIntrospection, SequenceInfo,
    TableInfo,
};

pub async fn introspect_schema(pool: &PgPool) -> Result<SchemaIntrospection, DatabaseError> {
    let schemas = list_schemas(pool).await?;

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
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
           AND n.nspname NOT LIKE 'pg_%'
           AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
         ORDER BY n.nspname, c.relname",
    )
    .fetch_all(pool)
    .await?;

    let tables: Vec<TableInfo> = rel_rows
        .into_iter()
        .map(|r| {
            let relkind: String = r.try_get("relkind").unwrap_or_else(|_| "r".to_string());
            let kind = match relkind.as_str() {
                "v" => "view",
                "m" => "materialized_view",
                "p" => "partitioned_table",
                "f" => "foreign_table",
                _ => "table",
            };
            TableInfo {
                name: r.try_get("name").unwrap_or_default(),
                schema: r.try_get("schema").ok(),
                kind: kind.to_string(),
                row_count_estimate: r.try_get("row_count_estimate").ok(),
                comment: r.try_get("comment").ok().flatten(),
                has_primary_key: r.try_get("has_primary_key").unwrap_or(false),
                is_strict: false,
                without_rowid: false,
            }
        })
        .collect();

    let col_rows = sqlx::query(
        "SELECT n.nspname AS schema,
                c.relname AS table_name,
                a.attname AS name,
                pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
                t.typname AS udt_name,
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
                ) AS primary_key
         FROM pg_catalog.pg_attribute a
         JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
         LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
           AND n.nspname NOT LIKE 'pg_%'
           AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
           AND a.attnum > 0
           AND NOT a.attisdropped
         ORDER BY n.nspname, c.relname, a.attnum",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut columns_map: HashMap<String, Vec<ColumnInfo>> = HashMap::new();
    for r in col_rows {
        let schema_name: String = r.try_get("schema").unwrap_or_else(|_| "public".to_string());
        let table_name: String = r.try_get("table_name").unwrap_or_default();
        let default_value: Option<String> = r.try_get("default_value").ok().flatten();
        let is_identity: bool = r.try_get("is_identity").unwrap_or(false);
        let is_generated: bool = r.try_get("is_generated").unwrap_or(false);
        let auto_increment = is_identity
            || default_value
                .as_deref()
                .map(|d| d.to_ascii_lowercase().contains("nextval("))
                .unwrap_or(false);

        columns_map
            .entry(format!("{schema_name}.{table_name}"))
            .or_default()
            .push(ColumnInfo {
                name: r.try_get("name").unwrap_or_default(),
                data_type: r
                    .try_get("data_type")
                    .unwrap_or_else(|_| "text".to_string()),
                udt_name: r.try_get("udt_name").ok(),
                nullable: r.try_get("nullable").unwrap_or(true),
                primary_key: r.try_get("primary_key").unwrap_or(false),
                is_unique: false,
                is_identity,
                is_generated,
                generation_expression: None,
                auto_increment,
                default_value,
                ordinal_position: r.try_get("ordinal_position").unwrap_or(0),
                comment: r.try_get("comment").ok().flatten(),
                enum_values: Vec::new(),
            });
    }

    let fk_rows = sqlx::query(
        "SELECT con.conname AS name,
                fn.nspname AS from_schema,
                fc.relname AS from_table,
                fa.attname AS from_column,
                tn.nspname AS to_schema,
                tc.relname AS to_table,
                ta.attname AS to_column,
                CASE con.confupdtype
                    WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                    WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                    WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION'
                END AS on_update,
                CASE con.confdeltype
                    WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                    WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                    WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION'
                END AS on_delete
         FROM pg_catalog.pg_constraint con
         JOIN pg_catalog.pg_class fc ON fc.oid = con.conrelid
         JOIN pg_catalog.pg_namespace fn ON fn.oid = fc.relnamespace
         JOIN pg_catalog.pg_class tc ON tc.oid = con.confrelid
         JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
         JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS cols(from_att, to_att, ord) ON true
         JOIN pg_catalog.pg_attribute fa ON fa.attrelid = fc.oid AND fa.attnum = cols.from_att
         JOIN pg_catalog.pg_attribute ta ON ta.attrelid = tc.oid AND ta.attnum = cols.to_att
         WHERE con.contype = 'f'
           AND fn.nspname NOT IN ('pg_catalog', 'information_schema')
         ORDER BY fn.nspname, fc.relname, con.conname, cols.ord",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let foreign_keys = fk_rows
        .into_iter()
        .map(|r| ForeignKeyInfo {
            name: r.try_get("name").ok(),
            from_schema: r.try_get("from_schema").ok(),
            from_table: r.try_get("from_table").unwrap_or_default(),
            from_column: r.try_get("from_column").unwrap_or_default(),
            to_schema: r.try_get("to_schema").ok(),
            to_table: r.try_get("to_table").unwrap_or_default(),
            to_column: r.try_get("to_column").unwrap_or_default(),
            on_update: r.try_get("on_update").ok(),
            on_delete: r.try_get("on_delete").ok(),
            direction: "outgoing".to_string(),
        })
        .collect();

    let idx_rows = sqlx::query(
        "SELECT n.nspname AS schema,
                c.relname AS table_name,
                ic.relname AS name,
                am.amname AS index_type,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary,
                (ix.indpred IS NOT NULL) AS is_partial,
                pg_catalog.pg_get_indexdef(ic.oid) AS definition,
                ARRAY(
                    SELECT COALESCE(a.attname, '<expr>')
                    FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
                    LEFT JOIN pg_catalog.pg_attribute a
                      ON a.attrelid = c.oid AND a.attnum = k.attnum
                    ORDER BY k.ord
                ) AS columns
         FROM pg_catalog.pg_index ix
         JOIN pg_catalog.pg_class c ON c.oid = ix.indrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_class ic ON ic.oid = ix.indexrelid
         JOIN pg_catalog.pg_am am ON am.oid = ic.relam
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
           AND n.nspname NOT LIKE 'pg_%'
         ORDER BY n.nspname, c.relname, ic.relname",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let indexes = idx_rows
        .into_iter()
        .map(|r| IndexInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: r.try_get("schema").ok(),
            table_name: r.try_get("table_name").unwrap_or_default(),
            columns: r.try_get::<Vec<String>, _>("columns").unwrap_or_default(),
            is_unique: r.try_get("is_unique").unwrap_or(false),
            is_primary: r.try_get("is_primary").unwrap_or(false),
            index_type: r.try_get("index_type").ok(),
            is_partial: r.try_get("is_partial").unwrap_or(false),
            predicate: None,
            definition: r.try_get("definition").ok(),
        })
        .collect();

    let func_rows = sqlx::query(
        "SELECT p.proname AS name,
                n.nspname AS schema,
                CASE WHEN p.prokind = 'p' THEN 'procedure' ELSE 'function' END AS kind,
                COALESCE(pg_catalog.pg_get_function_result(p.oid), 'void') AS return_type,
                pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
                l.lanname AS language
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_catalog.pg_language l ON l.oid = p.prolang
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
           AND n.nspname NOT LIKE 'pg_%'
           AND p.prokind IN ('f', 'p')
         ORDER BY n.nspname, p.proname",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let functions = func_rows
        .into_iter()
        .map(|r| FunctionInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: r.try_get("schema").ok(),
            kind: r.try_get("kind").unwrap_or_else(|_| "function".to_string()),
            return_type: r
                .try_get("return_type")
                .unwrap_or_else(|_| "void".to_string()),
            arguments: r.try_get("arguments").unwrap_or_default(),
            language: r.try_get("language").ok(),
            definition: None,
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
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
           AND n.nspname NOT LIKE 'pg_%'
         ORDER BY n.nspname, c.relname",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let sequences = seq_rows
        .into_iter()
        .map(|r| SequenceInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: r.try_get("schema").ok(),
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

    Ok(SchemaIntrospection {
        schemas,
        tables,
        columns: columns_map,
        indexes,
        foreign_keys,
        triggers: Vec::new(),
        functions,
        sequences,
        enum_types: Vec::new(),
        extensions: Vec::new(),
    })
}
