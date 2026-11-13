use std::collections::HashMap;
use std::path::Path;

use sqlx::{Row, SqlitePool};

use super::maintenance::format_bytes;
use crate::drivers::{DatabaseError, quote_identifier};
use crate::models::{
    ColumnInfo, ConnectionSummary, DatabaseInfo, DatabaseOverviewResponse, SchemaInfo,
    SchemaObjectsResponse, TableInfo, TriggerInfo,
};

pub async fn database_overview(
    pool: &SqlitePool,
    summary: &ConnectionSummary,
) -> Result<DatabaseOverviewResponse, DatabaseError> {
    let schemas = list_schemas(pool).await?;
    let page_count: i64 = sqlx::query_scalar("PRAGMA page_count")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let page_size: i64 = sqlx::query_scalar("PRAGMA page_size")
        .fetch_one(pool)
        .await
        .unwrap_or(4096);
    let encoding: Option<String> = sqlx::query_scalar("PRAGMA encoding")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();
    let size_bytes = page_count.saturating_mul(page_size);

    Ok(DatabaseOverviewResponse {
        summary: summary.clone(),
        databases: vec![DatabaseInfo {
            name: summary
                .current_database
                .as_deref()
                .and_then(|p| Path::new(p).file_name().and_then(|n| n.to_str()))
                .unwrap_or("main")
                .to_string(),
            owner: None,
            encoding,
            size_bytes: Some(size_bytes),
            size_pretty: Some(format_bytes(size_bytes)),
        }],
        schemas,
        extensions: Vec::new(),
    })
}

