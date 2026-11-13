use std::collections::{HashMap, HashSet};

use sqlx::{MySqlPool, Row};

use super::overview::{list_schemas, parse_mysql_enum_values};
use crate::drivers::DatabaseError;
use crate::models::{ColumnInfo, ForeignKeyInfo, SchemaIntrospection, TableInfo};

pub async fn introspect_schema(pool: &MySqlPool) -> Result<SchemaIntrospection, DatabaseError> {
    let schemas = list_schemas(pool).await?;
    let user_schemas: HashSet<String> = schemas
        .iter()
        .filter(|s| !s.is_system)
        .map(|s| s.name.clone())
        .collect();

    let tbl_rows = sqlx::query(
        "SELECT CAST(t.TABLE_SCHEMA AS CHAR) AS schema_name,
                CAST(t.TABLE_NAME AS CHAR) AS name,
                CAST(t.TABLE_TYPE AS CHAR) AS table_type,
                CAST(t.TABLE_ROWS AS SIGNED) AS row_count_estimate,
                CAST(t.TABLE_COMMENT AS CHAR) AS comment_text,
                EXISTS (
                    SELECT 1 FROM information_schema.table_constraints tc
                    WHERE tc.TABLE_SCHEMA = t.TABLE_SCHEMA
                      AND tc.TABLE_NAME = t.TABLE_NAME
                      AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                ) AS has_pk
         FROM information_schema.tables t
         WHERE t.TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
         ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME",
    )
    .fetch_all(pool)
    .await?;

    let mut tables = Vec::new();
    for r in tbl_rows {
        let sname: String = r.try_get("schema_name").unwrap_or_default();
        if !user_schemas.is_empty() && !user_schemas.contains(&sname) {
            continue;
        }
        let ttype: String = r.try_get("table_type").unwrap_or_default();
        let comment: Option<String> = r
            .try_get::<Option<String>, _>("comment_text")
            .ok()
            .flatten()
            .filter(|s| !s.trim().is_empty());
        tables.push(TableInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: Some(sname),
            kind: if ttype.eq_ignore_ascii_case("VIEW") {
                "view".to_string()
            } else {
                "table".to_string()
            },
            row_count_estimate: r.try_get("row_count_estimate").ok(),
            comment,
            has_primary_key: r.try_get::<i64, _>("has_pk").unwrap_or(0) != 0,
            is_strict: false,
            without_rowid: false,
        });
    }

    let col_rows = sqlx::query(
        "SELECT CAST(TABLE_SCHEMA AS CHAR) AS schema_name,
                CAST(TABLE_NAME AS CHAR) AS table_name,
                CAST(COLUMN_NAME AS CHAR) AS name,
                CAST(COLUMN_TYPE AS CHAR) AS col_type,
                CAST(DATA_TYPE AS CHAR) AS data_type,
                CAST(IS_NULLABLE AS CHAR) AS is_nullable,
                CAST(ORDINAL_POSITION AS SIGNED) AS ordinal_position,
                CAST(COLUMN_DEFAULT AS CHAR) AS default_value,
                CAST(EXTRA AS CHAR) AS extra,
                CAST(COLUMN_KEY AS CHAR) AS column_key,
                CAST(COLUMN_COMMENT AS CHAR) AS comment_text,
                CAST(GENERATION_EXPRESSION AS CHAR) AS gen_expr
         FROM information_schema.columns
         WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
         ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut columns_map: HashMap<String, Vec<ColumnInfo>> = HashMap::new();
    for r in col_rows {
        let sname: String = r.try_get("schema_name").unwrap_or_default();
        let tname: String = r.try_get("table_name").unwrap_or_default();
        let col_type: String = r.try_get("col_type").unwrap_or_default();
        let data_type: String = r.try_get("data_type").unwrap_or_else(|_| col_type.clone());
        let extra: String = r.try_get("extra").unwrap_or_default();
        let col_key: String = r.try_get("column_key").unwrap_or_default();
        let extra_lower = extra.to_ascii_lowercase();
        let enum_values = parse_mysql_enum_values(&col_type);
        columns_map
            .entry(format!("{sname}.{tname}"))
            .or_default()
            .push(ColumnInfo {
                name: r.try_get("name").unwrap_or_default(),
                data_type: if col_type.is_empty() {
                    data_type.clone()
                } else {
                    col_type
                },
                udt_name: Some(data_type),
                nullable: r
                    .try_get::<String, _>("is_nullable")
                    .unwrap_or_default()
                    .eq_ignore_ascii_case("YES"),
                primary_key: col_key == "PRI",
                is_unique: col_key == "UNI",
                is_identity: extra_lower.contains("auto_increment"),
                is_generated: extra_lower.contains("generated"),
                generation_expression: r
                    .try_get::<Option<String>, _>("gen_expr")
                    .ok()
                    .flatten()
                    .filter(|s| !s.trim().is_empty()),
                auto_increment: extra_lower.contains("auto_increment"),
                default_value: r.try_get("default_value").ok().flatten(),
                ordinal_position: r.try_get::<i64, _>("ordinal_position").unwrap_or(0) as i32,
                comment: r
                    .try_get::<Option<String>, _>("comment_text")
                    .ok()
                    .flatten()
                    .filter(|s| !s.trim().is_empty()),
                enum_values,
            });
    }

    let fk_rows = sqlx::query(
        "SELECT CAST(kcu.CONSTRAINT_NAME AS CHAR) AS name,
                CAST(kcu.TABLE_SCHEMA AS CHAR) AS from_schema,
                CAST(kcu.TABLE_NAME AS CHAR) AS from_table,
                CAST(kcu.COLUMN_NAME AS CHAR) AS from_col,
                CAST(kcu.REFERENCED_TABLE_SCHEMA AS CHAR) AS to_schema,
                CAST(kcu.REFERENCED_TABLE_NAME AS CHAR) AS to_table,
                CAST(kcu.REFERENCED_COLUMN_NAME AS CHAR) AS to_col,
                CAST(rc.UPDATE_RULE AS CHAR) AS on_update,
                CAST(rc.DELETE_RULE AS CHAR) AS on_delete
         FROM information_schema.key_column_usage kcu
         LEFT JOIN information_schema.referential_constraints rc
           ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
          AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
         WHERE kcu.TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
           AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
         ORDER BY kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.CONSTRAINT_NAME",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let foreign_keys = fk_rows
        .into_iter()
        .map(|r| ForeignKeyInfo {
            name: r.try_get("name").ok(),
            from_schema: r.try_get("from_schema").ok().flatten(),
            from_table: r.try_get("from_table").unwrap_or_default(),
            from_column: r.try_get("from_col").unwrap_or_default(),
            to_schema: r.try_get("to_schema").ok().flatten(),
            to_table: r.try_get("to_table").unwrap_or_default(),
            to_column: r.try_get("to_col").unwrap_or_default(),
            on_update: r.try_get("on_update").ok().flatten(),
            on_delete: r.try_get("on_delete").ok().flatten(),
            direction: "outgoing".to_string(),
        })
        .collect();

    Ok(SchemaIntrospection {
        schemas,
        tables,
        columns: columns_map,
        indexes: Vec::new(),
        foreign_keys,
        triggers: Vec::new(),
        functions: Vec::new(),
        sequences: Vec::new(),
        enum_types: Vec::new(),
        extensions: Vec::new(),
    })
}
