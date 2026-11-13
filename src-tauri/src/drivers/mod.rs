pub mod mysql;
pub mod postgres;
mod sql_helpers;
pub mod sqlite;

pub use sql_helpers::*;

use sqlx::{PgPool, SqlitePool};

use crate::credentials::scrub_secrets;
use crate::models::{
    ConnectionRequest, ConnectionSummary, CreateIndexRequest, CreateTableRequest, DatabaseEngine,
    DatabaseOverviewResponse, DropIndexRequest, DropTableRequest, ExplainResponse,
    MultiQueryResponse, QueryRequest, QueryResponse, SchemaIntrospection, SchemaObjectsResponse,
    TableChangeBatchRequest, TableDataRequest, TableDetailsResponse, TruncateTableRequest,
};
use crate::state::AppDbState;

#[derive(Clone)]
pub enum EnginePool {
    Postgres(PgPool),
    Sqlite(SqlitePool),
    Mysql(sqlx::MySqlPool),
}

impl EnginePool {
    pub async fn close(&self) {
        match self {
            EnginePool::Postgres(pool) => pool.close().await,
            EnginePool::Sqlite(pool) => pool.close().await,
            EnginePool::Mysql(pool) => pool.close().await,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("No database is currently connected")]
    NotConnected,
    #[error("Connection name is required")]
    MissingName,
    #[error("SQLite file path is required")]
    MissingSqlitePath,
    #[error("PostgreSQL host, user, and database are required")]
    MissingPostgresFields,
    #[error("Invalid PostgreSQL connection URL: {0}")]
    InvalidUrl(String),
    #[error("Invalid table or column identifier")]
    InvalidIdentifier,
    #[error("Write queries are disabled for read-only connections")]
    ReadOnly,
    #[error("Table has no primary key and cannot be safely edited")]
    NoPrimaryKey,
    #[error("A primary key, column, or row value is required")]
    MissingChangeValue,
    #[error("Unsupported value for database driver: {0}")]
    InvalidValue(String),
    #[error("Invalid or inaccessible SQLite database: {0}")]
    InvalidSqlite(String),
    #[error("Import failed: {0}")]
    ImportError(String),
    #[error("Query was cancelled")]
    Cancelled,
    #[error("Connection timed out: {0}")]
    Timeout(String),
    #[error("{}", scrub_secrets(&.0.to_string()))]
    Sqlx(#[from] sqlx::Error),
}

pub async fn connect_and_register(
    state: &AppDbState,
    request: ConnectionRequest,
) -> Result<ConnectionSummary, DatabaseError> {
    let managed = match request.engine {
        DatabaseEngine::Sqlite => sqlite::connect(&request).await?,
        DatabaseEngine::Postgres => postgres::connect(&request).await?,
        DatabaseEngine::Mysql => mysql::connect(&request).await?,
    };
    let summary = managed.summary.clone();
    state.insert_connection(managed);
    Ok(summary)
}

pub async fn test_connection(
    request: ConnectionRequest,
) -> Result<ConnectionSummary, DatabaseError> {
    match request.engine {
        DatabaseEngine::Sqlite => sqlite::test_connection(&request).await,
        DatabaseEngine::Postgres => postgres::test_connection(&request).await,
        DatabaseEngine::Mysql => mysql::test_connection(&request).await,
    }
}

pub async fn get_database_overview(
    state: &AppDbState,
    connection_id: Option<&str>,
) -> Result<DatabaseOverviewResponse, DatabaseError> {
    let conn = state.get_connection(connection_id)?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::database_overview(pool, &conn.summary).await,
        EnginePool::Postgres(pool) => postgres::database_overview(pool, &conn.summary).await,
        EnginePool::Mysql(pool) => mysql::database_overview(pool, &conn.summary).await,
    }
}

pub async fn list_schemas(
    state: &AppDbState,
    connection_id: Option<&str>,
) -> Result<Vec<crate::models::SchemaInfo>, DatabaseError> {
    let conn = state.get_connection(connection_id)?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::list_schemas(pool).await,
        EnginePool::Postgres(pool) => postgres::list_schemas(pool).await,
        EnginePool::Mysql(pool) => mysql::list_schemas(pool).await,
    }
}

pub async fn list_schema_objects(
    state: &AppDbState,
    connection_id: Option<&str>,
    schema: &str,
) -> Result<SchemaObjectsResponse, DatabaseError> {
    let conn = state.get_connection(connection_id)?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::list_schema_objects(pool, schema).await,
        EnginePool::Postgres(pool) => postgres::list_schema_objects(pool, schema).await,
        EnginePool::Mysql(pool) => mysql::list_schema_objects(pool, schema).await,
    }
}

pub async fn get_table_details(
    state: &AppDbState,
    connection_id: Option<&str>,
    table: &str,
    schema: Option<&str>,
) -> Result<TableDetailsResponse, DatabaseError> {
    let conn = state.get_connection(connection_id)?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::get_table_details(pool, table, schema).await,
        EnginePool::Postgres(pool) => postgres::get_table_details(pool, table, schema).await,
        EnginePool::Mysql(pool) => mysql::get_table_details(pool, table, schema).await,
    }
}

