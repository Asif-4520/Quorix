use std::str::FromStr;
use std::time::Duration;

use sqlx::MySqlPool;
use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions, MySqlSslMode};

use crate::drivers::{DatabaseError, EnginePool, now_millis};
use crate::models::{ConnectionRequest, ConnectionSummary, DatabaseEngine};
use crate::state::{ManagedConnection, next_unique_id};

fn parse_mysql_ssl_mode(ssl: Option<&str>) -> MySqlSslMode {
    match ssl
        .unwrap_or("preferred")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "disable" | "disabled" | "false" => MySqlSslMode::Disabled,
        "require" | "required" => MySqlSslMode::Required,
        "verify-ca" | "verify_ca" => MySqlSslMode::VerifyCa,
        "verify-full" | "verify-identity" | "verify_identity" => MySqlSslMode::VerifyIdentity,
        _ => MySqlSslMode::Preferred,
    }
}

fn parse_mysql_url_location(raw: &str) -> (String, Option<String>) {
    let after_scheme = raw
        .trim()
        .strip_prefix("mysql://")
        .or_else(|| raw.trim().strip_prefix("mariadb://"))
        .unwrap_or(raw.trim());
    let before_query = after_scheme.split('?').next().unwrap_or(after_scheme);
    let authority_and_db = before_query.rsplit('@').next().unwrap_or(before_query);
    let mut parts = authority_and_db.splitn(2, '/');
    let host_port = parts.next().unwrap_or("localhost").trim();
    let db = parts
        .next()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string);
    let location = if host_port.is_empty() {
        "localhost:3306".to_string()
    } else if host_port.contains(':') {
        host_port.to_string()
    } else {
        format!("{host_port}:3306")
    };
    (location, db)
}

pub fn build_connect_options(
    request: &ConnectionRequest,
) -> Result<(MySqlConnectOptions, String, Option<String>), DatabaseError> {
    if let Some(raw_url) = request
        .url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let normalized = if raw_url.to_ascii_lowercase().starts_with("mariadb://") {
            format!("mysql://{}", &raw_url["mariadb://".len()..])
        } else {
            raw_url.to_string()
        };
        let mut opts = MySqlConnectOptions::from_str(&normalized)
            .map_err(|e| DatabaseError::InvalidValue(format!("Invalid MySQL URL: {e}")))?;

        if let Some(ref password) = request.password {
            if !password.is_empty() {
                opts = opts.password(password);
            }
        }
        if let Some(ref ssl) = request.ssl_mode {
            opts = opts.ssl_mode(parse_mysql_ssl_mode(Some(ssl)));
        }

        let (location, db) = parse_mysql_url_location(&normalized);
        let fallback_db = request
            .database
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToString::to_string);
        return Ok((opts, location, db.or(fallback_db)));
    }

    let host = request
        .host
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| DatabaseError::InvalidValue("MySQL host is required".to_string()))?;
    let user = request
        .user
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| DatabaseError::InvalidValue("MySQL username is required".to_string()))?;
    let port = request.port.unwrap_or(3306);
    let database = request
        .database
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string);

    let mut opts = MySqlConnectOptions::new()
        .host(host)
        .port(port)
        .username(user)
        .ssl_mode(parse_mysql_ssl_mode(request.ssl_mode.as_deref()));

    if let Some(ref db) = database {
        opts = opts.database(db);
    }
    if let Some(ref password) = request.password {
        if !password.is_empty() {
            opts = opts.password(password);
        }
    }

    Ok((opts, format!("{host}:{port}"), database))
}

async fn build_pool(
    request: &ConnectionRequest,
) -> Result<(MySqlPool, ConnectionSummary), DatabaseError> {
    let (opts, location, configured_db) = build_connect_options(request)?;
    let timeout_secs = request.timeout_seconds.unwrap_or(10).clamp(2, 60);
    let timeout_duration = Duration::from_secs(timeout_secs);

    let pool = match tokio::time::timeout(
        timeout_duration,
        MySqlPoolOptions::new()
            .max_connections(6)
            .acquire_timeout(timeout_duration)
            .connect_with(opts),
    )
    .await
    {
        Ok(Ok(p)) => p,
        Ok(Err(e)) => return Err(DatabaseError::Sqlx(e)),
        Err(_) => {
            return Err(DatabaseError::Timeout(format!(
                "MySQL connection timed out after {timeout_secs} seconds"
            )));
        }
    };

    let version: Option<String> = sqlx::query_scalar("SELECT CAST(VERSION() AS CHAR)")
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();
    let active_db: Option<String> = sqlx::query_scalar("SELECT CAST(DATABASE() AS CHAR)")
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten()
        .filter(|s: &String| !s.trim().is_empty());

    let engine_label = if version
        .as_deref()
        .map(|v| v.to_ascii_lowercase().contains("mariadb"))
        .unwrap_or(false)
    {
        "MariaDB".to_string()
    } else {
        "MySQL".to_string()
    };

    let id = request
        .connection_id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| next_unique_id("my"));

    let summary = ConnectionSummary {
        id,
        name: request.name.trim().to_string(),
        engine: engine_label,
        engine_kind: DatabaseEngine::Mysql,
        read_only: request.read_only,
        location,
        current_database: active_db.or(configured_db),
        server_version: version,
        connected_at_ms: now_millis(),
        environment: request.environment.unwrap_or_default(),
    };

    Ok((pool, summary))
}

pub async fn connect(request: &ConnectionRequest) -> Result<ManagedConnection, DatabaseError> {
    let (pool, summary) = build_pool(request).await?;
    Ok(ManagedConnection {
        pool: EnginePool::Mysql(pool),
        summary,
        engine: DatabaseEngine::Mysql,
    })
}

pub async fn test_connection(
    request: &ConnectionRequest,
) -> Result<ConnectionSummary, DatabaseError> {
    let (pool, summary) = build_pool(request).await?;
    pool.close().await;
    Ok(summary)
}
