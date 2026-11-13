use sqlx::{MySqlPool, Row};

use crate::drivers::{DatabaseError, quote_identifier, sqlite::format_bytes};
use crate::models::{
    ColumnInfo, ConnectionSummary, DatabaseInfo, DatabaseOverviewResponse, FunctionInfo,
    SchemaInfo, SchemaObjectsResponse, TableInfo, TriggerInfo,
};

pub(super) fn quote_mysql_ident(name: &str) -> Result<String, DatabaseError> {
    let _ = quote_identifier(name)?;
    Ok(format!("`{}`", name.replace('`', "``")))
}

pub(super) fn qualify_mysql_table(
    schema: Option<&str>,
    table: &str,
) -> Result<String, DatabaseError> {
    let qt = quote_mysql_ident(table)?;
    match schema.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => Ok(format!("{}.{qt}", quote_mysql_ident(s)?)),
        None => Ok(qt),
    }
}

pub async fn database_overview(
    pool: &MySqlPool,
    summary: &ConnectionSummary,
) -> Result<DatabaseOverviewResponse, DatabaseError> {
    let rows = sqlx::query(
        "SELECT CAST(s.SCHEMA_NAME AS CHAR) AS name,
                CAST(s.DEFAULT_CHARACTER_SET_NAME AS CHAR) AS encoding,
                CAST(COALESCE(SUM(COALESCE(t.DATA_LENGTH, 0) + COALESCE(t.INDEX_LENGTH, 0)), 0) AS SIGNED) AS size_bytes
         FROM information_schema.schemata s
         LEFT JOIN information_schema.tables t ON t.TABLE_SCHEMA = s.SCHEMA_NAME
         GROUP BY s.SCHEMA_NAME, s.DEFAULT_CHARACTER_SET_NAME
         ORDER BY s.SCHEMA_NAME",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let databases = rows
        .into_iter()
        .map(|r| {
            let size_bytes: Option<i64> = r.try_get("size_bytes").ok();
            DatabaseInfo {
                name: r.try_get("name").unwrap_or_default(),
                owner: None,
                encoding: r.try_get("encoding").ok(),
                size_bytes,
                size_pretty: size_bytes.map(format_bytes),
            }
        })
        .collect();

    let schemas = list_schemas(pool).await?;

    Ok(DatabaseOverviewResponse {
        summary: summary.clone(),
        databases,
        schemas,
        extensions: Vec::new(),
    })
}

pub async fn list_schemas(pool: &MySqlPool) -> Result<Vec<SchemaInfo>, DatabaseError> {
    let rows = sqlx::query(
        "SELECT CAST(s.SCHEMA_NAME AS CHAR) AS name,
                (s.SCHEMA_NAME IN ('information_schema', 'mysql', 'performance_schema', 'sys')) AS is_system,
                CAST(COALESCE(SUM(CASE WHEN t.TABLE_TYPE = 'BASE TABLE' THEN 1 ELSE 0 END), 0) AS SIGNED) AS table_count,
                CAST(COALESCE(SUM(CASE WHEN t.TABLE_TYPE = 'VIEW' THEN 1 ELSE 0 END), 0) AS SIGNED) AS view_count
         FROM information_schema.schemata s
         LEFT JOIN information_schema.tables t ON t.TABLE_SCHEMA = s.SCHEMA_NAME
         GROUP BY s.SCHEMA_NAME
         ORDER BY is_system, s.SCHEMA_NAME",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| SchemaInfo {
            name: r.try_get("name").unwrap_or_default(),
            owner: None,
            is_system: r.try_get::<i64, _>("is_system").unwrap_or(0) != 0,
            table_count: r.try_get("table_count").unwrap_or(0),
            view_count: r.try_get("view_count").unwrap_or(0),
        })
        .collect())
}

