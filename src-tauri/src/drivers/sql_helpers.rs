use super::DatabaseError;
use crate::models::{ColumnInfo, DatabaseEngine, FilterOperator, FilterRule};

pub fn quote_identifier(value: &str) -> Result<String, DatabaseError> {
    if value.is_empty() || value.contains('\0') {
        return Err(DatabaseError::InvalidIdentifier);
    }
    Ok(format!("\"{}\"", value.replace('"', "\"\"")))
}

pub fn qualify_table(schema: Option<&str>, table: &str) -> Result<String, DatabaseError> {
    let quoted_table = quote_identifier(table)?;
    match schema {
        Some(s) if !s.trim().is_empty() => Ok(format!("{}.{}", quote_identifier(s)?, quoted_table)),
        _ => Ok(quoted_table),
    }
}

pub fn quote_identifier_for_engine(
    engine: DatabaseEngine,
    value: &str,
) -> Result<String, DatabaseError> {
    if value.is_empty() || value.contains('\0') {
        return Err(DatabaseError::InvalidIdentifier);
    }
    match engine {
        DatabaseEngine::Mysql => Ok(format!("`{}`", value.replace('`', "``"))),
        DatabaseEngine::Sqlite | DatabaseEngine::Postgres => {
            Ok(format!("\"{}\"", value.replace('"', "\"\"")))
        }
    }
}

pub fn qualify_table_for_engine(
    engine: DatabaseEngine,
    schema: Option<&str>,
    table: &str,
) -> Result<String, DatabaseError> {
    let qt = quote_identifier_for_engine(engine, table)?;
    match schema {
        Some(s) if !s.trim().is_empty() => Ok(format!(
            "{}.{}",
            quote_identifier_for_engine(engine, s)?,
            qt
        )),
        _ => Ok(qt),
    }
}

pub fn escape_like_pattern_with_char(input: &str, escape: char) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch == escape || ch == '%' || ch == '_' {
            out.push(escape);
        }
        out.push(ch);
    }
    out
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SqlWhereDialect {
    Postgres,
    Sqlite,
    Mysql,
}

#[derive(Debug, Clone)]
pub struct CompiledWhereClause {
    pub sql: String,
    pub bindings: Vec<Option<String>>,
}

pub fn compile_where_clause(
    columns: &[ColumnInfo],
    search_query: Option<&str>,
    filters: Option<&[FilterRule]>,
    filter_logic: Option<&str>,
    postgres_mode: bool,
) -> Result<CompiledWhereClause, DatabaseError> {
    compile_where_clause_for_dialect(
        columns,
        search_query,
        filters,
        filter_logic,
        if postgres_mode {
            SqlWhereDialect::Postgres
        } else {
            SqlWhereDialect::Sqlite
        },
    )
}

