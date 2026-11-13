use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use futures_util::TryStreamExt;
use sqlx::sqlite::SqliteRow;
use sqlx::{Column, Either, Row, SqlitePool, TypeInfo, ValueRef};

use super::overview::{read_columns_for_table, read_table_list_flags};
use crate::drivers::{
    DatabaseError, compile_where_clause, prepare_explain_sql, qualify_table, quote_identifier,
    strip_leading_sql_comments,
};
use crate::models::{
    ExplainResponse, MultiQueryResponse, QueryRequest, QueryResponse, TableDataRequest,
};
use crate::state::{AppDbState, CancelTarget, next_unique_id};

pub async fn table_data(
    pool: &SqlitePool,
    request: &TableDataRequest,
) -> Result<QueryResponse, DatabaseError> {
    let started = Instant::now();
    let qt = qualify_table(request.schema.as_deref(), &request.table)?;
    let cols = read_columns_for_table(pool, &request.table).await?;

    let flags = read_table_list_flags(pool).await;
    let (_, without_rowid) = flags.get(&request.table).copied().unwrap_or((false, false));
    let kind: String = sqlx::query_scalar(
        "SELECT type FROM sqlite_schema WHERE type IN ('table', 'view') AND name = ?",
    )
    .bind(&request.table)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "table".to_string());

    let has_pk = cols.iter().any(|c| c.primary_key);
    let include_rowid = kind == "table" && !has_pk && !without_rowid;

    let page_size = request.page_size.unwrap_or(50).clamp(1, 2000);
    let offset = request.page.unwrap_or(0).saturating_mul(page_size);

    let where_compiled = compile_where_clause(
        &cols,
        request.search_query.as_deref(),
        request.filters.as_deref(),
        request.filter_logic.as_deref(),
        false,
    )?;

    let order = request
        .sort_column
        .as_deref()
        .map(quote_identifier)
        .transpose()?
        .map(|col| {
            format!(
                " ORDER BY {col}{}",
                if request.sort_desc { " DESC" } else { " ASC" }
            )
        })
        .unwrap_or_default();

    let total_rows = if request.include_total_count.unwrap_or(true) {
        let count_sql = format!("SELECT COUNT(*) AS count FROM {qt}{}", where_compiled.sql);
        let mut q = sqlx::query(&count_sql);
        for b in &where_compiled.bindings {
            q = q.bind(b.as_deref());
        }
        Some(q.fetch_one(pool).await?.try_get::<i64, _>("count")? as u64)
    } else {
        None
    };

    let select_expr = if include_rowid {
        "rowid AS \"__quorix_rowid__\", *".to_string()
    } else {
        "*".to_string()
    };
    let data_sql = format!(
        "SELECT {select_expr} FROM {qt}{}{order} LIMIT ? OFFSET ?",
        where_compiled.sql
    );
    let mut q = sqlx::query(&data_sql);
    for b in &where_compiled.bindings {
        q = q.bind(b.as_deref());
    }
    q = q.bind(i64::from(page_size)).bind(i64::from(offset));

    let rows = q.fetch_all(pool).await?;

    let mut column_names: Vec<String> = rows
        .first()
        .map(|r| r.columns().iter().map(|c| c.name().to_string()).collect())
        .unwrap_or_default();

    if column_names.is_empty() {
        if include_rowid {
            column_names.push("__quorix_rowid__".to_string());
        }
        column_names.extend(cols.iter().map(|c| c.name.clone()));
    }

    let type_lookup: HashMap<&str, &str> = cols
        .iter()
        .map(|c| (c.name.as_str(), c.data_type.as_str()))
        .collect();
    let column_types: Vec<String> = column_names
        .iter()
        .map(|name| {
            if name == "__quorix_rowid__" {
                "INTEGER".to_string()
            } else {
                type_lookup
                    .get(name.as_str())
                    .copied()
                    .unwrap_or("ANY")
                    .to_string()
            }
        })
        .collect();

    let values: Vec<Vec<Option<String>>> = rows
        .into_iter()
        .map(|row| {
            (0..column_names.len())
                .map(|idx| sqlite_value_as_string(&row, idx))
                .collect()
        })
        .collect();

    Ok(QueryResponse {
        query_id: next_unique_id("td"),
        columns: column_names,
        column_types,
        rows: values,
        affected_rows: 0,
        duration_ms: started.elapsed().as_millis(),
        total_rows,
        truncated: false,
        statement_type: "SELECT".to_string(),
        uses_rowid: include_rowid,
    })
}

