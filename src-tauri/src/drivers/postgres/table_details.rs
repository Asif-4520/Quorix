use sqlx::{PgPool, Row};

use super::overview::read_pg_columns;
use crate::drivers::{DatabaseError, qualify_table, quote_identifier};
use crate::models::{
    ColumnInfo, ConstraintInfo, ForeignKeyInfo, IndexInfo, TableDetailsResponse, TableInfo,
    TableStatistics, TriggerInfo,
};

pub async fn get_table_details(
    pool: &PgPool,
    table: &str,
    schema: Option<&str>,
) -> Result<TableDetailsResponse, DatabaseError> {
    let schema_name = schema.filter(|s| !s.trim().is_empty()).unwrap_or("public");

    let rel_row = sqlx::query(
        "SELECT c.oid::bigint AS oid,
                c.relkind::text AS relkind,
                GREATEST(c.reltuples, 0)::bigint AS row_count_estimate,
                pg_catalog.obj_description(c.oid, 'pg_class') AS comment,
                pg_catalog.pg_relation_size(c.oid)::bigint AS table_size_bytes,
                pg_catalog.pg_indexes_size(c.oid)::bigint AS indexes_size_bytes,
                pg_catalog.pg_total_relation_size(c.oid)::bigint AS total_size_bytes,
                pg_catalog.pg_size_pretty(pg_catalog.pg_relation_size(c.oid)) AS table_size_pretty,
                pg_catalog.pg_size_pretty(pg_catalog.pg_indexes_size(c.oid)) AS indexes_size_pretty,
                pg_catalog.pg_size_pretty(pg_catalog.pg_total_relation_size(c.oid)) AS total_size_pretty
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relname = $2",
    )
    .bind(schema_name)
    .bind(table)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        DatabaseError::InvalidValue(format!("Relation '{schema_name}.{table}' not found"))
    })?;

    let relkind: String = rel_row
        .try_get("relkind")
        .unwrap_or_else(|_| "r".to_string());
    let kind = match relkind.as_str() {
        "v" => "view",
        "m" => "materialized_view",
        "p" => "partitioned_table",
        "f" => "foreign_table",
        _ => "table",
    };
    let table_comment: Option<String> = rel_row.try_get("comment").ok().flatten();
    let row_est: Option<i64> = rel_row.try_get("row_count_estimate").ok();

    let columns = read_pg_columns(pool, schema_name, table).await?;
    let pk_cols: Vec<String> = columns
        .iter()
        .filter(|c| c.primary_key)
        .map(|c| c.name.clone())
        .collect();

    let idx_rows = sqlx::query(
        "SELECT ic.relname AS name,
                am.amname AS index_type,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary,
                (ix.indpred IS NOT NULL) AS is_partial,
                pg_catalog.pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
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
         WHERE n.nspname = $1 AND c.relname = $2
         ORDER BY ix.indisprimary DESC, ic.relname",
    )
    .bind(schema_name)
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let indexes: Vec<IndexInfo> = idx_rows
        .into_iter()
        .map(|r| IndexInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: Some(schema_name.to_string()),
            table_name: table.to_string(),
            columns: r.try_get::<Vec<String>, _>("columns").unwrap_or_default(),
            is_unique: r.try_get("is_unique").unwrap_or(false),
            is_primary: r.try_get("is_primary").unwrap_or(false),
            index_type: r.try_get("index_type").ok(),
            is_partial: r.try_get("is_partial").unwrap_or(false),
            predicate: r.try_get("predicate").ok().flatten(),
            definition: r.try_get("definition").ok(),
        })
        .collect();

    let con_rows = sqlx::query(
        "SELECT con.conname AS name,
                CASE con.contype
                    WHEN 'p' THEN 'PRIMARY KEY'
                    WHEN 'f' THEN 'FOREIGN KEY'
                    WHEN 'u' THEN 'UNIQUE'
                    WHEN 'c' THEN 'CHECK'
                    WHEN 'x' THEN 'EXCLUSION'
                    ELSE con.contype::text
                END AS constraint_type,
                pg_catalog.pg_get_constraintdef(con.oid, true) AS definition,
                ARRAY(
                    SELECT a.attname
                    FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_catalog.pg_attribute a
                      ON a.attrelid = con.conrelid AND a.attnum = k.attnum
                    ORDER BY k.ord
                ) AS columns,
                CASE WHEN con.confrelid <> 0
                     THEN rn.nspname || '.' || rc.relname
                     ELSE NULL END AS referenced_table,
                CASE WHEN con.confrelid <> 0
                     THEN ARRAY(
                         SELECT ra.attname
                         FROM unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord)
                         JOIN pg_catalog.pg_attribute ra
                           ON ra.attrelid = con.confrelid AND ra.attnum = fk.attnum
                         ORDER BY fk.ord
                     )
                     ELSE ARRAY[]::text[] END AS referenced_columns
         FROM pg_catalog.pg_constraint con
         JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_catalog.pg_class rc ON rc.oid = con.confrelid
         LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid = rc.relnamespace
         WHERE n.nspname = $1 AND c.relname = $2
         ORDER BY con.contype, con.conname",
    )
    .bind(schema_name)
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let constraints: Vec<ConstraintInfo> = con_rows
        .into_iter()
        .map(|r| ConstraintInfo {
            name: r.try_get("name").unwrap_or_default(),
            constraint_type: r.try_get("constraint_type").unwrap_or_default(),
            columns: r.try_get::<Vec<String>, _>("columns").unwrap_or_default(),
            definition: r.try_get("definition").unwrap_or_default(),
            referenced_table: r.try_get("referenced_table").ok().flatten(),
            referenced_columns: r
                .try_get::<Vec<String>, _>("referenced_columns")
                .unwrap_or_default(),
        })
        .collect();

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
                END AS on_delete,
                CASE WHEN fn.nspname = $1 AND fc.relname = $2 THEN 'outgoing' ELSE 'incoming' END AS direction
         FROM pg_catalog.pg_constraint con
         JOIN pg_catalog.pg_class fc ON fc.oid = con.conrelid
         JOIN pg_catalog.pg_namespace fn ON fn.oid = fc.relnamespace
         JOIN pg_catalog.pg_class tc ON tc.oid = con.confrelid
         JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
         JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS cols(from_att, to_att, ord) ON true
         JOIN pg_catalog.pg_attribute fa ON fa.attrelid = fc.oid AND fa.attnum = cols.from_att
         JOIN pg_catalog.pg_attribute ta ON ta.attrelid = tc.oid AND ta.attnum = cols.to_att
         WHERE con.contype = 'f'
           AND ((fn.nspname = $1 AND fc.relname = $2) OR (tn.nspname = $1 AND tc.relname = $2))
         ORDER BY direction DESC, con.conname, cols.ord",
    )
    .bind(schema_name)
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
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
            direction: r
                .try_get("direction")
                .unwrap_or_else(|_| "outgoing".to_string()),
        })
        .collect();

    let trig_rows = sqlx::query(
        "SELECT tg.tgname AS name,
                c.relname AS table_name,
                pg_catalog.pg_get_triggerdef(tg.oid, true) AS definition
         FROM pg_catalog.pg_trigger tg
         JOIN pg_catalog.pg_class c ON c.oid = tg.tgrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relname = $2 AND NOT tg.tgisinternal
         ORDER BY tg.tgname",
    )
    .bind(schema_name)
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let triggers: Vec<TriggerInfo> = trig_rows
        .into_iter()
        .map(|r| TriggerInfo {
            name: r.try_get("name").unwrap_or_default(),
            table_name: r.try_get("table_name").unwrap_or_default(),
            event: "TRIGGER".to_string(),
            timing: "SQL".to_string(),
            definition: r.try_get("definition").ok(),
        })
        .collect();

    let stat_row = sqlx::query(
        "SELECT COALESCE(last_vacuum, last_autovacuum)::text AS last_vacuum,
                COALESCE(last_analyze, last_autoanalyze)::text AS last_analyze
         FROM pg_catalog.pg_stat_all_tables
         WHERE schemaname = $1 AND relname = $2",
    )
    .bind(schema_name)
    .bind(table)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let ddl = if kind == "view" || kind == "materialized_view" {
        let view_def: Option<String> = sqlx::query_scalar(
            "SELECT pg_catalog.pg_get_viewdef(c.oid, true)
             FROM pg_catalog.pg_class c
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = $1 AND c.relname = $2",
        )
        .bind(schema_name)
        .bind(table)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();
        let kw = if kind == "materialized_view" {
            "MATERIALIZED VIEW"
        } else {
            "VIEW"
        };
        format!(
            "CREATE {kw} {} AS\n{};",
            qualify_table(Some(schema_name), table)?,
            view_def.unwrap_or_default().trim()
        )
    } else {
        reconstruct_pg_table_ddl(
            schema_name,
            table,
            table_comment.as_deref(),
            &columns,
            &constraints,
            &indexes,
        )?
    };

    let editable = (kind == "table" || kind == "partitioned_table") && !pk_cols.is_empty();
    let readonly_reason = if kind == "view" || kind == "materialized_view" {
        Some("Views and materialized views are read-only".to_string())
    } else if pk_cols.is_empty() {
        Some("Table has no primary key; inline editing disabled for safety".to_string())
    } else {
        None
    };

    Ok(TableDetailsResponse {
        table: TableInfo {
            name: table.to_string(),
            schema: Some(schema_name.to_string()),
            kind: kind.to_string(),
            row_count_estimate: row_est,
            comment: table_comment,
            has_primary_key: !pk_cols.is_empty(),
            is_strict: false,
            without_rowid: false,
        },
        columns,
        indexes,
        constraints,
        foreign_keys,
        triggers,
        statistics: TableStatistics {
            row_count_estimate: row_est,
            exact_row_count: None,
            table_size_bytes: rel_row.try_get("table_size_bytes").ok(),
            indexes_size_bytes: rel_row.try_get("indexes_size_bytes").ok(),
            total_size_bytes: rel_row.try_get("total_size_bytes").ok(),
            table_size_pretty: rel_row.try_get("table_size_pretty").ok(),
            indexes_size_pretty: rel_row.try_get("indexes_size_pretty").ok(),
            total_size_pretty: rel_row.try_get("total_size_pretty").ok(),
            last_vacuum: stat_row
                .as_ref()
                .and_then(|r| r.try_get("last_vacuum").ok().flatten()),
            last_analyze: stat_row
                .as_ref()
                .and_then(|r| r.try_get("last_analyze").ok().flatten()),
        },
        ddl,
        editable,
        readonly_reason,
        primary_key_columns: pk_cols,
        uses_rowid: false,
    })
}

