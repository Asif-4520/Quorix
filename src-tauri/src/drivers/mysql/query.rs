use std::time::Instant;

use futures_util::TryStreamExt;
use sqlx::mysql::MySqlRow;
use sqlx::{Column as SqlxColumn, Either, MySqlPool, Row, TypeInfo, ValueRef};

use super::overview::{
    qualify_mysql_table, quote_mysql_ident, read_mysql_columns, resolve_schema_name,
};
use crate::drivers::{
    DatabaseError, SqlWhereDialect, compile_where_clause_for_dialect, prepare_explain_sql,
    strip_leading_sql_comments,
};
use crate::models::{
    ExplainResponse, MultiQueryResponse, QueryRequest, QueryResponse, TableDataRequest,
};
use crate::state::{AppDbState, CancelTarget, next_unique_id};

pub async fn table_data(
    pool: &MySqlPool,
    request: &TableDataRequest,
) -> Result<QueryResponse, DatabaseError> {
    let started = Instant::now();
    let schema_name = resolve_schema_name(pool, request.schema.as_deref()).await?;
    let qualified = qualify_mysql_table(Some(&schema_name), &request.table)?;
    let cols = read_mysql_columns(pool, &schema_name, &request.table).await?;

    let page_size = request.page_size.unwrap_or(50).clamp(1, 2000);
    let offset = request.page.unwrap_or(0).saturating_mul(page_size);

    let where_compiled = compile_where_clause_for_dialect(
        &cols,
        request.search_query.as_deref(),
        request.filters.as_deref(),
        request.filter_logic.as_deref(),
        SqlWhereDialect::Mysql,
    )?;

    let order = request
        .sort_column
        .as_deref()
        .map(quote_mysql_ident)
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
            "SELECT CAST(COUNT(*) AS SIGNED) AS count FROM {qualified}{}",
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
                let qc = quote_mysql_ident(&c.name)?;
                let base_type = c
                    .udt_name
                    .as_deref()
                    .unwrap_or(&c.data_type)
                    .to_ascii_lowercase();
                if base_type.contains("blob") || base_type.contains("binary") || base_type == "bit"
                {
                    Ok(format!(
                        "CASE WHEN {qc} IS NULL THEN NULL ELSE CONCAT('0x', HEX({qc})) END AS {qc}"
                    ))
                } else {
                    Ok(format!("CAST({qc} AS CHAR) AS {qc}"))
                }
            })
            .collect::<Result<Vec<_>, DatabaseError>>()?
    };

    let data_sql = format!(
        "SELECT {} FROM {qualified}{}{order} LIMIT ? OFFSET ?",
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
                .map(|idx| mysql_value_as_string(&row, idx))
                .collect()
        })
        .collect();

    Ok(QueryResponse {
        query_id: next_unique_id("mytd"),
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
    pool: &MySqlPool,
    request: &QueryRequest,
) -> Result<MultiQueryResponse, DatabaseError> {
    let started = Instant::now();
    let query_id = request
        .query_id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| next_unique_id("myq"));
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

    if let Ok(Some(conn_id)) =
        sqlx::query_scalar::<_, u64>("SELECT CAST(CONNECTION_ID() AS UNSIGNED)")
            .fetch_optional(&mut *conn)
            .await
    {
        state.register_cancel(
            &query_id,
            CancelTarget::Mysql {
                pool: pool.clone(),
                connection_id: conn_id,
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
                            .map(|i| mysql_value_as_string(&row, i))
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

pub async fn explain(pool: &MySqlPool, sql: &str) -> Result<ExplainResponse, DatabaseError> {
    let started = Instant::now();
    let validation = prepare_explain_sql(sql)?;
    let cleaned = validation.cleaned_sql;

    let json_sql = format!("EXPLAIN FORMAT=JSON {cleaned}");
    let plan: Vec<String> = match sqlx::query_scalar::<_, String>(&json_sql)
        .fetch_all(pool)
        .await
    {
        Ok(lines) if !lines.is_empty() => lines,
        _ => {
            let tree_sql = format!("EXPLAIN FORMAT=TREE {cleaned}");
            match sqlx::query_scalar::<_, String>(&tree_sql)
                .fetch_all(pool)
                .await
            {
                Ok(lines) if !lines.is_empty() => lines,
                _ => {
                    let basic_sql = format!("EXPLAIN {cleaned}");
                    let rows = sqlx::query(&basic_sql).fetch_all(pool).await?;
                    rows.into_iter()
                        .map(|r| {
                            (0..r.columns().len())
                                .map(|i| {
                                    mysql_value_as_string(&r, i).unwrap_or_else(|| "NULL".into())
                                })
                                .collect::<Vec<_>>()
                                .join(" | ")
                        })
                        .collect()
                }
            }
        }
    };

    Ok(ExplainResponse {
        plan,
        duration_ms: started.elapsed().as_millis(),
        mode: Some("estimate".to_string()),
        safety_notice: validation.contains_mutation.then(|| {
            "Safe Explain Mode: Showing MySQL optimizer estimates only — zero rows were modified."
                .to_string()
        }),
    })
}

pub fn mysql_value_as_string(row: &MySqlRow, idx: usize) -> Option<String> {
    let raw = row.try_get_raw(idx).ok()?;
    if raw.is_null() {
        return None;
    }

    let type_name = raw.type_info().name().to_ascii_uppercase();
    match type_name.as_str() {
        "BOOLEAN" | "TINYINT(1)" => row
            .try_get::<bool, _>(idx)
            .ok()
            .map(|b| if b { "true" } else { "false" }.to_string())
            .or_else(|| row.try_get::<i8, _>(idx).ok().map(|v| v.to_string())),
        "TINYINT" => row.try_get::<i8, _>(idx).ok().map(|v| v.to_string()),
        "TINYINT UNSIGNED" => row.try_get::<u8, _>(idx).ok().map(|v| v.to_string()),
        "SMALLINT" => row.try_get::<i16, _>(idx).ok().map(|v| v.to_string()),
        "SMALLINT UNSIGNED" => row.try_get::<u16, _>(idx).ok().map(|v| v.to_string()),
        "INT" | "MEDIUMINT" => row.try_get::<i32, _>(idx).ok().map(|v| v.to_string()),
        "INT UNSIGNED" | "MEDIUMINT UNSIGNED" => {
            row.try_get::<u32, _>(idx).ok().map(|v| v.to_string())
        }
        "BIGINT" => row.try_get::<i64, _>(idx).ok().map(|v| v.to_string()),
        "BIGINT UNSIGNED" => row.try_get::<u64, _>(idx).ok().map(|v| v.to_string()),
        "FLOAT" => row.try_get::<f32, _>(idx).ok().map(|v| v.to_string()),
        "DOUBLE" => row.try_get::<f64, _>(idx).ok().map(|v| v.to_string()),
        "BLOB" | "TINYBLOB" | "MEDIUMBLOB" | "LONGBLOB" | "BINARY" | "VARBINARY" | "BIT" => {
            row.try_get::<Vec<u8>, _>(idx).ok().map(|bytes| {
                let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
                format!("0x{hex}")
            })
        }
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
