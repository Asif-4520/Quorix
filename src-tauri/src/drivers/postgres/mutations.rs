use std::collections::HashMap;

use sqlx::PgPool;

use super::overview::read_pg_columns;
use crate::drivers::{DatabaseError, qualify_table, quote_identifier};
use crate::models::{
    CreateIndexRequest, CreateTableRequest, DropIndexRequest, DropTableRequest,
    TableChangeBatchRequest, TableChangeOperation, TruncateTableRequest,
};

pub async fn apply_table_changes(
    pool: &PgPool,
    request: &TableChangeBatchRequest,
) -> Result<u64, DatabaseError> {
    if request.mutations.is_empty() {
        return Ok(0);
    }
    let schema_name = request
        .schema
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("public");
    let qt = qualify_table(Some(schema_name), &request.table)?;
    let cols = read_pg_columns(pool, schema_name, &request.table).await?;
    let type_map: HashMap<&str, String> = cols
        .iter()
        .map(|c| {
            let cast_type = c.udt_name.clone().unwrap_or_else(|| c.data_type.clone());
            (c.name.as_str(), cast_type)
        })
        .collect();

    let mut tx = pool.begin().await?;
    let mut total_affected = 0u64;

    for m in &request.mutations {
        match m.operation {
            TableChangeOperation::Update => {
                let col_name = m
                    .column
                    .as_deref()
                    .ok_or(DatabaseError::MissingChangeValue)?;
                let q_col = quote_identifier(col_name)?;
                let col_cast = pg_cast_for_column(&type_map, col_name);

                let pk_map = m
                    .primary_key
                    .as_ref()
                    .filter(|p| !p.is_empty())
                    .ok_or(DatabaseError::NoPrimaryKey)?;

                let mut bindings: Vec<Option<String>> = vec![m.value.clone()];
                let (where_sql, pk_bindings) = build_pg_pk_predicate(pk_map, &type_map, 2)?;
                bindings.extend(pk_bindings);

                let sql = format!("UPDATE {qt} SET {q_col} = $1{col_cast} WHERE {where_sql}");
                let mut q = sqlx::query(&sql);
                for b in &bindings {
                    q = q.bind(b.as_deref());
                }
                total_affected += q.execute(&mut *tx).await?.rows_affected();
            }
            TableChangeOperation::Delete => {
                let pk_map = m
                    .primary_key
                    .as_ref()
                    .filter(|p| !p.is_empty())
                    .ok_or(DatabaseError::NoPrimaryKey)?;
                let (where_sql, pk_bindings) = build_pg_pk_predicate(pk_map, &type_map, 1)?;
                let sql = format!("DELETE FROM {qt} WHERE {where_sql}");
                let mut q = sqlx::query(&sql);
                for b in &pk_bindings {
                    q = q.bind(b.as_deref());
                }
                total_affected += q.execute(&mut *tx).await?.rows_affected();
            }
            TableChangeOperation::Insert => {
                let row = m.row.as_ref().ok_or(DatabaseError::MissingChangeValue)?;
                if row.is_empty() {
                    return Err(DatabaseError::MissingChangeValue);
                }
                let mut col_names = Vec::with_capacity(row.len());
                let mut placeholders = Vec::with_capacity(row.len());
                let mut bindings = Vec::with_capacity(row.len());
                for (idx, (k, v)) in row.iter().enumerate() {
                    col_names.push(quote_identifier(k)?);
                    let cast = pg_cast_for_column(&type_map, k);
                    placeholders.push(format!("${}{cast}", idx + 1));
                    bindings.push(v.as_deref());
                }
                let sql = format!(
                    "INSERT INTO {qt} ({}) VALUES ({})",
                    col_names.join(", "),
                    placeholders.join(", ")
                );
                let mut q = sqlx::query(&sql);
                for b in bindings {
                    q = q.bind(b);
                }
                total_affected += q.execute(&mut *tx).await?.rows_affected();
            }
        }
    }

    tx.commit().await?;
    Ok(total_affected)
}

fn pg_cast_for_column(type_map: &HashMap<&str, String>, col: &str) -> String {
    match type_map.get(col) {
        Some(t) if !t.trim().is_empty() => {
            if t.starts_with('_') {
                format!("::{}[]", &t[1..])
            } else {
                format!("::{t}")
            }
        }
        _ => String::new(),
    }
}

pub(super) fn build_pg_pk_predicate(
    pk_map: &HashMap<String, Option<String>>,
    type_map: &HashMap<&str, String>,
    start_param_idx: usize,
) -> Result<(String, Vec<Option<String>>), DatabaseError> {
    let mut parts = Vec::with_capacity(pk_map.len());
    let mut vals = Vec::new();
    let mut next_idx = start_param_idx;

    for (k, v) in pk_map {
        let qk = quote_identifier(k)?;
        let cast = pg_cast_for_column(type_map, k);
        match v {
            Some(val) => {
                parts.push(format!("{qk} = ${next_idx}{cast}"));
                vals.push(Some(val.clone()));
                next_idx += 1;
            }
            None => parts.push(format!("{qk} IS NULL")),
        }
    }
    Ok((parts.join(" AND "), vals))
}

pub async fn create_table(
    pool: &PgPool,
    request: &CreateTableRequest,
) -> Result<(), DatabaseError> {
    let qt = qualify_table(request.schema.as_deref(), &request.name)?;
    let mut col_defs = Vec::new();
    let mut pks = Vec::new();

    for col in &request.columns {
        let col_name = quote_identifier(&col.name)?;
        let mut def = if col.auto_increment {
            format!(
                "{col_name} {} GENERATED BY DEFAULT AS IDENTITY",
                col.data_type
            )
        } else {
            format!("{col_name} {}", col.data_type)
        };
        if !col.nullable {
            def.push_str(" NOT NULL");
        }
        if !col.auto_increment {
            if let Some(ref d) = col.default_value {
                if !d.trim().is_empty() {
                    def.push_str(&format!(" DEFAULT {d}"));
                }
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

pub async fn drop_table(pool: &PgPool, request: &DropTableRequest) -> Result<(), DatabaseError> {
    let qt = qualify_table(request.schema.as_deref(), &request.name)?;
    let cascade = if request.cascade { " CASCADE" } else { "" };
    let sql = format!("DROP TABLE {qt}{cascade}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn truncate_table(
    pool: &PgPool,
    request: &TruncateTableRequest,
) -> Result<(), DatabaseError> {
    let qt = qualify_table(request.schema.as_deref(), &request.name)?;
    let sql = format!("TRUNCATE TABLE {qt}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn create_index(
    pool: &PgPool,
    request: &CreateIndexRequest,
) -> Result<(), DatabaseError> {
    let idx = quote_identifier(&request.index_name)?;
    let qt = qualify_table(request.schema.as_deref(), &request.table)?;
    let cols: Result<Vec<String>, DatabaseError> = request
        .columns
        .iter()
        .map(|c| quote_identifier(c))
        .collect();
    let unique_kw = if request.unique { "UNIQUE " } else { "" };
    let method_kw = request
        .method
        .as_deref()
        .filter(|m| !m.trim().is_empty())
        .map(|m| format!(" USING {}", m.trim()))
        .unwrap_or_default();
    let sql = format!(
        "CREATE {unique_kw}INDEX {idx} ON {qt}{method_kw} ({})",
        cols?.join(", ")
    );
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

pub async fn drop_index(pool: &PgPool, request: &DropIndexRequest) -> Result<(), DatabaseError> {
    let idx = qualify_table(request.schema.as_deref(), &request.index_name)?;
    let sql = format!("DROP INDEX {idx}");
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}
