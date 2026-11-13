use std::time::Instant;

use futures_util::TryStreamExt;
use sqlx::postgres::{PgRow, PgValueFormat};
use sqlx::{Column, Either, PgPool, Row, TypeInfo, ValueRef};

use super::overview::read_pg_columns;
use crate::drivers::{
    DatabaseError, compile_where_clause, prepare_explain_sql, qualify_table, quote_identifier,
    strip_leading_sql_comments,
};
use crate::models::{
    ExplainResponse, MultiQueryResponse, QueryRequest, QueryResponse, TableDataRequest,
};
use crate::state::{AppDbState, CancelTarget, next_unique_id};

pub async fn table_data(
    pool: &PgPool,
    request: &TableDataRequest,
) -> Result<QueryResponse, DatabaseError> {
    let started = Instant::now();
    let schema_name = request
        .schema
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("public");
    let qualified = qualify_table(Some(schema_name), &request.table)?;
    let cols = read_pg_columns(pool, schema_name, &request.table).await?;

    let page_size = request.page_size.unwrap_or(50).clamp(1, 2000);
    let offset = request.page.unwrap_or(0).saturating_mul(page_size);

    let where_compiled = compile_where_clause(
        &cols,
        request.search_query.as_deref(),
        request.filters.as_deref(),
        request.filter_logic.as_deref(),
        true,
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
        let count_sql = format!(
            "SELECT COUNT(*)::bigint AS count FROM {qualified}{}",
            where_compiled.sql
        );
        let mut q = sqlx::query(&count_sql);
        for b in &where_compiled.bindings {
            q = q.bind(b.as_deref());
        }
        Some(q.fetch_one(pool).await?.try_get::<i64, _>("count")? as u64)
    } else {
        None
    };

    let projections: Vec<String> = if cols.is_empty() {
        vec!["*".to_string()]
    } else {
        cols.iter()
            .map(|c| {
                let qc = quote_identifier(&c.name)?;
                if c.data_type.eq_ignore_ascii_case("bytea") {
                    Ok(format!(
                        "CASE WHEN {qc} IS NULL THEN NULL ELSE '0x' || encode({qc}, 'hex') END AS {qc}"
                    ))
                } else {
                    Ok(format!("CAST({qc} AS TEXT) AS {qc}"))
                }
            })
            .collect::<Result<Vec<_>, DatabaseError>>()?
    };

    let limit_idx = where_compiled.bindings.len() + 1;
    let offset_idx = limit_idx + 1;
    let data_sql = format!(
        "SELECT {} FROM {qualified}{}{order} LIMIT ${limit_idx} OFFSET ${offset_idx}",
        projections.join(", "),
        where_compiled.sql
    );

    let mut q = sqlx::query(&data_sql);
    for b in &where_compiled.bindings {
        q = q.bind(b.as_deref());
    }
    q = q.bind(i64::from(page_size)).bind(i64::from(offset));

    let rows = q.fetch_all(pool).await?;

    let column_names: Vec<String> = if !cols.is_empty() {
        cols.iter().map(|c| c.name.clone()).collect()
    } else {
        rows.first()
            .map(|r| r.columns().iter().map(|c| c.name().to_string()).collect())
            .unwrap_or_default()
    };

    let column_types: Vec<String> = if !cols.is_empty() {
        cols.iter().map(|c| c.data_type.clone()).collect()
    } else {
        rows.first()
            .map(|r| {
                r.columns()
                    .iter()
                    .map(|c| c.type_info().name().to_string())
                    .collect()
            })
            .unwrap_or_default()
    };

    let values: Vec<Vec<Option<String>>> = rows
        .into_iter()
        .map(|row| {
            (0..column_names.len())
                .map(|idx| pg_value_as_string(&row, idx))
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
        uses_rowid: false,
    })
}

pub async fn execute_query(
    state: &AppDbState,
    pool: &PgPool,
    request: &QueryRequest,
) -> Result<MultiQueryResponse, DatabaseError> {
    let started = Instant::now();
    let query_id = request
        .query_id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| next_unique_id("pgq"));
    let sql = request.sql.trim();
    if sql.is_empty() {
        return Ok(MultiQueryResponse {
            query_id,
            results: Vec::new(),
            total_duration_ms: 0,
        });
    }

    let max_rows = request.max_rows.unwrap_or(5000).clamp(1, 25000);
    let mut conn = pool.acquire().await?;

    if let Ok(pid) = sqlx::query_scalar::<_, i32>("SELECT pg_backend_pid()")
        .fetch_one(&mut *conn)
        .await
    {
        state.register_cancel(
            &query_id,
            CancelTarget::Postgres {
                pool: pool.clone(),
                backend_pid: pid,
            },
        );
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
                            .map(|i| pg_value_as_string(&row, i))
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

        Ok(MultiQueryResponse {
            query_id: query_id.clone(),
            results,
            total_duration_ms: started.elapsed().as_millis(),
        })
    }
    .await;

    state.unregister_cancel(&query_id);
    exec_result
}