pub async fn list_schema_objects(
    pool: &MySqlPool,
    schema: &str,
) -> Result<SchemaObjectsResponse, DatabaseError> {
    let tbl_rows = sqlx::query(
        "SELECT CAST(t.TABLE_NAME AS CHAR) AS name,
                CAST(t.TABLE_SCHEMA AS CHAR) AS schema_name,
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
         WHERE t.TABLE_SCHEMA = ?
         ORDER BY t.TABLE_NAME",
    )
    .bind(schema)
    .fetch_all(pool)
    .await?;

    let mut tables = Vec::new();
    let mut views = Vec::new();

    for r in tbl_rows {
        let ttype: String = r.try_get("table_type").unwrap_or_default();
        let is_view = ttype.eq_ignore_ascii_case("VIEW");
        let comment: Option<String> = r
            .try_get::<Option<String>, _>("comment_text")
            .ok()
            .flatten()
            .filter(|c| !c.trim().is_empty());

        let info = TableInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: Some(schema.to_string()),
            kind: if is_view {
                "view".to_string()
            } else {
                "table".to_string()
            },
            row_count_estimate: r.try_get("row_count_estimate").ok(),
            comment,
            has_primary_key: r.try_get::<i64, _>("has_pk").unwrap_or(0) != 0,
            is_strict: false,
            without_rowid: false,
        };
        if is_view {
            views.push(info);
        } else {
            tables.push(info);
        }
    }

    let routine_rows = sqlx::query(
        "SELECT CAST(ROUTINE_NAME AS CHAR) AS name,
                CAST(ROUTINE_TYPE AS CHAR) AS kind,
                CAST(COALESCE(DATA_TYPE, 'void') AS CHAR) AS return_type,
                CAST(ROUTINE_DEFINITION AS CHAR) AS definition
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA = ?
         ORDER BY ROUTINE_NAME",
    )
    .bind(schema)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let functions = routine_rows
        .into_iter()
        .map(|r| FunctionInfo {
            name: r.try_get("name").unwrap_or_default(),
            schema: Some(schema.to_string()),
            kind: r
                .try_get::<String, _>("kind")
                .unwrap_or_else(|_| "FUNCTION".to_string())
                .to_ascii_lowercase(),
            return_type: r
                .try_get("return_type")
                .unwrap_or_else(|_| "void".to_string()),
            arguments: String::new(),
            language: Some("SQL".to_string()),
            definition: r.try_get("definition").ok().flatten(),
        })
        .collect();

    let trig_rows = sqlx::query(
        "SELECT CAST(TRIGGER_NAME AS CHAR) AS name,
                CAST(EVENT_OBJECT_TABLE AS CHAR) AS table_name,
                CAST(EVENT_MANIPULATION AS CHAR) AS event_name,
                CAST(ACTION_TIMING AS CHAR) AS timing,
                CAST(ACTION_STATEMENT AS CHAR) AS definition
         FROM information_schema.triggers
         WHERE TRIGGER_SCHEMA = ?
         ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME",
    )
    .bind(schema)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let triggers = trig_rows
        .into_iter()
        .map(|r| TriggerInfo {
            name: r.try_get("name").unwrap_or_default(),
            table_name: r.try_get("table_name").unwrap_or_default(),
            event: r
                .try_get("event_name")
                .unwrap_or_else(|_| "TRIGGER".to_string()),
            timing: r.try_get("timing").unwrap_or_else(|_| "BEFORE".to_string()),
            definition: r.try_get("definition").ok().flatten(),
        })
        .collect();

    Ok(SchemaObjectsResponse {
        schema: schema.to_string(),
        tables,
        views,
        materialized_views: Vec::new(),
        functions,
        sequences: Vec::new(),
        enum_types: Vec::new(),
        triggers,
    })
}

pub(super) fn parse_mysql_enum_values(column_type: &str) -> Vec<String> {
    let trimmed = column_type.trim();
    let lower = trimmed.to_ascii_lowercase();
    if !(lower.starts_with("enum(") || lower.starts_with("set(")) || !trimmed.ends_with(')') {
        return Vec::new();
    }
    let inner = &trimmed[trimmed.find('(').map(|i| i + 1).unwrap_or(0)..trimmed.len() - 1];
    let mut vals = Vec::new();
    let mut current = String::new();
    let mut in_quote = false;
    let mut chars = inner.chars().peekable();
    while let Some(c) = chars.next() {
        if in_quote {
            if c == '\'' {
                if chars.peek() == Some(&'\'') {
                    chars.next();
                    current.push('\'');
                } else {
                    in_quote = false;
                    vals.push(std::mem::take(&mut current));
                }
            } else {
                current.push(c);
            }
        } else if c == '\'' {
            in_quote = true;
        }
    }
    vals
}

pub(super) async fn resolve_schema_name(
    pool: &MySqlPool,
    schema: Option<&str>,
) -> Result<String, DatabaseError> {
    if let Some(s) = schema.map(str::trim).filter(|s| !s.is_empty()) {
        return Ok(s.to_string());
    }
    let db: Option<String> = sqlx::query_scalar("SELECT CAST(DATABASE() AS CHAR)")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .filter(|s: &String| !s.trim().is_empty());
    if let Some(d) = db {
        return Ok(d);
    }
    let first: Option<String> = sqlx::query_scalar(
        "SELECT CAST(SCHEMA_NAME AS CHAR) FROM information_schema.schemata
         WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
         ORDER BY SCHEMA_NAME LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    first.ok_or_else(|| {
        DatabaseError::InvalidValue("No active schema/database selected for MySQL".to_string())
    })
}

pub(super) async fn read_mysql_columns(
    pool: &MySqlPool,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnInfo>, DatabaseError> {
    let rows = sqlx::query(
        "SELECT CAST(COLUMN_NAME AS CHAR) AS name,
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
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION",
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let col_type: String = r.try_get("col_type").unwrap_or_default();
            let data_type: String = r.try_get("data_type").unwrap_or_else(|_| col_type.clone());
            let extra: String = r.try_get("extra").unwrap_or_default();
            let col_key: String = r.try_get("column_key").unwrap_or_default();
            let extra_lower = extra.to_ascii_lowercase();
            let enum_values = parse_mysql_enum_values(&col_type);
            let gen_expr: Option<String> = r
                .try_get::<Option<String>, _>("gen_expr")
                .ok()
                .flatten()
                .filter(|s| !s.trim().is_empty());

            ColumnInfo {
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
                generation_expression: gen_expr,
                auto_increment: extra_lower.contains("auto_increment"),
                default_value: r.try_get("default_value").ok().flatten(),
                ordinal_position: r.try_get::<i64, _>("ordinal_position").unwrap_or(0) as i32,
                comment: r
                    .try_get::<Option<String>, _>("comment_text")
                    .ok()
                    .flatten()
                    .filter(|s| !s.trim().is_empty()),
                enum_values,
            }
        })
        .collect())
}
