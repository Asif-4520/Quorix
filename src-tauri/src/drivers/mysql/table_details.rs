use std::collections::HashMap;

use sqlx::{MySqlPool, Row};

use super::overview::{
    qualify_mysql_table, quote_mysql_ident, read_mysql_columns, resolve_schema_name,
};
use crate::drivers::{DatabaseError, sqlite::format_bytes};
use crate::models::{
    ConstraintInfo, ForeignKeyInfo, IndexInfo, TableDetailsResponse, TableInfo, TableStatistics,
    TriggerInfo,
};

pub async fn get_table_details(
    pool: &MySqlPool,
    table: &str,
    schema: Option<&str>,
) -> Result<TableDetailsResponse, DatabaseError> {
    let schema_name = resolve_schema_name(pool, schema).await?;

    let tbl_row = sqlx::query(
        "SELECT CAST(TABLE_NAME AS CHAR) AS name,
                CAST(TABLE_TYPE AS CHAR) AS table_type,
                CAST(TABLE_ROWS AS SIGNED) AS row_count_estimate,
                CAST(DATA_LENGTH AS SIGNED) AS data_length,
                CAST(INDEX_LENGTH AS SIGNED) AS index_length,
                CAST(TABLE_COMMENT AS CHAR) AS comment_text
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
    )
    .bind(&schema_name)
    .bind(table)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        DatabaseError::InvalidValue(format!("Table '{schema_name}.{table}' not found"))
    })?;

    let table_type: String = tbl_row.try_get("table_type").unwrap_or_default();
    let is_view = table_type.eq_ignore_ascii_case("VIEW");
    let kind = if is_view { "view" } else { "table" };
    let row_est: Option<i64> = tbl_row.try_get("row_count_estimate").ok();
    let data_bytes: Option<i64> = tbl_row.try_get("data_length").ok();
    let index_bytes: Option<i64> = tbl_row.try_get("index_length").ok();
    let total_bytes = match (data_bytes, index_bytes) {
        (Some(d), Some(i)) => Some(d.saturating_add(i)),
        (Some(d), None) => Some(d),
        _ => None,
    };
    let comment: Option<String> = tbl_row
        .try_get::<Option<String>, _>("comment_text")
        .ok()
        .flatten()
        .filter(|s| !s.trim().is_empty());

    let columns = read_mysql_columns(pool, &schema_name, table).await?;
    let pk_cols: Vec<String> = columns
        .iter()
        .filter(|c| c.primary_key)
        .map(|c| c.name.clone())
        .collect();

    let idx_rows = sqlx::query(
        "SELECT CAST(INDEX_NAME AS CHAR) AS name,
                CAST(NON_UNIQUE AS SIGNED) AS non_unique,
                CAST(COLUMN_NAME AS CHAR) AS col_name,
                CAST(INDEX_TYPE AS CHAR) AS idx_type
         FROM information_schema.statistics
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY INDEX_NAME, SEQ_IN_INDEX",
    )
    .bind(&schema_name)
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut idx_map: HashMap<String, (bool, Option<String>, Vec<String>)> = HashMap::new();
    let mut idx_order: Vec<String> = Vec::new();
    for r in idx_rows {
        let name: String = r.try_get("name").unwrap_or_default();
        let non_unique: i64 = r.try_get("non_unique").unwrap_or(1);
        let col_name: Option<String> = r.try_get("col_name").ok().flatten();
        let idx_type: Option<String> = r.try_get("idx_type").ok().flatten();
        let entry = idx_map.entry(name.clone()).or_insert_with(|| {
            idx_order.push(name.clone());
            (non_unique == 0, idx_type, Vec::new())
        });
        if let Some(c) = col_name {
            entry.2.push(c);
        }
    }

    let indexes: Vec<IndexInfo> = idx_order
        .into_iter()
        .filter_map(|name| {
            idx_map.remove(&name).map(|(is_unique, idx_type, cols)| {
                let is_primary = name == "PRIMARY";
                let qt = quote_mysql_ident(table).unwrap_or_else(|_| table.to_string());
                let def = if is_primary {
                    format!("PRIMARY KEY ({})", cols.join(", "))
                } else {
                    format!(
                        "CREATE {}INDEX {} ON {qt} ({})",
                        if is_unique { "UNIQUE " } else { "" },
                        name,
                        cols.join(", ")
                    )
                };
                IndexInfo {
                    name,
                    schema: Some(schema_name.clone()),
                    table_name: table.to_string(),
                    columns: cols,
                    is_unique,
                    is_primary,
                    index_type: idx_type,
                    is_partial: false,
                    predicate: None,
                    definition: Some(def),
                }
            })
        })
        .collect();

    let mut constraints = Vec::new();
    let mut foreign_keys = Vec::new();

    if !pk_cols.is_empty() {
        constraints.push(ConstraintInfo {
            name: "PRIMARY".to_string(),
            constraint_type: "PRIMARY KEY".to_string(),
            columns: pk_cols.clone(),
            definition: format!("PRIMARY KEY ({})", pk_cols.join(", ")),
            referenced_table: None,
            referenced_columns: Vec::new(),
        });
    }

    for idx in &indexes {
        if idx.is_unique && !idx.is_primary {
            constraints.push(ConstraintInfo {
                name: idx.name.clone(),
                constraint_type: "UNIQUE".to_string(),
                columns: idx.columns.clone(),
                definition: format!("UNIQUE KEY `{}` ({})", idx.name, idx.columns.join(", ")),
                referenced_table: None,
                referenced_columns: Vec::new(),
            });
        }
    }

    let fk_out_rows = sqlx::query(
        "SELECT CAST(kcu.CONSTRAINT_NAME AS CHAR) AS name,
                CAST(kcu.COLUMN_NAME AS CHAR) AS from_col,
                CAST(kcu.REFERENCED_TABLE_SCHEMA AS CHAR) AS to_schema,
                CAST(kcu.REFERENCED_TABLE_NAME AS CHAR) AS to_table,
                CAST(kcu.REFERENCED_COLUMN_NAME AS CHAR) AS to_col,
                CAST(rc.UPDATE_RULE AS CHAR) AS on_update,
                CAST(rc.DELETE_RULE AS CHAR) AS on_delete
         FROM information_schema.key_column_usage kcu
         LEFT JOIN information_schema.referential_constraints rc
           ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
          AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
         WHERE kcu.TABLE_SCHEMA = ?
           AND kcu.TABLE_NAME = ?
           AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
         ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION",
    )
    .bind(&schema_name)
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for r in fk_out_rows {
        let name: String = r.try_get("name").unwrap_or_default();
        let from_col: String = r.try_get("from_col").unwrap_or_default();
        let to_schema: Option<String> = r.try_get("to_schema").ok().flatten();
        let to_table: String = r.try_get("to_table").unwrap_or_default();
        let to_col: String = r.try_get("to_col").unwrap_or_default();
        let on_update: Option<String> = r.try_get("on_update").ok().flatten();
        let on_delete: Option<String> = r.try_get("on_delete").ok().flatten();

        constraints.push(ConstraintInfo {
            name: name.clone(),
            constraint_type: "FOREIGN KEY".to_string(),
            columns: vec![from_col.clone()],
            definition: format!(
                "FOREIGN KEY (`{from_col}`) REFERENCES `{to_table}`(`{to_col}`) ON DELETE {} ON UPDATE {}",
                on_delete.as_deref().unwrap_or("RESTRICT"),
                on_update.as_deref().unwrap_or("RESTRICT")
            ),
            referenced_table: Some(to_table.clone()),
            referenced_columns: vec![to_col.clone()],
        });

        foreign_keys.push(ForeignKeyInfo {
            name: Some(name),
            from_schema: Some(schema_name.clone()),
            from_table: table.to_string(),
            from_column: from_col,
            to_schema,
            to_table,
            to_column: to_col,
            on_update,
            on_delete,
            direction: "outgoing".to_string(),
        });
    }

    let fk_in_rows = sqlx::query(
        "SELECT CAST(kcu.CONSTRAINT_NAME AS CHAR) AS name,
                CAST(kcu.TABLE_SCHEMA AS CHAR) AS from_schema,
                CAST(kcu.TABLE_NAME AS CHAR) AS from_table,
                CAST(kcu.COLUMN_NAME AS CHAR) AS from_col,
                CAST(kcu.REFERENCED_COLUMN_NAME AS CHAR) AS to_col,
                CAST(rc.UPDATE_RULE AS CHAR) AS on_update,
                CAST(rc.DELETE_RULE AS CHAR) AS on_delete
         FROM information_schema.key_column_usage kcu
         LEFT JOIN information_schema.referential_constraints rc
           ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
          AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
         WHERE kcu.REFERENCED_TABLE_SCHEMA = ?
           AND kcu.REFERENCED_TABLE_NAME = ?
         ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME",
    )
    .bind(&schema_name)
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for r in fk_in_rows {
        foreign_keys.push(ForeignKeyInfo {
            name: r.try_get("name").ok(),
            from_schema: r.try_get("from_schema").ok().flatten(),
            from_table: r.try_get("from_table").unwrap_or_default(),
            from_column: r.try_get("from_col").unwrap_or_default(),
            to_schema: Some(schema_name.clone()),
            to_table: table.to_string(),
            to_column: r.try_get("to_col").unwrap_or_default(),
            on_update: r.try_get("on_update").ok().flatten(),
            on_delete: r.try_get("on_delete").ok().flatten(),
            direction: "incoming".to_string(),
        });
    }

    let trig_rows = sqlx::query(
        "SELECT CAST(TRIGGER_NAME AS CHAR) AS name,
                CAST(EVENT_OBJECT_TABLE AS CHAR) AS table_name,
                CAST(EVENT_MANIPULATION AS CHAR) AS event_name,
                CAST(ACTION_TIMING AS CHAR) AS timing,
                CAST(ACTION_STATEMENT AS CHAR) AS definition
         FROM information_schema.triggers
         WHERE TRIGGER_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?
         ORDER BY TRIGGER_NAME",
    )
    .bind(&schema_name)
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let triggers: Vec<TriggerInfo> = trig_rows
        .into_iter()
        .map(|r| TriggerInfo {
            name: r.try_get("name").unwrap_or_default(),
            table_name: r.try_get("table_name").unwrap_or_default(),
            event: r
                .try_get("event_name")
                .unwrap_or_else(|_| "TRIGGER".to_string()),
            timing: r.try_get("timing").unwrap_or_else(|_| "BEFORE".to_string()),
            definition: r.try_get("definition").ok().flatten(),
        })
        .collect();

    let qt = qualify_mysql_table(Some(&schema_name), table)?;
    let show_create_sql = format!("SHOW CREATE TABLE {qt}");
    let ddl = sqlx::query(&show_create_sql)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<String, _>(1).ok())
        .unwrap_or_default();

    let editable = !is_view && !pk_cols.is_empty();
    let readonly_reason = if is_view {
        Some("Views are read-only".to_string())
    } else if pk_cols.is_empty() {
        Some("Table has no primary key for safe row-level updates".to_string())
    } else {
        None
    };

    Ok(TableDetailsResponse {
        table: TableInfo {
            name: table.to_string(),
            schema: Some(schema_name),
            kind: kind.to_string(),
            row_count_estimate: row_est,
            comment,
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
            table_size_bytes: data_bytes,
            indexes_size_bytes: index_bytes,
            total_size_bytes: total_bytes,
            table_size_pretty: data_bytes.map(format_bytes),
            indexes_size_pretty: index_bytes.map(format_bytes),
            total_size_pretty: total_bytes.map(format_bytes),
            last_vacuum: None,
            last_analyze: None,
        },
        ddl,
        editable,
        readonly_reason,
        primary_key_columns: pk_cols,
        uses_rowid: false,
    })
}