pub fn compile_where_clause_for_dialect(
    columns: &[ColumnInfo],
    search_query: Option<&str>,
    filters: Option<&[FilterRule]>,
    filter_logic: Option<&str>,
    dialect: SqlWhereDialect,
) -> Result<CompiledWhereClause, DatabaseError> {
    let mut clauses: Vec<String> = Vec::new();
    let mut bindings: Vec<Option<String>> = Vec::new();
    let postgres_mode = dialect == SqlWhereDialect::Postgres;

    let next_placeholder = |idx: usize| -> String {
        if postgres_mode {
            format!("${idx}")
        } else {
            "?".to_string()
        }
    };

    let quote_col = |name: &str| -> Result<String, DatabaseError> {
        match dialect {
            SqlWhereDialect::Mysql => quote_identifier_for_engine(DatabaseEngine::Mysql, name),
            _ => quote_identifier(name),
        }
    };

    let cast_as_text = |qc: &str| -> String {
        match dialect {
            SqlWhereDialect::Mysql => format!("CAST({qc} AS CHAR)"),
            SqlWhereDialect::Postgres | SqlWhereDialect::Sqlite => format!("CAST({qc} AS TEXT)"),
        }
    };

    if let Some(rules) = filters {
        let mut rule_clauses = Vec::new();
        for rule in rules {
            let target_cols: Vec<&ColumnInfo> = match rule.column.as_deref() {
                Some(col) if !col.trim().is_empty() => {
                    let found: Vec<&ColumnInfo> =
                        columns.iter().filter(|c| c.name == col).collect();
                    if found.is_empty() {
                        let _ = quote_col(col)?;
                    }
                    found
                }
                _ => columns.iter().collect(),
            };

            let single_col_name = rule.column.as_deref().filter(|c| !c.trim().is_empty());

            if let Some(col_name) = single_col_name {
                let col_type = target_cols
                    .first()
                    .map(|c| c.data_type.as_str())
                    .unwrap_or("text");
                let clause = compile_single_column_filter_dialect(
                    col_name,
                    col_type,
                    rule,
                    dialect,
                    &mut bindings,
                    &next_placeholder,
                )?;
                if let Some(c) = clause {
                    rule_clauses.push(c);
                }
            } else if !columns.is_empty() {
                let mut any_col_parts = Vec::new();
                for col in columns {
                    if let Some(c) = compile_single_column_filter_dialect(
                        &col.name,
                        &col.data_type,
                        rule,
                        dialect,
                        &mut bindings,
                        &next_placeholder,
                    )? {
                        any_col_parts.push(c);
                    }
                }
                if !any_col_parts.is_empty() {
                    rule_clauses.push(format!("({})", any_col_parts.join(" OR ")));
                }
            }
        }

        if !rule_clauses.is_empty() {
            let joiner = if matches!(filter_logic, Some(l) if l.eq_ignore_ascii_case("or")) {
                " OR "
            } else {
                " AND "
            };
            clauses.push(format!("({})", rule_clauses.join(joiner)));
        }
    }

    if let Some(search) = search_query.map(str::trim).filter(|s| !s.is_empty()) {
        if !columns.is_empty() {
            let esc_char = if dialect == SqlWhereDialect::Mysql {
                '!'
            } else {
                '\\'
            };
            let esc_sql = if dialect == SqlWhereDialect::Mysql {
                "ESCAPE '!'"
            } else {
                "ESCAPE '\\'"
            };
            let pattern = format!("%{}%", escape_like_pattern_with_char(search, esc_char));
            let like_op = match dialect {
                SqlWhereDialect::Postgres => "ILIKE",
                SqlWhereDialect::Sqlite | SqlWhereDialect::Mysql => "LIKE",
            };
            let mut search_parts = Vec::with_capacity(columns.len());
            if postgres_mode {
                bindings.push(Some(pattern));
                let ph = next_placeholder(bindings.len());
                for col in columns {
                    let qc = quote_col(&col.name)?;
                    let casted = cast_as_text(&qc);
                    search_parts.push(format!("{casted} {like_op} {ph} {esc_sql}"));
                }
            } else {
                for col in columns {
                    let qc = quote_col(&col.name)?;
                    let casted = cast_as_text(&qc);
                    bindings.push(Some(pattern.clone()));
                    let ph = next_placeholder(bindings.len());
                    if dialect == SqlWhereDialect::Mysql {
                        search_parts.push(format!("LOWER({casted}) LIKE LOWER({ph}) {esc_sql}"));
                    } else {
                        search_parts.push(format!("{casted} {like_op} {ph} {esc_sql}"));
                    }
                }
            }
            clauses.push(format!("({})", search_parts.join(" OR ")));
        }
    }

    let sql = if clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", clauses.join(" AND "))
    };

    Ok(CompiledWhereClause { sql, bindings })
}

fn pg_cast_for_type(data_type: &str) -> &'static str {
    let lower = data_type.to_ascii_lowercase();
    if lower.contains("bigint") || lower == "int8" {
        "::bigint"
    } else if lower.contains("smallint") || lower == "int2" {
        "::smallint"
    } else if lower.contains("integer") || lower == "int4" || lower == "int" {
        "::integer"
    } else if lower.contains("numeric") || lower.contains("decimal") {
        "::numeric"
    } else if lower.contains("double") || lower == "float8" {
        "::double precision"
    } else if lower.contains("real") || lower == "float4" {
        "::real"
    } else if lower.contains("boolean") || lower == "bool" {
        "::boolean"
    } else if lower == "uuid" {
        "::uuid"
    } else if lower.contains("timestamptz") || lower.contains("timestamp with time zone") {
        "::timestamptz"
    } else if lower.contains("timestamp") {
        "::timestamp"
    } else if lower == "date" {
        "::date"
    } else if lower.starts_with("time") {
        "::time"
    } else {
        "::text"
    }
}