pub async fn list_schemas(pool: &SqlitePool) -> Result<Vec<SchemaInfo>, DatabaseError> {
    let rows = sqlx::query(
        "SELECT type FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(pool)
    .await?;

    let mut table_count = 0i64;
    let mut view_count = 0i64;
    for row in rows {
        let kind: String = row.try_get("type").unwrap_or_default();
        if kind == "view" {
            view_count += 1;
        } else {
            table_count += 1;
        }
    }

    Ok(vec![SchemaInfo {
        name: "main".to_string(),
        owner: None,
        is_system: false,
        table_count,
        view_count,
    }])
}

pub(super) async fn read_table_list_flags(pool: &SqlitePool) -> HashMap<String, (bool, bool)> {
    let mut flags = HashMap::new();
    if let Ok(rows) = sqlx::query("PRAGMA table_list").fetch_all(pool).await {
        for r in rows {
            let name: String = r.try_get("name").unwrap_or_default();
            let wr: i64 = r.try_get("wr").unwrap_or(0);
            let strict: i64 = r.try_get("strict").unwrap_or(0);
            flags.insert(name, (strict == 1, wr == 1));
        }
    }
    flags
}

pub(super) async fn read_columns_for_table(
    pool: &SqlitePool,
    table: &str,
) -> Result<Vec<ColumnInfo>, DatabaseError> {
    let qt = quote_identifier(table)?;
    let xinfo_sql = format!("PRAGMA table_xinfo({qt})");
    let col_rows = sqlx::query(&xinfo_sql).fetch_all(pool).await?;

    let mut unique_cols = std::collections::HashSet::new();
    let idx_sql = format!("PRAGMA index_list({qt})");
    if let Ok(idx_rows) = sqlx::query(&idx_sql).fetch_all(pool).await {
        for ir in idx_rows {
            let is_unique = ir.try_get::<i64, _>("unique").unwrap_or(0) == 1;
            if is_unique {
                if let Ok(idx_name) = ir.try_get::<String, _>("name") {
                    if let Ok(qi) = quote_identifier(&idx_name) {
                        let info_sql = format!("PRAGMA index_info({qi})");
                        if let Ok(info_rows) = sqlx::query(&info_sql).fetch_all(pool).await {
                            if info_rows.len() == 1 {
                                if let Ok(cn) = info_rows[0].try_get::<String, _>("name") {
                                    unique_cols.insert(cn);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let raw_ddl: Option<String> = sqlx::query_scalar(
        "SELECT sql FROM sqlite_schema WHERE type IN ('table', 'view') AND name = ?",
    )
    .bind(table)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    let ddl_upper = raw_ddl.as_deref().unwrap_or("").to_ascii_uppercase();
    let has_autoincrement = ddl_upper.contains("AUTOINCREMENT");

    let mut cols = Vec::new();
    let mut visible_idx = 0i32;
    for row in col_rows {
        let hidden: i64 = row.try_get("hidden").unwrap_or(0);
        if hidden == 1 {
            continue;
        }
        visible_idx += 1;
        let name: String = row.try_get("name")?;
        let data_type: String = row.try_get("type").unwrap_or_default();
        let nullable = row.try_get::<i64, _>("notnull").unwrap_or(0) == 0;
        let pk = row.try_get::<i64, _>("pk").unwrap_or(0) > 0;
        let default_value: Option<String> = row.try_get("dflt_value").ok().flatten();
        let is_generated = hidden == 2 || hidden == 3;
        let is_auto = pk
            && data_type.eq_ignore_ascii_case("integer")
            && (has_autoincrement || ddl_upper.contains("PRIMARY KEY"));

        cols.push(ColumnInfo {
            is_unique: unique_cols.contains(&name),
            is_identity: false,
            is_generated,
            generation_expression: if is_generated {
                Some(if hidden == 2 {
                    "VIRTUAL".to_string()
                } else {
                    "STORED".to_string()
                })
            } else {
                None
            },
            auto_increment: is_auto,
            name,
            data_type: if data_type.is_empty() {
                "ANY".to_string()
            } else {
                data_type
            },
            udt_name: None,
            nullable,
            primary_key: pk,
            default_value,
            ordinal_position: visible_idx,
            comment: None,
            enum_values: Vec::new(),
        });
    }

    Ok(cols)
}

pub async fn list_schema_objects(
    pool: &SqlitePool,
    _schema: &str,
) -> Result<SchemaObjectsResponse, DatabaseError> {
    let flags = read_table_list_flags(pool).await;
    let rows = sqlx::query(
        "SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .fetch_all(pool)
    .await?;

    let mut tables = Vec::new();
    let mut views = Vec::new();

    for row in rows {
        let name: String = row.try_get("name")?;
        let kind: String = row.try_get("type")?;
        let (is_strict, without_rowid) = flags.get(&name).copied().unwrap_or((false, false));

        let qt = quote_identifier(&name)?;
        let has_pk = if kind == "table" {
            let pragma = format!("PRAGMA table_xinfo({qt})");
            sqlx::query(&pragma)
                .fetch_all(pool)
                .await
                .map(|cols| {
                    cols.iter()
                        .any(|c| c.try_get::<i64, _>("pk").unwrap_or(0) > 0)
                })
                .unwrap_or(false)
        } else {
            false
        };

        let info = TableInfo {
            name,
            schema: Some("main".to_string()),
            kind: kind.clone(),
            row_count_estimate: None,
            comment: None,
            has_primary_key: has_pk,
            is_strict,
            without_rowid,
        };
        if kind == "view" {
            views.push(info);
        } else {
            tables.push(info);
        }
    }

    let trig_rows = sqlx::query(
        "SELECT name, tbl_name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY name",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let mut triggers = Vec::new();
    for tr in trig_rows {
        triggers.push(TriggerInfo {
            name: tr.try_get("name").unwrap_or_default(),
            table_name: tr.try_get("tbl_name").unwrap_or_default(),
            event: "TRIGGER".to_string(),
            timing: "EVENT".to_string(),
            definition: tr.try_get("sql").ok().flatten(),
        });
    }

    Ok(SchemaObjectsResponse {
        schema: "main".to_string(),
        tables,
        views,
        materialized_views: Vec::new(),
        functions: Vec::new(),
        sequences: Vec::new(),
        enum_types: Vec::new(),
        triggers,
    })
}
