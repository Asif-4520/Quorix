use sqlx::{Row, SqlitePool};

use crate::drivers::DatabaseError;

pub async fn get_maintenance_info(
    pool: &SqlitePool,
    file_path: &str,
    integrity_status: Option<String>,
    wal_checkpoint_result: Option<String>,
) -> Result<crate::models::SqliteMaintenanceInfo, DatabaseError> {
    let page_count: i64 = sqlx::query_scalar("PRAGMA page_count")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let freelist_count: i64 = sqlx::query_scalar("PRAGMA freelist_count")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let page_size: i64 = sqlx::query_scalar("PRAGMA page_size")
        .fetch_one(pool)
        .await
        .unwrap_or(4096);
    let journal_mode: String = sqlx::query_scalar("PRAGMA journal_mode")
        .fetch_one(pool)
        .await
        .unwrap_or_else(|_| "unknown".to_string());
    let synchronous: i64 = sqlx::query_scalar("PRAGMA synchronous")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let auto_vacuum: i64 = sqlx::query_scalar("PRAGMA auto_vacuum")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let foreign_keys: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let user_version: i64 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let application_id: i64 = sqlx::query_scalar("PRAGMA application_id")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let trimmed = file_path.trim();
    let is_memory = trimmed.is_empty() || trimmed.eq_ignore_ascii_case(":memory:");
    let file_size_bytes = if !is_memory {
        std::fs::metadata(trimmed)
            .map(|m| m.len())
            .unwrap_or_else(|_| page_count.max(0) as u64 * page_size.max(0) as u64)
    } else {
        page_count.max(0) as u64 * page_size.max(0) as u64
    };
    let wal_size_bytes = if !is_memory {
        let wal_path = format!("{trimmed}-wal");
        std::fs::metadata(&wal_path).ok().map(|m| m.len())
    } else {
        None
    };

    Ok(crate::models::SqliteMaintenanceInfo {
        file_path: file_path.to_string(),
        file_size_bytes,
        freelist_count,
        page_count,
        page_size,
        journal_mode,
        synchronous,
        auto_vacuum,
        foreign_keys: foreign_keys != 0,
        user_version,
        application_id,
        wal_size_bytes,
        wal_checkpoint_result,
        integrity_status,
    })
}

pub async fn run_maintenance(
    pool: &SqlitePool,
    file_path: &str,
    action: &str,
    read_only: bool,
) -> Result<crate::models::SqliteMaintenanceInfo, DatabaseError> {
    let mut integrity_status: Option<String> = None;
    let mut wal_checkpoint_result: Option<String> = None;

    match action.trim().to_ascii_lowercase().as_str() {
        "vacuum" => {
            if read_only {
                return Err(DatabaseError::ReadOnly);
            }
            sqlx::query("VACUUM").execute(pool).await?;
        }
        "analyze" => {
            if read_only {
                return Err(DatabaseError::ReadOnly);
            }
            sqlx::query("ANALYZE").execute(pool).await?;
        }
        "reindex" => {
            if read_only {
                return Err(DatabaseError::ReadOnly);
            }
            sqlx::query("REINDEX").execute(pool).await?;
        }
        "wal_checkpoint" => {
            if read_only {
                return Err(DatabaseError::ReadOnly);
            }
            let row = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
                .fetch_optional(pool)
                .await?;
            if let Some(r) = row {
                let busy: i64 = r.try_get(0).unwrap_or(0);
                let log: i64 = r.try_get(1).unwrap_or(0);
                let checkpointed: i64 = r.try_get(2).unwrap_or(0);
                wal_checkpoint_result = Some(format!(
                    "busy={busy}, log={log}, checkpointed={checkpointed}"
                ));
            }
        }
        "integrity_check" => {
            let messages: Vec<String> = sqlx::query_scalar("PRAGMA integrity_check")
                .fetch_all(pool)
                .await?;
            integrity_status = Some(if messages.is_empty() {
                "ok".to_string()
            } else {
                messages.join("\n")
            });
        }
        other => {
            return Err(DatabaseError::InvalidValue(format!(
                "Unsupported SQLite maintenance action: {other}"
            )));
        }
    }

    get_maintenance_info(pool, file_path, integrity_status, wal_checkpoint_result).await
}

pub fn format_bytes(bytes: i64) -> String {
    if bytes < 1024 {
        return format!("{bytes} B");
    }
    let kb = bytes as f64 / 1024.0;
    if kb < 1024.0 {
        return format!("{kb:.1} KB");
    }
    let mb = kb / 1024.0;
    if mb < 1024.0 {
        return format!("{mb:.1} MB");
    }
    format!("{:.2} GB", mb / 1024.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn sqlite_maintenance_reads_pragmas_and_runs_checks() {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open memory sqlite");
        sqlx::query("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO items VALUES (1, 'ok');")
            .execute(&pool)
            .await
            .expect("seed table");

        let info = get_maintenance_info(&pool, ":memory:", None, None)
            .await
            .expect("maintenance info");
        assert!(info.page_size > 0);
        assert!(info.page_count >= 1);

        let checked = run_maintenance(&pool, ":memory:", "integrity_check", false)
            .await
            .expect("integrity check");
        assert_eq!(checked.integrity_status.as_deref(), Some("ok"));

        let vacuumed = run_maintenance(&pool, ":memory:", "vacuum", false)
            .await
            .expect("vacuum");
        assert!(vacuumed.page_count >= 1);

        let ro_err = run_maintenance(&pool, ":memory:", "vacuum", true).await;
        assert!(matches!(ro_err, Err(DatabaseError::ReadOnly)));
    }
}
