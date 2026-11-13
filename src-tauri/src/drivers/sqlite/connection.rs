use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

use crate::drivers::{DatabaseError, EnginePool, now_millis};
use crate::models::{ConnectionRequest, ConnectionSummary, DatabaseEngine};
use crate::state::{ManagedConnection, next_unique_id};

async fn build_pool(
    request: &ConnectionRequest,
) -> Result<(SqlitePool, ConnectionSummary), DatabaseError> {
    if request.name.trim().is_empty() {
        return Err(DatabaseError::MissingName);
    }

    let path = request
        .path
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or(DatabaseError::MissingSqlitePath)?;

    if Path::new(&path).is_dir() {
        return Err(DatabaseError::InvalidSqlite(
            "The selected path is a directory".to_string(),
        ));
    }

    let create_if_missing = request.create_if_missing.unwrap_or(false) && !request.read_only;
    if !create_if_missing && !Path::new(&path).exists() {
        return Err(DatabaseError::InvalidSqlite(format!(
            "Database file does not exist: {path}"
        )));
    }

    let timeout_secs = request.timeout_seconds.unwrap_or(8).clamp(2, 60);
    let opts = SqliteConnectOptions::from_str(&format!("sqlite://{}", path.replace('\\', "/")))
        .map_err(|e| DatabaseError::InvalidSqlite(e.to_string()))?
        .filename(&path)
        .read_only(request.read_only)
        .create_if_missing(create_if_missing)
        .busy_timeout(Duration::from_millis(5000));

    let pool = SqlitePoolOptions::new()
        .max_connections(if request.read_only { 4 } else { 2 })
        .acquire_timeout(Duration::from_secs(timeout_secs))
        .connect_with(opts)
        .await
        .map_err(|e| DatabaseError::InvalidSqlite(e.to_string()))?;

    sqlx::query("PRAGMA schema_version")
        .fetch_one(&pool)
        .await
        .map_err(|e| DatabaseError::InvalidSqlite(e.to_string()))?;

    let _ = sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await;
    if !request.read_only {
        let _ = sqlx::query("PRAGMA journal_mode = WAL")
            .execute(&pool)
            .await;
        let _ = sqlx::query("PRAGMA synchronous = NORMAL")
            .execute(&pool)
            .await;
    }

    let version: Option<String> = sqlx::query_scalar("SELECT sqlite_version()")
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();

    let id = request
        .connection_id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| next_unique_id("sqlite"));

    let summary = ConnectionSummary {
        id,
        name: request.name.trim().to_string(),
        engine: "SQLite".to_string(),
        engine_kind: DatabaseEngine::Sqlite,
        read_only: request.read_only,
        location: path.clone(),
        current_database: Some(path),
        server_version: version.map(|v| format!("SQLite {v}")),
        connected_at_ms: now_millis(),
        environment: request.environment.unwrap_or_default(),
    };

    Ok((pool, summary))
}

pub async fn connect(request: &ConnectionRequest) -> Result<ManagedConnection, DatabaseError> {
    let (pool, summary) = build_pool(request).await?;
    Ok(ManagedConnection {
        pool: EnginePool::Sqlite(pool),
        summary,
        engine: DatabaseEngine::Sqlite,
    })
}

pub async fn test_connection(
    request: &ConnectionRequest,
) -> Result<ConnectionSummary, DatabaseError> {
    let (pool, summary) = build_pool(request).await?;
    pool.close().await;
    Ok(summary)
}
