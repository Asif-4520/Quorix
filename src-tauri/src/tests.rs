use std::collections::HashMap;
use std::path::Path;

use tempfile::{NamedTempFile, TempDir};

use crate::drivers::DatabaseError;
use crate::models::{
    ColumnDefinition, ConnectionRequest, CreateTableRequest, DatabaseEngine, ExportRequest,
    FilterOperator, FilterRule, ImportRequest, QueryRequest, TableChangeBatchRequest,
    TableChangeOperation, TableDataRequest, TableMutationItem,
};
use crate::state::AppDbState;
use crate::{drivers, export_import};

fn sqlite_req(path: &Path, name: &str, create: bool) -> ConnectionRequest {
    ConnectionRequest {
        connection_id: None,
        engine: DatabaseEngine::Sqlite,
        name: name.to_string(),
        path: Some(path.to_string_lossy().into_owned()),
        create_if_missing: Some(create),
        host: None,
        port: None,
        user: None,
        password: None,
        database: None,
        ssl_mode: None,
        timeout_seconds: Some(5),
        url: None,
        read_only: false,
        pgbouncer_mode: None,
        advanced_options: None,
        environment: None,
    }
}

#[tokio::test]
async fn supports_multiple_simultaneous_sqlite_connections() {
    let dir1 = tempfile::tempdir().expect("dir1");
    let dir2 = tempfile::tempdir().expect("dir2");
    let state = AppDbState::default();

    let s1 = drivers::connect_and_register(
        &state,
        sqlite_req(&dir1.path().join("a.sqlite"), "DB A", true),
    )
    .await
    .expect("connect A");
    let s2 = drivers::connect_and_register(
        &state,
        sqlite_req(&dir2.path().join("b.sqlite"), "DB B", true),
    )
    .await
    .expect("connect B");

    assert_eq!(state.list_connections().len(), 2);

    drivers::execute_query(
        &state,
        QueryRequest {
            connection_id: Some(s1.id.clone()),
            sql: "CREATE TABLE alpha (id INTEGER PRIMARY KEY, label TEXT); INSERT INTO alpha VALUES (1, 'from_a');".to_string(),
            page: None,
            page_size: None,
            max_rows: None,
            query_id: None,
        },
    )
    .await
    .expect("exec A");

    drivers::execute_query(
        &state,
        QueryRequest {
            connection_id: Some(s2.id.clone()),
            sql: "CREATE TABLE beta (id INTEGER PRIMARY KEY, label TEXT); INSERT INTO beta VALUES (1, 'from_b');".to_string(),
            page: None,
            page_size: None,
            max_rows: None,
            query_id: None,
        },
    )
    .await
    .expect("exec B");

    let a_objs = drivers::list_schema_objects(&state, Some(&s1.id), "main")
        .await
        .expect("objs A");
    let b_objs = drivers::list_schema_objects(&state, Some(&s2.id), "main")
        .await
        .expect("objs B");
    assert_eq!(a_objs.tables[0].name, "alpha");
    assert_eq!(b_objs.tables[0].name, "beta");

    state
        .remove_connection(Some(&s1.id))
        .await
        .expect("disconnect A");
    assert_eq!(state.list_connections().len(), 1);
}

#[tokio::test]
async fn rejects_missing_or_invalid_sqlite_files() {
    let dir = TempDir::new().expect("dir");
    let state = AppDbState::default();

    let missing = drivers::connect_and_register(
        &state,
        sqlite_req(&dir.path().join("nope.sqlite"), "Missing", false),
    )
    .await;
    assert!(matches!(missing, Err(DatabaseError::InvalidSqlite(_))));

    let bad = NamedTempFile::new().expect("bad");
    std::fs::write(bad.path(), b"corrupt bytes").expect("write bad");
    let bad_res = drivers::connect_and_register(&state, sqlite_req(bad.path(), "Bad", false)).await;
    assert!(matches!(bad_res, Err(DatabaseError::InvalidSqlite(_))));
}