fn compile_single_column_filter_dialect(
    col_name: &str,
    col_type: &str,
    rule: &FilterRule,
    dialect: SqlWhereDialect,
    bindings: &mut Vec<Option<String>>,
    next_placeholder: &dyn Fn(usize) -> String,
) -> Result<Option<String>, DatabaseError> {
    let postgres_mode = dialect == SqlWhereDialect::Postgres;
    let qc = match dialect {
        SqlWhereDialect::Mysql => quote_identifier_for_engine(DatabaseEngine::Mysql, col_name)?,
        _ => quote_identifier(col_name)?,
    };
    let like_op = match dialect {
        SqlWhereDialect::Postgres => "ILIKE",
        SqlWhereDialect::Sqlite | SqlWhereDialect::Mysql => "LIKE",
    };
    let esc_char = if dialect == SqlWhereDialect::Mysql {
        '!'
    } else {
        '\\'
    };
    let esc_sql = if dialect == SqlWhereDialect::Mysql {
        "ESCAPE '!'"
    } else {
        "ESCAPE '\\'"
    };
    let casted_col = match dialect {
        SqlWhereDialect::Mysql => format!("CAST({qc} AS CHAR)"),
        SqlWhereDialect::Postgres | SqlWhereDialect::Sqlite => format!("CAST({qc} AS TEXT)"),
    };
    let val = rule.value.as_deref().unwrap_or("");
    let pg_cast = if postgres_mode {
        pg_cast_for_type(col_type)
    } else {
        ""
    };

    let expr = match rule.operator {
        FilterOperator::IsNull => format!("{qc} IS NULL"),
        FilterOperator::IsNotNull => format!("{qc} IS NOT NULL"),
        FilterOperator::Contains => {
            bindings.push(Some(format!(
                "%{}%",
                escape_like_pattern_with_char(val, esc_char)
            )));
            let ph = next_placeholder(bindings.len());
            if dialect == SqlWhereDialect::Mysql {
                format!("LOWER({casted_col}) LIKE LOWER({ph}) {esc_sql}")
            } else {
                format!("{casted_col} {like_op} {ph} {esc_sql}")
            }
        }
        FilterOperator::NotContains => {
            bindings.push(Some(format!(
                "%{}%",
                escape_like_pattern_with_char(val, esc_char)
            )));
            let ph = next_placeholder(bindings.len());
            if dialect == SqlWhereDialect::Mysql {
                format!("({qc} IS NULL OR LOWER({casted_col}) NOT LIKE LOWER({ph}) {esc_sql})")
            } else {
                format!("({qc} IS NULL OR {casted_col} NOT {like_op} {ph} {esc_sql})")
            }
        }
        FilterOperator::StartsWith => {
            bindings.push(Some(format!(
                "{}%",
                escape_like_pattern_with_char(val, esc_char)
            )));
            let ph = next_placeholder(bindings.len());
            if dialect == SqlWhereDialect::Mysql {
                format!("LOWER({casted_col}) LIKE LOWER({ph}) {esc_sql}")
            } else {
                format!("{casted_col} {like_op} {ph} {esc_sql}")
            }
        }
        FilterOperator::EndsWith => {
            bindings.push(Some(format!(
                "%{}",
                escape_like_pattern_with_char(val, esc_char)
            )));
            let ph = next_placeholder(bindings.len());
            if dialect == SqlWhereDialect::Mysql {
                format!("LOWER({casted_col}) LIKE LOWER({ph}) {esc_sql}")
            } else {
                format!("{casted_col} {like_op} {ph} {esc_sql}")
            }
        }
        FilterOperator::Equals => {
            bindings.push(Some(val.to_string()));
            let ph = next_placeholder(bindings.len());
            if postgres_mode && pg_cast == "::text" {
                format!("CAST({qc} AS TEXT) = {ph}")
            } else {
                format!("{qc} = {ph}{pg_cast}")
            }
        }
        FilterOperator::NotEquals => {
            bindings.push(Some(val.to_string()));
            let ph = next_placeholder(bindings.len());
            if postgres_mode && pg_cast == "::text" {
                format!("({qc} IS NULL OR CAST({qc} AS TEXT) != {ph})")
            } else {
                format!("({qc} IS NULL OR {qc} != {ph}{pg_cast})")
            }
        }
        FilterOperator::GreaterThan => {
            bindings.push(Some(val.to_string()));
            let ph = next_placeholder(bindings.len());
            format!("{qc} > {ph}{pg_cast}")
        }
        FilterOperator::GreaterOrEqual => {
            bindings.push(Some(val.to_string()));
            let ph = next_placeholder(bindings.len());
            format!("{qc} >= {ph}{pg_cast}")
        }
        FilterOperator::LessThan => {
            bindings.push(Some(val.to_string()));
            let ph = next_placeholder(bindings.len());
            format!("{qc} < {ph}{pg_cast}")
        }
        FilterOperator::LessOrEqual => {
            bindings.push(Some(val.to_string()));
            let ph = next_placeholder(bindings.len());
            format!("{qc} <= {ph}{pg_cast}")
        }
        FilterOperator::Between => {
            let val2 = rule.value2.as_deref().unwrap_or(val);
            bindings.push(Some(val.to_string()));
            let ph1 = next_placeholder(bindings.len());
            bindings.push(Some(val2.to_string()));
            let ph2 = next_placeholder(bindings.len());
            format!("{qc} BETWEEN {ph1}{pg_cast} AND {ph2}{pg_cast}")
        }
        FilterOperator::InList => {
            let items: Vec<&str> = val
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .collect();
            if items.is_empty() {
                return Ok(None);
            }
            let mut phs = Vec::with_capacity(items.len());
            for item in items {
                bindings.push(Some(item.to_string()));
                let ph = next_placeholder(bindings.len());
                phs.push(format!("{ph}{pg_cast}"));
            }
            if postgres_mode && pg_cast == "::text" {
                format!("CAST({qc} AS TEXT) IN ({})", phs.join(", "))
            } else {
                format!("{qc} IN ({})", phs.join(", "))
            }
        }
    };

    Ok(Some(expr))
}

