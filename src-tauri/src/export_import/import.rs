use std::collections::HashMap;
use std::time::Instant;

use super::csv::parse_csv_records;
use crate::drivers::{
    DatabaseError, EnginePool, postgres, qualify_table, qualify_table_for_engine, quote_identifier,
    quote_identifier_for_engine,
};
use crate::models::{DatabaseEngine, ImportRequest, ImportResponse};
use crate::state::AppDbState;

pub async fn import_data(
    state: &AppDbState,
    request: &ImportRequest,
) -> Result<ImportResponse, DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    if conn.summary.read_only {
        return Err(DatabaseError::ReadOnly);
    }

    let started = Instant::now();
    let qt = qualify_table(request.schema.as_deref(), &request.table)?;
    let rows_to_insert = parse_import_rows(&request.format, &request.content)?;

    let mut imported = 0usize;
    match &conn.pool {
        EnginePool::Sqlite(pool) => {
            let mut tx = pool.begin().await?;
            for row in rows_to_insert {
                if row.is_empty() {
                    continue;
                }
                let mut cols = Vec::with_capacity(row.len());
                let mut vals = Vec::with_capacity(row.len());
                for (k, v) in row {
                    cols.push(quote_identifier(&k)?);
                    vals.push(v);
                }
                let ph = vec!["?"; cols.len()].join(", ");
                let sql = format!("INSERT INTO {qt} ({}) VALUES ({ph})", cols.join(", "));
                let mut q = sqlx::query(&sql);
                for v in &vals {
                    q = q.bind(v.as_deref());
                }
                q.execute(&mut *tx).await?;
                imported += 1;
            }
            tx.commit().await?;
        }
        EnginePool::Postgres(pool) => {
            let schema_name = request
                .schema
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or("public");
            let details =
                postgres::get_table_details(pool, &request.table, Some(schema_name)).await?;
            let type_map: HashMap<&str, String> = details
                .columns
                .iter()
                .map(|c| {
                    (
                        c.name.as_str(),
                        c.udt_name.clone().unwrap_or_else(|| c.data_type.clone()),
                    )
                })
                .collect();

            let mut tx = pool.begin().await?;
            for row in rows_to_insert {
                if row.is_empty() {
                    continue;
                }
                let mut cols = Vec::with_capacity(row.len());
                let mut phs = Vec::with_capacity(row.len());
                let mut vals = Vec::with_capacity(row.len());
                for (idx, (k, v)) in row.into_iter().enumerate() {
                    cols.push(quote_identifier(&k)?);
                    let cast = type_map
                        .get(k.as_str())
                        .map(|t| {
                            if t.starts_with('_') {
                                format!("::{}[]", &t[1..])
                            } else {
                                format!("::{t}")
                            }
                        })
                        .unwrap_or_default();
                    phs.push(format!("${}{cast}", idx + 1));
                    vals.push(v);
                }
                let sql = format!(
                    "INSERT INTO {qt} ({}) VALUES ({})",
                    cols.join(", "),
                    phs.join(", ")
                );
                let mut q = sqlx::query(&sql);
                for v in &vals {
                    q = q.bind(v.as_deref());
                }
                q.execute(&mut *tx).await?;
                imported += 1;
            }
            tx.commit().await?;
        }
        EnginePool::Mysql(pool) => {
            let qt_mysql = qualify_table_for_engine(
                DatabaseEngine::Mysql,
                request.schema.as_deref(),
                &request.table,
            )?;
            let mut tx = pool.begin().await?;
            for row in rows_to_insert {
                if row.is_empty() {
                    continue;
                }
                let mut cols = Vec::with_capacity(row.len());
                let mut vals = Vec::with_capacity(row.len());
                for (k, v) in row {
                    cols.push(quote_identifier_for_engine(DatabaseEngine::Mysql, &k)?);
                    vals.push(v);
                }
                let ph = vec!["?"; cols.len()].join(", ");
                let sql = format!("INSERT INTO {qt_mysql} ({}) VALUES ({ph})", cols.join(", "));
                let mut q = sqlx::query(&sql);
                for v in &vals {
                    q = q.bind(v.as_deref());
                }
                q.execute(&mut *tx).await?;
                imported += 1;
            }
            tx.commit().await?;
        }
    }

    Ok(ImportResponse {
        imported_rows: imported,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn parse_import_rows(
    format: &str,
    content: &str,
) -> Result<Vec<Vec<(String, Option<String>)>>, DatabaseError> {
    if format.eq_ignore_ascii_case("json") {
        let parsed: serde_json::Value = serde_json::from_str(content)
            .map_err(|e| DatabaseError::ImportError(format!("Invalid JSON: {e}")))?;
        let array = parsed.as_array().ok_or_else(|| {
            DatabaseError::ImportError("JSON must be an array of objects".to_string())
        })?;
        let mut rows = Vec::with_capacity(array.len());
        for item in array {
            let obj = item.as_object().ok_or_else(|| {
                DatabaseError::ImportError("Each JSON array entry must be an object".to_string())
            })?;
            let mut row = Vec::with_capacity(obj.len());
            for (k, v) in obj {
                let val_opt = match v {
                    serde_json::Value::Null => None,
                    serde_json::Value::String(s) => Some(s.clone()),
                    other => Some(other.to_string()),
                };
                row.push((k.clone(), val_opt));
            }
            rows.push(row);
        }
        Ok(rows)
    } else {
        let records = parse_csv_records(content)?;
        if records.is_empty() {
            return Ok(Vec::new());
        }
        let headers = &records[0];
        let mut rows = Vec::new();
        for rec in &records[1..] {
            if rec.iter().all(|c| c.trim().is_empty()) {
                continue;
            }
            let mut row = Vec::with_capacity(headers.len());
            for (idx, h) in headers.iter().enumerate() {
                let raw = rec.get(idx).cloned().unwrap_or_default();
                let val = if raw.is_empty() || raw.eq_ignore_ascii_case("null") {
                    None
                } else {
                    Some(raw)
                };
                row.push((h.trim().to_string(), val));
            }
            rows.push(row);
        }
        Ok(rows)
    }
}
