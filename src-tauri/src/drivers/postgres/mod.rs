mod connection;
mod mutations;
mod overview;
mod query;
mod schema_introspection;
mod table_details;

#[cfg(test)]
pub use connection::build_connect_options;
pub use connection::{connect, test_connection};
pub use mutations::{
    apply_table_changes, create_index, create_table, drop_index, drop_table, truncate_table,
};
pub use overview::{database_overview, list_schema_objects, list_schemas};
pub use query::{execute_query, explain, pg_value_as_string, table_data};
pub use schema_introspection::introspect_schema;
pub use table_details::get_table_details;

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::mutations::build_pg_pk_predicate;
    use super::*;
    use crate::models::{ConnectionRequest, DatabaseEngine};
    fn base_pg_req() -> ConnectionRequest {
        ConnectionRequest {
            connection_id: None,
            engine: DatabaseEngine::Postgres,
            name: "Local PG".to_string(),
            path: None,
            create_if_missing: None,
            host: Some("localhost".to_string()),
            port: Some(5432),
            user: Some("postgres".to_string()),
            password: Some("supersecret".to_string()),
            database: Some("app".to_string()),
            ssl_mode: Some("require".to_string()),
            timeout_seconds: Some(10),
            url: None,
            read_only: false,
            pgbouncer_mode: None,
            advanced_options: None,
            environment: None,
        }
    }

    #[test]
    fn parses_postgres_url_and_hides_password_from_location() {
        let mut req = base_pg_req();
        req.url = Some(
            "postgresql://alice:p%40ssword@db.internal:5433/analytics?sslmode=require".to_string(),
        );
        req.password = None;
        let (opts, location, db) = build_connect_options(&req).expect("parse url");
        assert_eq!(opts.get_host(), "db.internal");
        assert_eq!(opts.get_port(), 5433);
        assert_eq!(opts.get_username(), "alice");
        assert_eq!(db.as_deref(), Some("analytics"));
        assert_eq!(location, "db.internal:5433");
        assert!(!location.contains("password"));
    }

    #[test]
    fn builds_pg_pk_predicate_with_typed_dollar_params() {
        let mut type_map = HashMap::new();
        type_map.insert("id", "uuid".to_string());
        type_map.insert("tenant_id", "int4".to_string());
        let mut pk = HashMap::new();
        pk.insert(
            "id".to_string(),
            Some("550e8400-e29b-41d4-a716-446655440000".to_string()),
        );
        let (where_sql, vals) = build_pg_pk_predicate(&pk, &type_map, 2).expect("predicate");
        assert_eq!(where_sql, "\"id\" = $2::uuid");
        assert_eq!(vals.len(), 1);
    }
}
