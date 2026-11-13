use std::str::FromStr;
use std::time::Duration;

use sqlx::PgPool;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions, PgSslMode};

use crate::drivers::{DatabaseError, EnginePool, now_millis};
use crate::models::{ConnectionRequest, ConnectionSummary, DatabaseEngine};
use crate::state::{ManagedConnection, next_unique_id};

fn parse_ssl_mode(mode: Option<&str>) -> PgSslMode {
    match mode.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("disable") => PgSslMode::Disable,
        Some("allow") => PgSslMode::Allow,
        Some("require") => PgSslMode::Require,
        Some("verify-ca") => PgSslMode::VerifyCa,
        Some("verify-full") => PgSslMode::VerifyFull,
        _ => PgSslMode::Prefer,
    }
}

pub fn build_connect_options(
    request: &ConnectionRequest,
) -> Result<(PgConnectOptions, String, Option<String>), DatabaseError> {
    if request.name.trim().is_empty() {
        return Err(DatabaseError::MissingName);
    }

    let mut opts = if let Some(ref raw_url) = request.url {
        let trimmed = raw_url.trim();
        if !trimmed.is_empty() {
            let normalized = if trimmed.starts_with("postgresql://") {
                trimmed.replacen("postgresql://", "postgres://", 1)
            } else {
                trimmed.to_string()
            };
            let mut parsed = PgConnectOptions::from_str(&normalized)
                .map_err(|e| DatabaseError::InvalidUrl(e.to_string()))?;
            if let Some(ref pwd) = request.password {
                if !pwd.is_empty() {
                    parsed = parsed.password(pwd);
                }
            }
            if let Some(ref ssl) = request.ssl_mode {
                if !ssl.trim().is_empty() {
                    parsed = parsed.ssl_mode(parse_ssl_mode(Some(ssl)));
                }
            }
            parsed
        } else {
            build_options_from_fields(request)?
        }
    } else {
        build_options_from_fields(request)?
    };

    opts = opts.application_name("Quorix");

    if request.pgbouncer_mode.unwrap_or(false) {
        opts = opts.statement_cache_capacity(0);
    }

    if let Some(ref adv) = request.advanced_options {
        let pairs: Vec<(String, String)> = adv
            .iter()
            .filter(|(k, v)| !k.trim().is_empty() && !v.trim().is_empty())
            .map(|(k, v)| (k.trim().to_string(), v.trim().to_string()))
            .collect();
        if !pairs.is_empty() {
            opts = opts.options(pairs);
        }
    }

    let location = format!("{}:{}", opts.get_host(), opts.get_port());
    let db = opts.get_database().map(|s| s.to_string());
    Ok((opts, location, db))
}

fn build_options_from_fields(
    request: &ConnectionRequest,
) -> Result<PgConnectOptions, DatabaseError> {
    let host = request
        .host
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or(DatabaseError::MissingPostgresFields)?;
    let user = request
        .user
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or(DatabaseError::MissingPostgresFields)?;
    let database = request
        .database
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or(DatabaseError::MissingPostgresFields)?;

    let mut opts = PgConnectOptions::new_without_pgpass()
        .host(host)
        .port(request.port.unwrap_or(5432))
        .username(user)
        .database(database)
        .ssl_mode(parse_ssl_mode(request.ssl_mode.as_deref()));

    if let Some(ref password) = request.password {
        if !password.is_empty() {
            opts = opts.password(password);
        }
    }

    Ok(opts)
}

async fn build_pool(
    request: &ConnectionRequest,
) -> Result<(PgPool, ConnectionSummary), DatabaseError> {
    let (opts, location, current_db) = build_connect_options(request)?;
    let timeout_secs = request.timeout_seconds.unwrap_or(10).clamp(2, 60);
    let timeout_duration = Duration::from_secs(timeout_secs);

    let pool = match tokio::time::timeout(
        timeout_duration,
        PgPoolOptions::new()
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
                "PostgreSQL connection timed out after {timeout_secs} seconds"
            )));
        }
    };

    let version: Option<String> = sqlx::query_scalar("SELECT current_setting('server_version')")
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();

    let id = request
        .connection_id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| next_unique_id("pg"));

    let summary = ConnectionSummary {
        id,
        name: request.name.trim().to_string(),
        engine: "PostgreSQL".to_string(),
        engine_kind: DatabaseEngine::Postgres,
        read_only: request.read_only,
        location,
        current_database: current_db,
        server_version: version.map(|v| format!("PostgreSQL {v}")),
        connected_at_ms: now_millis(),
        environment: request.environment.unwrap_or_default(),
    };

    Ok((pool, summary))
}

pub async fn connect(request: &ConnectionRequest) -> Result<ManagedConnection, DatabaseError> {
    let (pool, summary) = build_pool(request).await?;
    Ok(ManagedConnection {
        pool: EnginePool::Postgres(pool),
        summary,
        engine: DatabaseEngine::Postgres,
    })
}

pub async fn test_connection(
    request: &ConnectionRequest,
) -> Result<ConnectionSummary, DatabaseError> {
    let (pool, summary) = build_pool(request).await?;
    pool.close().await;
    Ok(summary)
}