pub async fn execute_query(
    state: &AppDbState,
    pool: &SqlitePool,
    request: &QueryRequest,
) -> Result<MultiQueryResponse, DatabaseError> {
    let started = Instant::now();
    let query_id = request
        .query_id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| next_unique_id("sq"));
    let sql = request.sql.trim();
    if sql.is_empty() {
        return Ok(MultiQueryResponse {
            query_id,
            results: Vec::new(),
            total_duration_ms: 0,
        });
    }

    let max_rows = request.max_rows.unwrap_or(5000).clamp(1, 25000);
    let cancel_flag = Arc::new(AtomicBool::new(false));
    state.register_cancel(&query_id, CancelTarget::Sqlite(Arc::clone(&cancel_flag)));

    let mut conn = pool.acquire().await?;
    {
        let mut handle = conn.lock_handle().await?;
        let flag_for_cb = Arc::clone(&cancel_flag);
        handle.set_progress_handler(1000, move || !flag_for_cb.load(Ordering::Relaxed));
    }

    let exec_result = async {
        let mut results = Vec::new();
        let mut current_cols: Option<Vec<String>> = None;
        let mut current_types: Vec<String> = Vec::new();
        let mut current_rows: Vec<Vec<Option<String>>> = Vec::new();
        let mut truncated = false;
        let mut stmt_start = Instant::now();

        let mut stream = sqlx::raw_sql(sql).fetch_many(&mut *conn);
        while let Some(item) = stream.try_next().await? {
            if cancel_flag.load(Ordering::Relaxed) {
                return Err(DatabaseError::Cancelled);
            }
            match item {
                Either::Right(row) => {
                    if current_cols.is_none() {
                        current_cols =
                            Some(row.columns().iter().map(|c| c.name().to_string()).collect());
                        current_types = row
                            .columns()
                            .iter()
                            .map(|c| c.type_info().name().to_string())
                            .collect();
                    }
                    if current_rows.len() < max_rows {
                        let col_count = row.columns().len();
                        let values = (0..col_count)
                            .map(|i| sqlite_value_as_string(&row, i))
                            .collect();
                        current_rows.push(values);
                    } else {
                        truncated = true;
                    }
                }
                Either::Left(done) => {
                    if let Some(cols) = current_cols.take() {
                        let row_count = current_rows.len() as u64;
                        results.push(QueryResponse {
                            query_id: query_id.clone(),
                            columns: cols,
                            column_types: std::mem::take(&mut current_types),
                            rows: std::mem::take(&mut current_rows),
                            affected_rows: done.rows_affected(),
                            duration_ms: stmt_start.elapsed().as_millis(),
                            total_rows: Some(row_count),
                            truncated,
                            statement_type: "SELECT".to_string(),
                            uses_rowid: false,
                        });
                    } else {
                        results.push(QueryResponse {
                            query_id: query_id.clone(),
                            columns: Vec::new(),
                            column_types: Vec::new(),
                            rows: Vec::new(),
                            affected_rows: done.rows_affected(),
                            duration_ms: stmt_start.elapsed().as_millis(),
                            total_rows: None,
                            truncated: false,
                            statement_type: strip_leading_sql_comments(sql)
                                .split_whitespace()
                                .next()
                                .unwrap_or("EXECUTE")
                                .to_ascii_uppercase(),
                            uses_rowid: false,
                        });
                    }
                    truncated = false;
                    stmt_start = Instant::now();
                }
            }
        }

        if let Some(cols) = current_cols.take() {
            let row_count = current_rows.len() as u64;
            results.push(QueryResponse {
                query_id: query_id.clone(),
                columns: cols,
                column_types: current_types,
                rows: current_rows,
                affected_rows: 0,
                duration_ms: stmt_start.elapsed().as_millis(),
                total_rows: Some(row_count),
                truncated,
                statement_type: "SELECT".to_string(),
                uses_rowid: false,
            });
        }

        Ok(MultiQueryResponse {
            query_id: query_id.clone(),
            results,
            total_duration_ms: started.elapsed().as_millis(),
        })
    }
    .await;

    state.unregister_cancel(&query_id);
    if let Ok(mut handle) = conn.lock_handle().await {
        handle.set_progress_handler(0, || true);
    }

    match exec_result {
        Err(DatabaseError::Sqlx(ref err)) if cancel_flag.load(Ordering::Relaxed) => {
            let _ = err;
            Err(DatabaseError::Cancelled)
        }
        other => other,
    }
}

pub async fn explain(pool: &SqlitePool, sql: &str) -> Result<ExplainResponse, DatabaseError> {
    let started = Instant::now();
    let validation = prepare_explain_sql(sql)?;
    let explain_sql = format!("EXPLAIN QUERY PLAN {}", validation.cleaned_sql);
    let rows = sqlx::query(&explain_sql).fetch_all(pool).await?;
    let mut plan = Vec::new();
    for r in rows {
        let parts: Vec<String> = (0..r.columns().len())
            .filter_map(|i| sqlite_value_as_string(&r, i))
            .collect();
        plan.push(parts.join(" | "));
    }
    Ok(ExplainResponse {
        plan,
        duration_ms: started.elapsed().as_millis(),
        mode: Some("query_plan".to_string()),
        safety_notice: validation.contains_mutation.then(|| {
            "Safe Explain Mode: Showing SQLite QUERY PLAN only — zero rows were modified."
                .to_string()
        }),
    })
}

pub fn sqlite_value_as_string(row: &SqliteRow, idx: usize) -> Option<String> {
    let raw = row.try_get_raw(idx).ok()?;
    if raw.is_null() {
        return None;
    }
    let type_name = raw.type_info().name().to_ascii_lowercase();
    match type_name.as_str() {
        "integer" => row.try_get::<i64, _>(idx).ok().map(|v| v.to_string()),
        "real" => row.try_get::<f64, _>(idx).ok().map(|v| v.to_string()),
        "boolean" => row
            .try_get::<bool, _>(idx)
            .ok()
            .map(|b| if b { "true" } else { "false" }.to_string()),
        "blob" => row.try_get::<Vec<u8>, _>(idx).ok().map(|bytes| {
            let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            format!("0x{hex}")
        }),
        _ => row
            .try_get::<String, _>(idx)
            .ok()
            .or_else(|| row.try_get::<i64, _>(idx).ok().map(|v| v.to_string()))
            .or_else(|| row.try_get::<f64, _>(idx).ok().map(|v| v.to_string()))
            .or_else(|| {
                row.try_get::<Vec<u8>, _>(idx).ok().map(|bytes| {
                    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
                    format!("0x{hex}")
                })
            }),
    }
}