async fn run_pg_explain_query(
    conn: &mut sqlx::PgConnection,
    sql: &str,
) -> Result<Vec<String>, sqlx::Error> {
    let mut lines = Vec::new();
    let mut stream = sqlx::raw_sql(sql).fetch_many(conn);
    while let Some(item) = stream.try_next().await? {
        if let Either::Right(r) = item {
            if let Some(s) = pg_value_as_string(&r, 0) {
                lines.push(s);
            }
        }
    }
    Ok(lines)
}

pub async fn explain(
    pool: &PgPool,
    sql: &str,
    analyze: bool,
) -> Result<ExplainResponse, DatabaseError> {
    let started = Instant::now();
    let validation = prepare_explain_sql(sql)?;
    let cleaned = validation.cleaned_sql;
    let can_analyze = analyze && validation.is_read_only;

    let mut conn = pool.acquire().await?;
    let mut mode = "estimate".to_string();
    let mut safety_notice = if analyze && !validation.is_read_only {
        Some(
            "Safe Explain Mode: EXPLAIN ANALYZE skipped because this query writes or deletes rows. Showing estimated plan only — zero rows were modified."
                .to_string(),
        )
    } else if validation.contains_mutation {
        Some("Estimate-only plan for write/delete statement — zero rows were modified.".to_string())
    } else {
        None
    };

    let mut plan: Option<Vec<String>> = None;

    if can_analyze {
        sqlx::query("BEGIN TRANSACTION READ ONLY")
            .execute(&mut *conn)
            .await?;
        let analyze_sql = format!("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {cleaned}");
        let analyze_res = run_pg_explain_query(&mut *conn, &analyze_sql).await;
        let _ = sqlx::query("ROLLBACK").execute(&mut *conn).await;

        match analyze_res {
            Ok(lines) if !lines.is_empty() => {
                mode = "analyze".to_string();
                plan = Some(lines);
            }
            Ok(_) => {}
            Err(err) => {
                let lower = err.to_string().to_ascii_lowercase();
                if lower.contains("read-only") || lower.contains("read only") {
                    safety_notice = Some(
                        "Safe Explain Mode: statement attempted a write inside READ ONLY ANALYZE and was rolled back cleanly. Showing estimated plan instead."
                            .to_string(),
                    );
                } else {
                    return Err(DatabaseError::Sqlx(err));
                }
            }
        }
    }

    let final_plan = match plan {
        Some(p) => p,
        None => {
            let json_sql = format!("EXPLAIN (FORMAT JSON) {cleaned}");
            match run_pg_explain_query(&mut *conn, &json_sql).await {
                Ok(lines) if !lines.is_empty() => lines,
                Ok(_) => {
                    let text_sql = format!("EXPLAIN {cleaned}");
                    let rows = sqlx::query(&text_sql).fetch_all(&mut *conn).await?;
                    rows.into_iter()
                        .filter_map(|r| pg_value_as_string(&r, 0))
                        .collect()
                }
                Err(err) => return Err(DatabaseError::Sqlx(err)),
            }
        }
    };

    Ok(ExplainResponse {
        plan: final_plan,
        duration_ms: started.elapsed().as_millis(),
        mode: Some(mode),
        safety_notice,
    })
}

pub fn pg_value_as_string(row: &PgRow, idx: usize) -> Option<String> {
    let raw = row.try_get_raw(idx).ok()?;
    if raw.is_null() {
        return None;
    }
    if raw.format() == PgValueFormat::Text {
        return raw.as_str().ok().map(|s| s.to_string());
    }

    let type_name = raw.type_info().name().to_ascii_lowercase();
    match type_name.as_str() {
        "int2" => row.try_get::<i16, _>(idx).ok().map(|v| v.to_string()),
        "int4" => row.try_get::<i32, _>(idx).ok().map(|v| v.to_string()),
        "int8" => row.try_get::<i64, _>(idx).ok().map(|v| v.to_string()),
        "float4" => row.try_get::<f32, _>(idx).ok().map(|v| v.to_string()),
        "float8" => row.try_get::<f64, _>(idx).ok().map(|v| v.to_string()),
        "bool" => row
            .try_get::<bool, _>(idx)
            .ok()
            .map(|b| if b { "true" } else { "false" }.to_string()),
        "bytea" => row.try_get::<Vec<u8>, _>(idx).ok().map(|bytes| {
            let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            format!("0x{hex}")
        }),
        _ => row
            .try_get::<String, _>(idx)
            .ok()
            .or_else(|| raw.as_str().ok().map(|s| s.to_string())),
    }
}
