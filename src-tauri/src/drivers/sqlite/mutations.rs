use std::collections::HashMap;

use sqlx::SqlitePool;

use crate::drivers::{DatabaseError, qualify_table, quote_identifier};
use crate::models::{
    CreateIndexRequest, CreateTableRequest, DropIndexRequest, DropTableRequest,
    TableChangeBatchRequest, TableChangeOperation, TruncateTableRequest,
};

pub async fn apply_table_changes(
    pool: &SqlitePool,
    request: &TableChangeBatchRequest,
) -> Result<u64, DatabaseError> {
    if request.mutations.is_empty() {
        return Ok(0);
    }
    let qt = qualify_table(request.schema.as_deref(), &request.table)?;
    let mut tx = pool.begin().await?;
    let mut total_affected = 0u64;

    for m in &request.mutations {
        match m.operation {
            TableChangeOperation::Update => {
                let col = quote_identifier(
                    m.column
                        .as_deref()
                        .ok_or(DatabaseError::MissingChangeValue)?,
                )?;
                let (where_sql, pk_vals) =
                    build_sqlite_row_predicate(m.rowid, m.primary_key.as_ref())?;
                let sql = format!("UPDATE {qt} SET {col} = ? WHERE {where_sql}");
                let mut q = sqlx::query(&sql).bind(m.value.as_deref());
                for v in pk_vals {
                    q = q.bind(v);
                }
                total_affected += q.execute(&mut *tx).await?.rows_affected();
            }
            TableChangeOperation::Delete => {
                let (where_sql, pk_vals) =
                    build_sqlite_row_predicate(m.rowid, m.primary_key.as_ref())?;
                let sql = format!("DELETE FROM {qt} WHERE {where_sql}");
                let mut q = sqlx::query(&sql);
                for v in pk_vals {
                    q = q.bind(v);
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
                    cols.push(quote_identifier(k)?);
                    vals.push(v.as_deref());
                }
                let placeholders = vec!["?"; cols.len()].join(", ");
                let sql = format!(
                    "INSERT INTO {qt} ({}) VALUES ({placeholders})",
                    cols.join(", ")
                );
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

fn build_sqlite_row_predicate(
    rowid: Option<i64>,
    pk: Option<&HashMap<String, Option<String>>>,
) -> Result<(String, Vec<Option<String>>), DatabaseError> {
    if let Some(rid) = rowid {
        return Ok(("rowid = ?".to_string(), vec![Some(rid.to_string())]));
    }
    let pk_map = pk.ok_or(DatabaseError::NoPrimaryKey)?;
    if pk_map.is_empty() {
        return Err(DatabaseError::NoPrimaryKey);
    }
    let mut parts = Vec::with_capacity(pk_map.len());
    let mut vals = Vec::new();
    for (k, v) in pk_map {
        let qk = quote_identifier(k)?;
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
    pool: &SqlitePool,
    request: &CreateTableRequest,
) -> Result<(), DatabaseError> {
    let table = quote_identifier(&request.name)?;
    let mut col_defs = Vec::new();
    let mut pks = Vec::new();

    for col in &request.columns {
        let col_name = quote_identifier(&col.name)?;
        let mut def = format!("{col_name} {}", col.data_type);
        if !col.nullable {
            def.push_str(" NOT NULL");
        }
        if let Some(ref d) = col.default_value {
            if !d.trim().is_empty() {
                def.push_str(&format!(" DEFAULT {d}"));
            }
        }
        if col.primary_key {
            if col.auto_increment && col.data_type.eq_ignore_ascii_case("integer") {
                def.push_str(" PRIMARY KEY AUTOINCREMENT");
            } else {
                pks.push(col_name);
            }
        }
        col_defs.push(def);
    }

    if !pks.is_empty() {
        col_defs.push(format!("PRIMARY KEY ({})", pks.join(", ")));
    }

    let sql = format!("CREATE TABLE {table} (\n  {}\n)", col_defs.join(",\n  "));
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn drop_table(
    pool: &SqlitePool,
    request: &DropTableRequest,
) -> Result<(), DatabaseError> {
    let table = qualify_table(request.schema.as_deref(), &request.name)?;
    let sql = format!("DROP TABLE {table}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn truncate_table(
    pool: &SqlitePool,
    request: &TruncateTableRequest,
) -> Result<(), DatabaseError> {
    let table = qualify_table(request.schema.as_deref(), &request.name)?;
    let sql = format!("DELETE FROM {table}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn create_index(
    pool: &SqlitePool,
    request: &CreateIndexRequest,
) -> Result<(), DatabaseError> {
    let idx = quote_identifier(&request.index_name)?;
    let table = quote_identifier(&request.table)?;
    let cols: Result<Vec<String>, DatabaseError> = request
        .columns
        .iter()
        .map(|c| quote_identifier(c))
        .collect();
    let unique_kw = if request.unique { "UNIQUE " } else { "" };
    let sql = format!(
        "CREATE {unique_kw}INDEX {idx} ON {table} ({})",
        cols?.join(", ")
    );
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn drop_index(
    pool: &SqlitePool,
    request: &DropIndexRequest,
) -> Result<(), DatabaseError> {
    let idx = qualify_table(request.schema.as_deref(), &request.index_name)?;
    let sql = format!("DROP INDEX {idx}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}
