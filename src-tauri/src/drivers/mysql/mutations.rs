use std::collections::HashMap;

use sqlx::MySqlPool;

use super::overview::{qualify_mysql_table, quote_mysql_ident, resolve_schema_name};
use crate::drivers::DatabaseError;
use crate::models::{
    CreateIndexRequest, CreateTableRequest, DropIndexRequest, DropTableRequest,
    TableChangeBatchRequest, TableChangeOperation, TruncateTableRequest,
};

pub async fn apply_table_changes(
    pool: &MySqlPool,
    request: &TableChangeBatchRequest,
) -> Result<u64, DatabaseError> {
    let schema_name = resolve_schema_name(pool, request.schema.as_deref()).await?;
    let qt = qualify_mysql_table(Some(&schema_name), &request.table)?;

    let mut tx = pool.begin().await?;
    let mut total_affected = 0u64;

    for m in &request.mutations {
        match m.operation {
            TableChangeOperation::Update => {
                let col = quote_mysql_ident(
                    m.column
                        .as_deref()
                        .ok_or(DatabaseError::MissingChangeValue)?,
                )?;
                let pk_map = m
                    .primary_key
                    .as_ref()
                    .filter(|p| !p.is_empty())
                    .ok_or(DatabaseError::NoPrimaryKey)?;
                let (where_sql, pk_vals) = build_mysql_pk_predicate(pk_map)?;
                let sql = format!("UPDATE {qt} SET {col} = ? WHERE {where_sql}");
                let mut q = sqlx::query(&sql).bind(m.value.as_deref());
                for v in &pk_vals {
                    q = q.bind(v.as_deref());
                }
                total_affected += q.execute(&mut *tx).await?.rows_affected();
            }
            TableChangeOperation::Delete => {
                let pk_map = m
                    .primary_key
                    .as_ref()
                    .filter(|p| !p.is_empty())
                    .ok_or(DatabaseError::NoPrimaryKey)?;
                let (where_sql, pk_vals) = build_mysql_pk_predicate(pk_map)?;
                let sql = format!("DELETE FROM {qt} WHERE {where_sql}");
                let mut q = sqlx::query(&sql);
                for v in &pk_vals {
                    q = q.bind(v.as_deref());
                }
                total_affected += q.execute(&mut *tx).await?.rows_affected();
            }
            TableChangeOperation::Insert => {
                let row = m.row.as_ref().ok_or(DatabaseError::MissingChangeValue)?;
                if row.is_empty() {
                    return Err(DatabaseError::MissingChangeValue);
                }
                let mut cols = Vec::with_capacity(row.len());
                let mut vals = Vec::with_capacity(row.len());
                for (k, v) in row {
                    cols.push(quote_mysql_ident(k)?);
                    vals.push(v.as_deref());
                }
                let ph = vec!["?"; cols.len()].join(", ");
                let sql = format!("INSERT INTO {qt} ({}) VALUES ({ph})", cols.join(", "));
                let mut q = sqlx::query(&sql);
                for v in vals {
                    q = q.bind(v);
                }
                total_affected += q.execute(&mut *tx).await?.rows_affected();
            }
        }
    }

    tx.commit().await?;
    Ok(total_affected)
}

fn build_mysql_pk_predicate(
    pk_map: &HashMap<String, Option<String>>,
) -> Result<(String, Vec<Option<String>>), DatabaseError> {
    let mut parts = Vec::with_capacity(pk_map.len());
    let mut vals = Vec::new();
    for (k, v) in pk_map {
        let qk = quote_mysql_ident(k)?;
        match v {
            Some(val) => {
                parts.push(format!("{qk} = ?"));
                vals.push(Some(val.clone()));
            }
            None => parts.push(format!("{qk} IS NULL")),
        }
    }
    Ok((parts.join(" AND "), vals))
}

pub async fn create_table(
    pool: &MySqlPool,
    request: &CreateTableRequest,
) -> Result<(), DatabaseError> {
    let qt = qualify_mysql_table(request.schema.as_deref(), &request.name)?;
    let mut col_defs = Vec::new();
    let mut pks = Vec::new();

    for col in &request.columns {
        let col_name = quote_mysql_ident(&col.name)?;
        let mut def = format!("{col_name} {}", col.data_type);
        if !col.nullable {
            def.push_str(" NOT NULL");
        }
        if col.auto_increment {
            def.push_str(" AUTO_INCREMENT");
        }
        if let Some(ref d) = col.default_value {
            if !d.trim().is_empty() {
                def.push_str(&format!(" DEFAULT {d}"));
            }
        }
        if col.primary_key {
            pks.push(col_name);
        }
        col_defs.push(def);
    }

    if !pks.is_empty() {
        col_defs.push(format!("PRIMARY KEY ({})", pks.join(", ")));
    }

    let sql = format!("CREATE TABLE {qt} (\n  {}\n)", col_defs.join(",\n  "));
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn drop_table(pool: &MySqlPool, request: &DropTableRequest) -> Result<(), DatabaseError> {
    let qt = qualify_mysql_table(request.schema.as_deref(), &request.name)?;
    let sql = format!("DROP TABLE {qt}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn truncate_table(
    pool: &MySqlPool,
    request: &TruncateTableRequest,
) -> Result<(), DatabaseError> {
    let qt = qualify_mysql_table(request.schema.as_deref(), &request.name)?;
    let sql = format!("TRUNCATE TABLE {qt}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn create_index(
    pool: &MySqlPool,
    request: &CreateIndexRequest,
) -> Result<(), DatabaseError> {
    let idx = quote_mysql_ident(&request.index_name)?;
    let qt = qualify_mysql_table(request.schema.as_deref(), &request.table)?;
    let cols: Result<Vec<String>, DatabaseError> = request
        .columns
        .iter()
        .map(|c| quote_mysql_ident(c))
        .collect();
    let unique_kw = if request.unique { "UNIQUE " } else { "" };
    let sql = format!(
        "CREATE {unique_kw}INDEX {idx} ON {qt} ({})",
        cols?.join(", ")
    );
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn drop_index(pool: &MySqlPool, request: &DropIndexRequest) -> Result<(), DatabaseError> {
    let schema_name = resolve_schema_name(pool, request.schema.as_deref()).await?;
    let table_name: Option<String> = sqlx::query_scalar(
        "SELECT CAST(TABLE_NAME AS CHAR) FROM information_schema.statistics
         WHERE TABLE_SCHEMA = ? AND INDEX_NAME = ? LIMIT 1",
    )
    .bind(&schema_name)
    .bind(&request.index_name)
    .fetch_optional(pool)
    .await?;

    let tbl = table_name.ok_or_else(|| {
        DatabaseError::InvalidValue(format!(
            "Could not find table owning index '{}' in schema '{}'",
            request.index_name, schema_name
        ))
    })?;
    let idx = quote_mysql_ident(&request.index_name)?;
    let qt = qualify_mysql_table(Some(&schema_name), &tbl)?;
    let sql = format!("DROP INDEX {idx} ON {qt}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}
