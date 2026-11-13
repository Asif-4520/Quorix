use sqlx::{Column, Row};

use super::csv::csv_escape;
use crate::drivers::{
    DatabaseError, EnginePool, SqlWhereDialect, compile_where_clause,
    compile_where_clause_for_dialect, mysql, postgres, qualify_table, qualify_table_for_engine,
    quote_identifier, quote_identifier_for_engine, sqlite,
};
use crate::models::{ColumnInfo, DatabaseEngine, ExportRequest, ExportResponse};
use crate::state::AppDbState;

pub async fn export_data(
    state: &AppDbState,
    request: &ExportRequest,
) -> Result<ExportResponse, DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;

    let (columns, rows) = if let Some(ref sql) = request.sql {
        match &conn.pool {
            EnginePool::Sqlite(pool) => {
                let raw_rows = sqlx::query(sql).fetch_all(pool).await?;
                let cols: Vec<String> = raw_rows
                    .first()
                    .map(|r| r.columns().iter().map(|c| c.name().to_string()).collect())
                    .unwrap_or_default();
                let vals = raw_rows
                    .into_iter()
                    .map(|r| {
                        (0..cols.len())
                            .map(|i| sqlite::sqlite_value_as_string(&r, i))
                            .collect()
                    })
                    .collect();
                (cols, vals)
            }
            EnginePool::Postgres(pool) => {
                let mut pg_conn = pool.acquire().await?;
                let mut cols: Vec<String> = Vec::new();
                let mut vals: Vec<Vec<Option<String>>> = Vec::new();
                let mut stream = sqlx::raw_sql(sql).fetch_many(&mut *pg_conn);
                use futures_util::TryStreamExt;
                use sqlx::Either;
                while let Some(item) = stream.try_next().await? {
                    if let Either::Right(r) = item {
                        if cols.is_empty() {
                            cols = r.columns().iter().map(|c| c.name().to_string()).collect();
                        }
                        vals.push(
                            (0..cols.len())
                                .map(|i| postgres::pg_value_as_string(&r, i))
                                .collect(),
                        );
                    }
                }
                (cols, vals)
            }
            EnginePool::Mysql(pool) => {
                let mut my_conn = pool.acquire().await?;
                let mut cols: Vec<String> = Vec::new();
                let mut vals: Vec<Vec<Option<String>>> = Vec::new();
                let mut stream = sqlx::raw_sql(sql).fetch_many(&mut *my_conn);
                use futures_util::TryStreamExt;
                use sqlx::Either;
                while let Some(item) = stream.try_next().await? {
                    if let Either::Right(r) = item {
                        if cols.is_empty() {
                            cols = r.columns().iter().map(|c| c.name().to_string()).collect();
                        }
                        vals.push(
                            (0..cols.len())
                                .map(|i| mysql::mysql_value_as_string(&r, i))
                                .collect(),
                        );
                    }
                }
                (cols, vals)
            }
        }
    } else if let Some(ref table) = request.table {
        let qt = qualify_table(request.schema.as_deref(), table)?;
        let sort_clause = request
            .sort_column
            .as_deref()
            .map(quote_identifier)
            .transpose()?
            .map(|c| {
                format!(
                    " ORDER BY {c}{}",
                    if request.sort_desc.unwrap_or(false) {
                        " DESC"
                    } else {
                        " ASC"
                    }
                )
            })
            .unwrap_or_default();

        match &conn.pool {
            EnginePool::Sqlite(pool) => {
                let pragma = format!("PRAGMA table_xinfo({})", quote_identifier(table)?);
                let col_rows = sqlx::query(&pragma)
                    .fetch_all(pool)
                    .await
                    .unwrap_or_default();
                let meta_cols: Vec<ColumnInfo> = col_rows
                    .into_iter()
                    .enumerate()
                    .map(|(i, r)| ColumnInfo {
                        name: r.try_get("name").unwrap_or_default(),
                        data_type: r.try_get("type").unwrap_or_default(),
                        udt_name: None,
                        nullable: true,
                        primary_key: false,
                        is_unique: false,
                        is_identity: false,
                        is_generated: false,
                        generation_expression: None,
                        auto_increment: false,
                        default_value: None,
                        ordinal_position: (i + 1) as i32,
                        comment: None,
                        enum_values: vec![],
                    })
                    .collect();

                let compiled = compile_where_clause(
                    &meta_cols,
                    request.search_query.as_deref(),
                    request.filters.as_deref(),
                    request.filter_logic.as_deref(),
                    false,
                )?;

                let sql = format!("SELECT * FROM {qt}{}{sort_clause}", compiled.sql);
                let mut q = sqlx::query(&sql);
                for b in &compiled.bindings {
                    q = q.bind(b.as_deref());
                }
                let raw_rows = q.fetch_all(pool).await?;
                let cols: Vec<String> = raw_rows
                    .first()
                    .map(|r| r.columns().iter().map(|c| c.name().to_string()).collect())
                    .unwrap_or_else(|| meta_cols.iter().map(|c| c.name.clone()).collect());
                let vals = raw_rows
                    .into_iter()
                    .map(|r| {
                        (0..cols.len())
                            .map(|i| sqlite::sqlite_value_as_string(&r, i))
                            .collect()
                    })
                    .collect();
                (cols, vals)
            }
            EnginePool::Postgres(pool) => {
                let schema_name = request
                    .schema
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or("public");
                let details = postgres::get_table_details(pool, table, Some(schema_name)).await?;
                let compiled = compile_where_clause(
                    &details.columns,
                    request.search_query.as_deref(),
                    request.filters.as_deref(),
                    request.filter_logic.as_deref(),
                    true,
                )?;
                let projections: Vec<String> = details
                    .columns
                    .iter()
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
                    .collect::<Result<Vec<_>, DatabaseError>>()?;
                let sql = format!(
                    "SELECT {} FROM {qt}{}{sort_clause}",
                    projections.join(", "),
                    compiled.sql
                );
                let mut q = sqlx::query(&sql);
                for b in &compiled.bindings {
                    q = q.bind(b.as_deref());
                }
                let raw_rows = q.fetch_all(pool).await?;
                let cols: Vec<String> = details.columns.iter().map(|c| c.name.clone()).collect();
                let vals = raw_rows
                    .into_iter()
                    .map(|r| {
                        (0..cols.len())
                            .map(|i| postgres::pg_value_as_string(&r, i))
                            .collect()
                    })
                    .collect();
                (cols, vals)
            }
            EnginePool::Mysql(pool) => {
                let schema_name = request
                    .schema
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                    .or(conn.summary.current_database.as_deref())
                    .unwrap_or("mysql");
                let details = mysql::get_table_details(pool, table, Some(schema_name)).await?;
                let compiled = compile_where_clause_for_dialect(
                    &details.columns,
                    request.search_query.as_deref(),
                    request.filters.as_deref(),
                    request.filter_logic.as_deref(),
                    SqlWhereDialect::Mysql,
                )?;
                let qt_mysql =
                    qualify_table_for_engine(DatabaseEngine::Mysql, Some(schema_name), table)?;
                let mysql_sort = request
                    .sort_column
                    .as_deref()
                    .map(|c| quote_identifier_for_engine(DatabaseEngine::Mysql, c))
                    .transpose()?
                    .map(|c| {
                        format!(
                            " ORDER BY {c}{}",
                            if request.sort_desc.unwrap_or(false) {
                                " DESC"
                            } else {
                                " ASC"
                            }
                        )
                    })
                    .unwrap_or_default();
                let projections: Vec<String> = details
                    .columns
                    .iter()
                    .map(|c| {
                        let qc = quote_identifier_for_engine(DatabaseEngine::Mysql, &c.name)?;
                        let base = c
                            .udt_name
                            .as_deref()
                            .unwrap_or(&c.data_type)
                            .to_ascii_lowercase();
                        if base.contains("blob") || base.contains("binary") || base == "bit" {
                            Ok(format!(
                                "CASE WHEN {qc} IS NULL THEN NULL ELSE CONCAT('0x', HEX({qc})) END AS {qc}"
                            ))
                        } else {
                            Ok(format!("CAST({qc} AS CHAR) AS {qc}"))
                        }
                    })
                    .collect::<Result<Vec<_>, DatabaseError>>()?;
                let sql = format!(
                    "SELECT {} FROM {qt_mysql}{}{mysql_sort}",
                    projections.join(", "),
                    compiled.sql
                );
                let mut q = sqlx::query(&sql);
                for b in &compiled.bindings {
                    q = q.bind(b.as_deref());
                }
                let raw_rows = q.fetch_all(pool).await?;
                let cols: Vec<String> = details.columns.iter().map(|c| c.name.clone()).collect();
                let vals = raw_rows
                    .into_iter()
                    .map(|r| {
                        (0..cols.len())
                            .map(|i| mysql::mysql_value_as_string(&r, i))
                            .collect()
                    })
                    .collect();
                (cols, vals)
            }
        }
    } else {
        return Err(DatabaseError::InvalidValue(
            "SQL or Table name is required for export".to_string(),
        ));
    };

    let row_count = rows.len();
    let format_lower = request.format.to_ascii_lowercase();
    let content = if format_lower == "json" {
        let mut list = Vec::with_capacity(rows.len());
        for row in rows {
            let mut map = serde_json::Map::new();
            for (idx, col) in columns.iter().enumerate() {
                let val = row.get(idx).and_then(|v| v.as_ref());
                map.insert(
                    col.clone(),
                    match val {
                        Some(v) => serde_json::Value::String(v.clone()),
                        None => serde_json::Value::Null,
                    },
                );
            }
            list.push(serde_json::Value::Object(map));
        }
        serde_json::to_string_pretty(&list).unwrap_or_default()
    } else {
        let mut out = String::new();
        out.push_str(
            &columns
                .iter()
                .map(|c| csv_escape(c))
                .collect::<Vec<_>>()
                .join(","),
        );
        for row in rows {
            out.push('\n');
            let line = (0..columns.len())
                .map(|idx| match row.get(idx).and_then(|v| v.as_ref()) {
                    Some(v) => csv_escape(v),
                    None => String::new(),
                })
                .collect::<Vec<_>>()
                .join(",");
            out.push_str(&line);
        }
        out
    };

    let saved_path = if let Some(ref path) = request.output_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            std::fs::write(trimmed, &content).map_err(|e| {
                DatabaseError::InvalidValue(format!("Failed writing export file: {e}"))
            })?;
            Some(trimmed.to_string())
        } else {
            None
        }
    } else {
        None
    };

    Ok(ExportResponse {
        content: if saved_path.is_some() {
            String::new()
        } else {
            content
        },
        row_count,
        format: format_lower,
        saved_path,
    })
}