pub async fn introspect_schema(
    state: &AppDbState,
    connection_id: Option<&str>,
) -> Result<SchemaIntrospection, DatabaseError> {
    let conn = state.get_connection(connection_id)?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::introspect_schema(pool).await,
        EnginePool::Postgres(pool) => postgres::introspect_schema(pool).await,
        EnginePool::Mysql(pool) => mysql::introspect_schema(pool).await,
    }
}

pub async fn get_table_data(
    state: &AppDbState,
    request: TableDataRequest,
) -> Result<QueryResponse, DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::table_data(pool, &request).await,
        EnginePool::Postgres(pool) => postgres::table_data(pool, &request).await,
        EnginePool::Mysql(pool) => mysql::table_data(pool, &request).await,
    }
}

pub async fn execute_query(
    state: &AppDbState,
    request: QueryRequest,
) -> Result<MultiQueryResponse, DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    if conn.summary.read_only && is_obviously_mutating_sql(&request.sql) {
        return Err(DatabaseError::ReadOnly);
    }
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::execute_query(state, pool, &request).await,
        EnginePool::Postgres(pool) => postgres::execute_query(state, pool, &request).await,
        EnginePool::Mysql(pool) => mysql::execute_query(state, pool, &request).await,
    }
}

pub async fn explain_query(
    state: &AppDbState,
    connection_id: Option<&str>,
    sql: &str,
    analyze: bool,
) -> Result<ExplainResponse, DatabaseError> {
    let conn = state.get_connection(connection_id)?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::explain(pool, sql).await,
        EnginePool::Postgres(pool) => postgres::explain(pool, sql, analyze).await,
        EnginePool::Mysql(pool) => mysql::explain(pool, sql).await,
    }
}

pub async fn apply_table_changes(
    state: &AppDbState,
    request: TableChangeBatchRequest,
) -> Result<u64, DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    if conn.summary.read_only {
        return Err(DatabaseError::ReadOnly);
    }
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::apply_table_changes(pool, &request).await,
        EnginePool::Postgres(pool) => postgres::apply_table_changes(pool, &request).await,
        EnginePool::Mysql(pool) => mysql::apply_table_changes(pool, &request).await,
    }
}

pub async fn create_table(
    state: &AppDbState,
    request: CreateTableRequest,
) -> Result<(), DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    if conn.summary.read_only {
        return Err(DatabaseError::ReadOnly);
    }
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::create_table(pool, &request).await,
        EnginePool::Postgres(pool) => postgres::create_table(pool, &request).await,
        EnginePool::Mysql(pool) => mysql::create_table(pool, &request).await,
    }
}

pub async fn drop_table(
    state: &AppDbState,
    request: DropTableRequest,
) -> Result<(), DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    if conn.summary.read_only {
        return Err(DatabaseError::ReadOnly);
    }
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::drop_table(pool, &request).await,
        EnginePool::Postgres(pool) => postgres::drop_table(pool, &request).await,
        EnginePool::Mysql(pool) => mysql::drop_table(pool, &request).await,
    }
}

pub async fn truncate_table(
    state: &AppDbState,
    request: TruncateTableRequest,
) -> Result<(), DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    if conn.summary.read_only {
        return Err(DatabaseError::ReadOnly);
    }
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::truncate_table(pool, &request).await,
        EnginePool::Postgres(pool) => postgres::truncate_table(pool, &request).await,
        EnginePool::Mysql(pool) => mysql::truncate_table(pool, &request).await,
    }
}

pub async fn create_index(
    state: &AppDbState,
    request: CreateIndexRequest,
) -> Result<(), DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    if conn.summary.read_only {
        return Err(DatabaseError::ReadOnly);
    }
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::create_index(pool, &request).await,
        EnginePool::Postgres(pool) => postgres::create_index(pool, &request).await,
        EnginePool::Mysql(pool) => mysql::create_index(pool, &request).await,
    }
}

pub async fn drop_index(
    state: &AppDbState,
    request: DropIndexRequest,
) -> Result<(), DatabaseError> {
    let conn = state.get_connection(request.connection_id.as_deref())?;
    if conn.summary.read_only {
        return Err(DatabaseError::ReadOnly);
    }
    match &conn.pool {
        EnginePool::Sqlite(pool) => sqlite::drop_index(pool, &request).await,
        EnginePool::Postgres(pool) => postgres::drop_index(pool, &request).await,
        EnginePool::Mysql(pool) => mysql::drop_index(pool, &request).await,
    }
}

pub async fn get_sqlite_maintenance_info(
    state: &AppDbState,
    connection_id: Option<&str>,
) -> Result<crate::models::SqliteMaintenanceInfo, DatabaseError> {
    let conn = state.get_connection(connection_id)?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => {
            sqlite::get_maintenance_info(pool, &conn.summary.location, None, None).await
        }
        _ => Err(DatabaseError::InvalidValue(
            "Maintenance inspector is only supported for SQLite connections".to_string(),
        )),
    }
}

pub async fn run_sqlite_maintenance(
    state: &AppDbState,
    connection_id: Option<&str>,
    action: &str,
) -> Result<crate::models::SqliteMaintenanceInfo, DatabaseError> {
    let conn = state.get_connection(connection_id)?;
    match &conn.pool {
        EnginePool::Sqlite(pool) => {
            sqlite::run_maintenance(pool, &conn.summary.location, action, conn.summary.read_only)
                .await
        }
        _ => Err(DatabaseError::InvalidValue(
            "Maintenance inspector is only supported for SQLite connections".to_string(),
        )),
    }
}