#[tokio::test]
async fn handles_table_xinfo_filters_batch_mutations_and_rowid_fallback() {
    let dir = TempDir::new().expect("dir");
    let state = AppDbState::default();
    let conn = drivers::connect_and_register(
        &state,
        sqlite_req(&dir.path().join("rich.sqlite"), "Rich", true),
    )
    .await
    .expect("connect");

    drivers::execute_query(
        &state,
        QueryRequest {
            connection_id: Some(conn.id.clone()),
            sql: "
                CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, score REAL);
                CREATE TABLE logs (msg TEXT, level TEXT);
                CREATE TABLE calc (id INTEGER PRIMARY KEY, price REAL, doubled REAL GENERATED ALWAYS AS (price * 2) VIRTUAL);
                INSERT INTO users (name, score) VALUES ('Ada', 9.5), ('Linus', 8.0), ('Grace', 10.0);
                INSERT INTO logs VALUES ('boot', 'info'), ('warn_disk', 'warn');
            "
            .to_string(),
            page: None,
            page_size: None,
            max_rows: None,
            query_id: None,
        },
    )
    .await
    .expect("setup");

    let calc_details = drivers::get_table_details(&state, Some(&conn.id), "calc", Some("main"))
        .await
        .expect("calc details");
    assert!(
        calc_details
            .columns
            .iter()
            .any(|c| c.name == "doubled" && c.is_generated)
    );

    let filtered = drivers::get_table_data(
        &state,
        TableDataRequest {
            connection_id: Some(conn.id.clone()),
            table: "users".to_string(),
            schema: Some("main".to_string()),
            page: Some(0),
            page_size: Some(25),
            sort_column: Some("score".to_string()),
            sort_desc: true,
            search_query: None,
            filters: Some(vec![FilterRule {
                column: Some("score".to_string()),
                operator: FilterOperator::GreaterOrEqual,
                value: Some("9.0".to_string()),
                value2: None,
            }]),
            filter_logic: Some("and".to_string()),
            include_total_count: Some(true),
        },
    )
    .await
    .expect("filtered users");
    assert_eq!(filtered.rows.len(), 2);
    assert_eq!(filtered.rows[0][1].as_deref(), Some("Grace"));

    let logs_data = drivers::get_table_data(
        &state,
        TableDataRequest {
            connection_id: Some(conn.id.clone()),
            table: "logs".to_string(),
            schema: Some("main".to_string()),
            page: Some(0),
            page_size: Some(10),
            sort_column: None,
            sort_desc: false,
            search_query: None,
            filters: None,
            filter_logic: None,
            include_total_count: Some(true),
        },
    )
    .await
    .expect("logs");
    assert!(logs_data.uses_rowid);
    assert_eq!(logs_data.columns[0], "__quorix_rowid__");
    let rid: i64 = logs_data.rows[0][0].as_deref().unwrap().parse().unwrap();

    let affected = drivers::apply_table_changes(
        &state,
        TableChangeBatchRequest {
            connection_id: Some(conn.id.clone()),
            table: "logs".to_string(),
            schema: Some("main".to_string()),
            mutations: vec![
                TableMutationItem {
                    operation: TableChangeOperation::Update,
                    primary_key: None,
                    rowid: Some(rid),
                    column: Some("level".to_string()),
                    value: Some("debug".to_string()),
                    row: None,
                },
                TableMutationItem {
                    operation: TableChangeOperation::Insert,
                    primary_key: None,
                    rowid: None,
                    column: None,
                    value: None,
                    row: Some(HashMap::from([
                        ("msg".to_string(), Some("ready".to_string())),
                        ("level".to_string(), Some("info".to_string())),
                    ])),
                },
            ],
        },
    )
    .await
    .expect("batch commit");
    assert_eq!(affected, 2);

    drivers::create_table(
        &state,
        CreateTableRequest {
            connection_id: Some(conn.id.clone()),
            name: "notes".to_string(),
            schema: None,
            columns: vec![
                ColumnDefinition {
                    name: "id".to_string(),
                    data_type: "INTEGER".to_string(),
                    nullable: false,
                    primary_key: true,
                    default_value: None,
                    auto_increment: true,
                },
                ColumnDefinition {
                    name: "body".to_string(),
                    data_type: "TEXT".to_string(),
                    nullable: true,
                    primary_key: false,
                    default_value: None,
                    auto_increment: false,
                },
            ],
        },
    )
    .await
    .expect("create table");

    let imported = export_import::import_data(
        &state,
        &ImportRequest {
            connection_id: Some(conn.id.clone()),
            table: "notes".to_string(),
            schema: None,
            format: "csv".to_string(),
            content: "body\n\"Line 1,\nLine 2\"\nNULL".to_string(),
        },
    )
    .await
    .expect("import");
    assert_eq!(imported.imported_rows, 2);

    let exported = export_import::export_data(
        &state,
        &ExportRequest {
            connection_id: Some(conn.id.clone()),
            sql: None,
            table: Some("notes".to_string()),
            schema: None,
            format: "json".to_string(),
            output_path: None,
            search_query: None,
            filters: None,
            filter_logic: None,
            sort_column: None,
            sort_desc: None,
        },
    )
    .await
    .expect("export");
    assert_eq!(exported.row_count, 2);
    assert!(exported.content.contains("Line 1,\\nLine 2"));
}

#[tokio::test]
async fn cancels_long_running_sqlite_query() {
    let dir = TempDir::new().expect("dir");
    let state = std::sync::Arc::new(AppDbState::default());
    let conn = drivers::connect_and_register(
        &state,
        sqlite_req(&dir.path().join("cancel.sqlite"), "Cancel", true),
    )
    .await
    .expect("connect");

    let state_bg = std::sync::Arc::clone(&state);
    let qid = "cancel_test_query".to_string();
    let conn_id = conn.id.clone();
    let handle = tokio::spawn(async move {
        drivers::execute_query(
            &state_bg,
            QueryRequest {
                connection_id: Some(conn_id),
                sql: "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 100000000) SELECT SUM(x) FROM cnt".to_string(),
                page: None,
                page_size: None,
                max_rows: None,
                query_id: Some(qid),
            },
        )
        .await
    });

    tokio::time::sleep(std::time::Duration::from_millis(60)).await;
    let cancelled = state
        .cancel_query("cancel_test_query")
        .await
        .expect("cancel call");
    assert!(cancelled);

    let result = handle.await.expect("join");
    assert!(matches!(result, Err(DatabaseError::Cancelled)));
}