fn reconstruct_pg_table_ddl(
    schema: &str,
    table: &str,
    table_comment: Option<&str>,
    columns: &[ColumnInfo],
    constraints: &[ConstraintInfo],
    indexes: &[IndexInfo],
) -> Result<String, DatabaseError> {
    let q_rel = qualify_table(Some(schema), table)?;
    let mut lines: Vec<String> = Vec::new();

    for col in columns {
        let q_col = quote_identifier(&col.name)?;
        let mut line = format!("  {q_col} {}", col.data_type);
        if col.is_identity {
            line.push_str(" GENERATED BY DEFAULT AS IDENTITY");
        } else if col.is_generated {
            if let Some(ref expr) = col.generation_expression {
                line.push_str(&format!(" GENERATED ALWAYS AS ({expr}) STORED"));
            }
        } else if let Some(ref def) = col.default_value {
            line.push_str(&format!(" DEFAULT {def}"));
        }
        if !col.nullable {
            line.push_str(" NOT NULL");
        }
        lines.push(line);
    }

    for con in constraints {
        let q_con = quote_identifier(&con.name)?;
        lines.push(format!("  CONSTRAINT {q_con} {}", con.definition));
    }

    let mut ddl = format!("CREATE TABLE {q_rel} (\n{}\n);", lines.join(",\n"));

    for idx in indexes.iter().filter(|i| !i.is_primary) {
        if let Some(ref def) = idx.definition {
            ddl.push_str(&format!("\n\n{def};"));
        }
    }

    if let Some(comment) = table_comment {
        ddl.push_str(&format!(
            "\n\nCOMMENT ON TABLE {q_rel} IS '{}';",
            comment.replace('\'', "''")
        ));
    }
    for col in columns {
        if let Some(ref comment) = col.comment {
            let q_col = quote_identifier(&col.name)?;
            ddl.push_str(&format!(
                "\nCOMMENT ON COLUMN {q_rel}.{q_col} IS '{}';",
                comment.replace('\'', "''")
            ));
        }
    }

    Ok(ddl)
}