pub fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub(super) fn is_obviously_mutating_sql(sql: &str) -> bool {
    let trimmed = strip_leading_sql_comments(sql).to_ascii_lowercase();
    let first = trimmed.split_whitespace().next().unwrap_or("");
    matches!(
        first,
        "insert"
            | "update"
            | "delete"
            | "drop"
            | "alter"
            | "create"
            | "truncate"
            | "replace"
            | "upsert"
            | "merge"
            | "grant"
            | "revoke"
            | "vacuum"
    )
}

pub fn strip_leading_sql_comments(sql: &str) -> &str {
    let mut s = sql.trim_start();
    loop {
        if let Some(rest) = s.strip_prefix("--") {
            if let Some(nl) = rest.find('\n') {
                s = rest[nl + 1..].trim_start();
            } else {
                return "";
            }
        } else if let Some(rest) = s.strip_prefix("/*") {
            if let Some(end) = rest.find("*/") {
                s = rest[end + 2..].trim_start();
            } else {
                return "";
            }
        } else {
            return s;
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExplainSqlValidation {
    pub cleaned_sql: String,
    pub is_read_only: bool,
    pub contains_mutation: bool,
}

fn dollar_quote_tag_at(bytes: &[u8], idx: usize) -> Option<usize> {
    if bytes.get(idx) != Some(&b'$') {
        return None;
    }
    let mut j = idx + 1;
    while j < bytes.len() {
        let b = bytes[j];
        if b == b'$' {
            return Some(j - idx + 1);
        }
        if !(b.is_ascii_alphanumeric() || b == b'_') {
            return None;
        }
        j += 1;
    }
    None
}

fn mask_sql_literals_and_comments(sql: &str) -> String {
    let bytes = sql.as_bytes();
    let n = bytes.len();
    let mut out = vec![b' '; n];
    let mut i = 0;

    while i < n {
        if bytes[i] == b'-' && bytes.get(i + 1) == Some(&b'-') {
            while i < n && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        if bytes[i] == b'#' {
            while i < n && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        if bytes[i] == b'/' && bytes.get(i + 1) == Some(&b'*') {
            i += 2;
            while i < n && !(bytes[i] == b'*' && bytes.get(i + 1) == Some(&b'/')) {
                i += 1;
            }
            if i + 1 < n {
                i += 2;
            }
            continue;
        }
        if bytes[i] == b'\'' {
            i += 1;
            while i < n {
                if bytes[i] == b'\'' && bytes.get(i + 1) == Some(&b'\'') {
                    i += 2;
                    continue;
                }
                if bytes[i] == b'\\' && i + 1 < n {
                    i += 2;
                    continue;
                }
                if bytes[i] == b'\'' {
                    i += 1;
                    break;
                }
                i += 1;
            }
            continue;
        }
        if bytes[i] == b'"' || bytes[i] == b'`' {
            let q = bytes[i];
            i += 1;
            while i < n {
                if bytes[i] == q && bytes.get(i + 1) == Some(&q) {
                    i += 2;
                    continue;
                }
                if bytes[i] == q {
                    i += 1;
                    break;
                }
                i += 1;
            }
            continue;
        }
        if let Some(tag_len) = dollar_quote_tag_at(bytes, i) {
            let tag = &bytes[i..i + tag_len];
            i += tag_len;
            while i + tag_len <= n {
                if &bytes[i..i + tag_len] == tag {
                    i += tag_len;
                    break;
                }
                i += 1;
            }
            if i + tag_len > n {
                i = n;
            }
            continue;
        }

        out[i] = bytes[i];
        i += 1;
    }

    String::from_utf8_lossy(&out).into_owned()
}

pub fn split_top_level_sql_statements(sql: &str) -> Vec<&str> {
    let masked = mask_sql_literals_and_comments(sql);
    let mut statements = Vec::new();
    let mut start = 0;

    for (idx, ch) in masked.char_indices() {
        if ch == ';' {
            let slice = sql[start..idx].trim();
            if !strip_leading_sql_comments(slice).is_empty() {
                statements.push(slice);
            }
            start = idx + 1;
        }
    }

    let tail = sql[start..].trim();
    if !strip_leading_sql_comments(tail).is_empty() {
        statements.push(tail);
    }

    statements
}

/// Validates and classifies SQL before running EXPLAIN so multi-statement batches,
/// DDL/admin statements, and writable CTEs cannot execute destructive operations.
pub fn prepare_explain_sql(sql: &str) -> Result<ExplainSqlValidation, DatabaseError> {
    let statements = split_top_level_sql_statements(sql);
    if statements.is_empty() {
        return Err(DatabaseError::InvalidValue(
            "Provide a SQL query to explain".to_string(),
        ));
    }
    if statements.len() > 1 {
        return Err(DatabaseError::InvalidValue(
            "EXPLAIN supports only a single SQL statement at a time. Select or place the cursor inside one statement.".to_string(),
        ));
    }

    let cleaned = strip_leading_sql_comments(statements[0])
        .trim()
        .trim_end_matches(';')
        .trim()
        .to_string();
    if cleaned.is_empty() {
        return Err(DatabaseError::InvalidValue(
            "Provide a SQL query to explain".to_string(),
        ));
    }

    let masked = mask_sql_literals_and_comments(&cleaned).to_ascii_uppercase();
    let tokens: Vec<&str> = masked
        .split(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
        .filter(|t| !t.is_empty())
        .collect();

    let first_kw = tokens.first().copied().unwrap_or("");
    if matches!(
        first_kw,
        "DROP"
            | "TRUNCATE"
            | "ALTER"
            | "CREATE"
            | "GRANT"
            | "REVOKE"
            | "VACUUM"
            | "REINDEX"
            | "CLUSTER"
            | "COPY"
            | "CALL"
            | "DO"
            | "PRAGMA"
            | "ATTACH"
            | "DETACH"
            | "BEGIN"
            | "START"
            | "COMMIT"
            | "ROLLBACK"
            | "SAVEPOINT"
            | "SET"
            | "RESET"
            | "LOCK"
    ) {
        return Err(DatabaseError::InvalidValue(format!(
            "Unsafe for EXPLAIN: {first_kw} statements cannot be safely explained."
        )));
    }

    if first_kw == "EXPLAIN" {
        return Err(DatabaseError::InvalidValue(
            "Remove the leading EXPLAIN keyword — Quorix adds safe EXPLAIN options automatically."
                .to_string(),
        ));
    }

    let has_dml_write_kw = tokens.iter().any(|tok| {
        matches!(
            *tok,
            "INSERT" | "UPDATE" | "DELETE" | "MERGE" | "UPSERT" | "REPLACE"
        )
    });
    let has_select_into = first_kw == "SELECT" && tokens.contains(&"INTO");
    let contains_mutation = has_dml_write_kw || has_select_into;
    let is_read_only =
        matches!(first_kw, "SELECT" | "WITH" | "VALUES" | "TABLE") && !contains_mutation;

    Ok(ExplainSqlValidation {
        cleaned_sql: cleaned,
        is_read_only,
        contains_mutation,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compiles_postgres_filters_with_dollar_placeholders_and_ilike() {
        let cols = vec![
            ColumnInfo {
                name: "id".to_string(),
                data_type: "integer".to_string(),
                udt_name: Some("int4".to_string()),
                nullable: false,
                primary_key: true,
                is_unique: true,
                is_identity: false,
                is_generated: false,
                generation_expression: None,
                auto_increment: false,
                default_value: None,
                ordinal_position: 1,
                comment: None,
                enum_values: vec![],
            },
            ColumnInfo {
                name: "email".to_string(),
                data_type: "text".to_string(),
                udt_name: Some("text".to_string()),
                nullable: false,
                primary_key: false,
                is_unique: true,
                is_identity: false,
                is_generated: false,
                generation_expression: None,
                auto_increment: false,
                default_value: None,
                ordinal_position: 2,
                comment: None,
                enum_values: vec![],
            },
        ];

        let rules = vec![
            FilterRule {
                column: Some("id".to_string()),
                operator: FilterOperator::GreaterOrEqual,
                value: Some("10".to_string()),
                value2: None,
            },
            FilterRule {
                column: Some("email".to_string()),
                operator: FilterOperator::Contains,
                value: Some("100%_real".to_string()),
                value2: None,
            },
        ];

        let compiled = compile_where_clause(&cols, Some("ada"), Some(&rules), Some("and"), true)
            .expect("compile pg filters");
        assert!(compiled.sql.contains("\"id\" >= $1::integer"));
        assert!(
            compiled
                .sql
                .contains("CAST(\"email\" AS TEXT) ILIKE $2 ESCAPE '\\'")
        );
        assert!(compiled.sql.contains("ILIKE $3 ESCAPE '\\'"));
        assert_eq!(compiled.bindings.len(), 3);
        assert_eq!(compiled.bindings[1].as_deref(), Some("%100\\%\\_real%"));
    }

    #[test]
    fn rejects_invalid_identifiers() {
        assert!(quote_identifier("").is_err());
        assert!(quote_identifier("bad\0name").is_err());
        assert_eq!(
            quote_identifier("a\"b").expect("escaped quotes"),
            "\"a\"\"b\""
        );
    }

    #[test]
    fn explain_validator_blocks_multi_statement_and_ddl_and_flags_writable_ctes() {
        assert!(prepare_explain_sql("   ").is_err());
        assert!(prepare_explain_sql("SELECT 1; DELETE FROM users;").is_err());
        assert!(prepare_explain_sql("DROP TABLE users;").is_err());
        assert!(prepare_explain_sql("TRUNCATE users;").is_err());
        assert!(prepare_explain_sql("EXPLAIN SELECT 1;").is_err());

        let del = prepare_explain_sql("DELETE FROM users WHERE id = 10;").expect("delete explain");
        assert!(del.contains_mutation);
        assert!(!del.is_read_only);

        let wcte = prepare_explain_sql(
            "WITH removed AS (DELETE FROM users RETURNING id) SELECT * FROM removed;",
        )
        .expect("writable cte explain");
        assert!(wcte.contains_mutation);
        assert!(!wcte.is_read_only);

        let safe = prepare_explain_sql(
            "-- comment\nSELECT * FROM users WHERE note = 'delete; drop table x';",
        )
        .expect("safe read explain");
        assert!(!safe.contains_mutation);
        assert!(safe.is_read_only);
    }
}
