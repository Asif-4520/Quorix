use std::collections::HashMap;

use sqlx::{Row, SqlitePool};

use super::overview::{
    list_schema_objects, list_schemas, read_columns_for_table, read_table_list_flags,
};
use crate::drivers::{DatabaseError, quote_identifier};
use crate::models::{
    ConstraintInfo, ForeignKeyInfo, IndexInfo, SchemaIntrospection, TableDetailsResponse,
    TableInfo, TableStatistics, TriggerInfo,
};

pub async fn get_table_details(
    pool: &SqlitePool,
    table: &str,
    _schema: Option<&str>,
) -> Result<TableDetailsResponse, DatabaseError> {
    let master_row = sqlx::query(
        "SELECT name, type, sql FROM sqlite_schema WHERE type IN ('table', 'view') AND name = ?",
    )
    .bind(table)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| DatabaseError::InvalidValue(format!("Table '{table}' not found")))?;

    let kind: String = master_row.try_get("type")?;
    let ddl: String = master_row
        .try_get::<Option<String>, _>("sql")
        .ok()
        .flatten()
        .unwrap_or_default();

    let flags = read_table_list_flags(pool).await;
    let (is_strict, without_rowid) = flags.get(table).copied().unwrap_or((false, false));

    let columns = read_columns_for_table(pool, table).await?;
    let pk_cols: Vec<String> = columns
        .iter()
        .filter(|c| c.primary_key)
        .map(|c| c.name.clone())
        .collect();

    let qt = quote_identifier(table)?;

    let mut indexes = Vec::new();
    let idx_list_sql = format!("PRAGMA index_list({qt})");
    if let Ok(idx_rows) = sqlx::query(&idx_list_sql).fetch_all(pool).await {
        for ir in idx_rows {
            let idx_name: String = ir.try_get("name").unwrap_or_default();
            let is_unique = ir.try_get::<i64, _>("unique").unwrap_or(0) == 1;
            let origin: String = ir.try_get("origin").unwrap_or_default();
            let is_partial = ir.try_get::<i64, _>("partial").unwrap_or(0) == 1;
            let is_pk = origin == "pk";

            let mut idx_cols = Vec::new();
            if let Ok(qi) = quote_identifier(&idx_name) {
                let xinfo_sql = format!("PRAGMA index_xinfo({qi})");
                if let Ok(info_rows) = sqlx::query(&xinfo_sql).fetch_all(pool).await {
                    for r in info_rows {
                        let is_key = r.try_get::<i64, _>("key").unwrap_or(0) == 1;
                        if is_key {
                            if let Ok(Some(col_name)) = r.try_get::<Option<String>, _>("name") {
                                idx_cols.push(col_name);
                            } else {
                                idx_cols.push("<expr>".to_string());
                            }
                        }
                    }
                }
            }

            let idx_def: Option<String> = sqlx::query_scalar(
                "SELECT sql FROM sqlite_schema WHERE type = 'index' AND name = ?",
            )
            .bind(&idx_name)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

            indexes.push(IndexInfo {
                name: idx_name,
                schema: Some("main".to_string()),
                table_name: table.to_string(),
                columns: idx_cols,
                is_unique,
                is_primary: is_pk,
                index_type: Some("btree".to_string()),
                is_partial,
                predicate: None,
                definition: idx_def,
            });
        }
    }

    let mut foreign_keys = Vec::new();
    let mut constraints = Vec::new();

    if !pk_cols.is_empty() {
        constraints.push(ConstraintInfo {
            name: format!("{table}_pkey"),
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
                definition: idx
                    .definition
                    .clone()
                    .unwrap_or_else(|| format!("UNIQUE ({})", idx.columns.join(", "))),
                referenced_table: None,
                referenced_columns: Vec::new(),
            });
        }
    }

    let fk_sql = format!("PRAGMA foreign_key_list({qt})");
    if let Ok(fk_rows) = sqlx::query(&fk_sql).fetch_all(pool).await {
        for fk in fk_rows {
            if let (Ok(to_table), Ok(from_col), Ok(to_col)) = (
                fk.try_get::<String, _>("table"),
                fk.try_get::<String, _>("from"),
                fk.try_get::<String, _>("to"),
            ) {
                let on_update: Option<String> = fk.try_get("on_update").ok();
                let on_delete: Option<String> = fk.try_get("on_delete").ok();
                let fk_id: i64 = fk.try_get("id").unwrap_or(0);
                constraints.push(ConstraintInfo {
                    name: format!("fk_{table}_{fk_id}_{from_col}"),
                    constraint_type: "FOREIGN KEY".to_string(),
                    columns: vec![from_col.clone()],
                    definition: format!(
                        "FOREIGN KEY ({from_col}) REFERENCES {to_table}({to_col}) ON DELETE {} ON UPDATE {}",
                        on_delete.as_deref().unwrap_or("NO ACTION"),
                        on_update.as_deref().unwrap_or("NO ACTION")
                    ),
                    referenced_table: Some(to_table.clone()),
                    referenced_columns: vec![to_col.clone()],
                });
                foreign_keys.push(ForeignKeyInfo {
                    name: Some(format!("fk_{fk_id}")),
                    from_schema: Some("main".to_string()),
                    from_table: table.to_string(),
                    from_column: from_col,
                    to_schema: Some("main".to_string()),
                    to_table,
                    to_column: to_col,
                    on_update,
                    on_delete,
                    direction: "outgoing".to_string(),
                });
            }
        }
    }

    if let Ok(other_tables) = sqlx::query_scalar::<_, String>(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(pool)
    .await
    {
        for other in other_tables {
            if let Ok(qo) = quote_identifier(&other) {
                let other_fk_sql = format!("PRAGMA foreign_key_list({qo})");
                if let Ok(rows) = sqlx::query(&other_fk_sql).fetch_all(pool).await {
                    for fk in rows {
                        let target: String = fk.try_get("table").unwrap_or_default();
                        if target == table {
                            foreign_keys.push(ForeignKeyInfo {
                                name: None,
                                from_schema: Some("main".to_string()),
                                from_table: other.clone(),
                                from_column: fk.try_get("from").unwrap_or_default(),
                                to_schema: Some("main".to_string()),
                                to_table: table.to_string(),
                                to_column: fk.try_get("to").unwrap_or_default(),
                                on_update: fk.try_get("on_update").ok(),
                                on_delete: fk.try_get("on_delete").ok(),
                                direction: "incoming".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    let trig_rows = sqlx::query(
        "SELECT name, tbl_name, sql FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = ? ORDER BY name",
    )
    .bind(table)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let triggers: Vec<TriggerInfo> = trig_rows
        .into_iter()
        .map(|r| TriggerInfo {
            name: r.try_get("name").unwrap_or_default(),
            table_name: r.try_get("tbl_name").unwrap_or_default(),
            event: "TRIGGER".to_string(),
            timing: "EVENT".to_string(),
            definition: r.try_get("sql").ok().flatten(),
        })
        .collect();

    let count_sql = format!("SELECT COUNT(*) FROM {qt}");
    let exact_count: Option<i64> = sqlx::query_scalar(&count_sql).fetch_one(pool).await.ok();

    let uses_rowid = kind == "table" && pk_cols.is_empty() && !without_rowid;
    let editable = kind == "table" && (!pk_cols.is_empty() || uses_rowid);
    let readonly_reason = if kind != "table" {
        Some("Views are read-only".to_string())
    } else if !editable {
        Some("WITHOUT ROWID table lacks a primary key".to_string())
    } else {
        None
    };

    let info = TableInfo {
        name: table.to_string(),
        schema: Some("main".to_string()),
        kind,
        row_count_estimate: exact_count,
        comment: None,
        has_primary_key: !pk_cols.is_empty(),
        is_strict,
        without_rowid,
    };

    Ok(TableDetailsResponse {
        table: info,
        columns,
        indexes,
        constraints,
        foreign_keys,
        triggers,
        statistics: TableStatistics {
            row_count_estimate: exact_count,
            exact_row_count: exact_count,
            table_size_bytes: None,
            indexes_size_bytes: None,
            total_size_bytes: None,
            table_size_pretty: None,
            indexes_size_pretty: None,
            total_size_pretty: None,
            last_vacuum: None,
            last_analyze: None,
        },
        ddl,
        editable,
        readonly_reason,
        primary_key_columns: pk_cols,
        uses_rowid,
    })
}

pub async fn introspect_schema(pool: &SqlitePool) -> Result<SchemaIntrospection, DatabaseError> {
    let objs = list_schema_objects(pool, "main").await?;
    let mut all_tables = objs.tables.clone();
    all_tables.extend(objs.views.clone());

    let mut columns_map = HashMap::new();
    let mut indexes = Vec::new();
    let mut foreign_keys = Vec::new();

    for t in &all_tables {
        if let Ok(cols) = read_columns_for_table(pool, &t.name).await {
            columns_map.insert(format!("main.{}", t.name), cols);
        }
        if t.kind == "table" {
            let qt = quote_identifier(&t.name)?;
            if let Ok(fk_rows) = sqlx::query(&format!("PRAGMA foreign_key_list({qt})"))
                .fetch_all(pool)
                .await
            {
                for fk in fk_rows {
                    if let (Ok(to_table), Ok(from_col), Ok(to_col)) = (
                        fk.try_get::<String, _>("table"),
                        fk.try_get::<String, _>("from"),
                        fk.try_get::<String, _>("to"),
                    ) {
                        foreign_keys.push(ForeignKeyInfo {
                            name: None,
                            from_schema: Some("main".to_string()),
                            from_table: t.name.clone(),
                            from_column: from_col,
                            to_schema: Some("main".to_string()),
                            to_table,
                            to_column: to_col,
                            on_update: fk.try_get("on_update").ok(),
                            on_delete: fk.try_get("on_delete").ok(),
                            direction: "outgoing".to_string(),
                        });
                    }
                }
            }
            if let Ok(idx_rows) = sqlx::query(&format!("PRAGMA index_list({qt})"))
                .fetch_all(pool)
                .await
            {
                for ir in idx_rows {
                    if let Ok(idx_name) = ir.try_get::<String, _>("name") {
                        let is_unique = ir.try_get::<i64, _>("unique").unwrap_or(0) == 1;
                        let origin: String = ir.try_get("origin").unwrap_or_default();
                        let mut idx_cols = Vec::new();
                        if let Ok(qi) = quote_identifier(&idx_name) {
                            if let Ok(info_rows) = sqlx::query(&format!("PRAGMA index_xinfo({qi})"))
                                .fetch_all(pool)
                                .await
                            {
                                for r in info_rows {
                                    if r.try_get::<i64, _>("key").unwrap_or(0) == 1 {
                                        if let Ok(Some(cn)) = r.try_get::<Option<String>, _>("name")
                                        {
                                            idx_cols.push(cn);
                                        }
                                    }
                                }
                            }
                        }
                        indexes.push(IndexInfo {
                            name: idx_name,
                            schema: Some("main".to_string()),
                            table_name: t.name.clone(),
                            columns: idx_cols,
                            is_unique,
                            is_primary: origin == "pk",
                            index_type: Some("btree".to_string()),
                            is_partial: ir.try_get::<i64, _>("partial").unwrap_or(0) == 1,
                            predicate: None,
                            definition: None,
                        });
                    }
                }
            }
        }
    }

    let schemas = list_schemas(pool).await?;

    Ok(SchemaIntrospection {
        schemas,
        tables: all_tables,
        columns: columns_map,
        indexes,
        foreign_keys,
        triggers: objs.triggers,
        functions: Vec::new(),
        sequences: Vec::new(),
        enum_types: Vec::new(),
        extensions: Vec::new(),
    })
}
