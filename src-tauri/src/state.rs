use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};

use sqlx::PgPool;

use crate::drivers::{DatabaseError, EnginePool};
use crate::models::{ConnectionSummary, DatabaseEngine};

static ID_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn next_unique_id(prefix: &str) -> String {
    let n = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{prefix}_{ts}_{n}")
}

#[derive(Clone)]
pub struct ManagedConnection {
    pub pool: EnginePool,
    pub summary: ConnectionSummary,
    #[allow(dead_code)]
    pub engine: DatabaseEngine,
}

#[derive(Clone)]
pub enum CancelTarget {
    Postgres {
        pool: PgPool,
        backend_pid: i32,
    },
    Sqlite(Arc<AtomicBool>),
    Mysql {
        pool: sqlx::MySqlPool,
        connection_id: u64,
    },
}

#[derive(Default)]
pub struct AppDbState {
    connections: RwLock<HashMap<String, ManagedConnection>>,
    primary_connection_id: RwLock<Option<String>>,
    active_queries: Mutex<HashMap<String, CancelTarget>>,
}

impl AppDbState {
    pub fn insert_connection(&self, entry: ManagedConnection) {
        let id = entry.summary.id.clone();
        let previous = {
            let mut map = self.connections.write().expect("connections lock poisoned");
            map.insert(id.clone(), entry)
        };
        if let Some(old) = previous {
            tokio::spawn(async move {
                old.pool.close().await;
            });
        }
        let mut primary = self
            .primary_connection_id
            .write()
            .expect("primary connection lock poisoned");
        *primary = Some(id);
    }

    pub fn set_primary_connection(&self, connection_id: &str) -> Result<(), DatabaseError> {
        let exists = {
            let map = self.connections.read().expect("connections lock poisoned");
            map.contains_key(connection_id)
        };
        if !exists {
            return Err(DatabaseError::NotConnected);
        }
        let mut primary = self
            .primary_connection_id
            .write()
            .expect("primary connection lock poisoned");
        *primary = Some(connection_id.to_string());
        Ok(())
    }

    pub fn get_connection(
        &self,
        connection_id: Option<&str>,
    ) -> Result<ManagedConnection, DatabaseError> {
        let resolved_id = match connection_id {
            Some(id) if !id.trim().is_empty() => id.to_string(),
            _ => {
                let primary = self
                    .primary_connection_id
                    .read()
                    .expect("primary connection lock poisoned");
                primary.clone().ok_or(DatabaseError::NotConnected)?
            }
        };

        let map = self.connections.read().expect("connections lock poisoned");
        map.get(&resolved_id)
            .cloned()
            .ok_or(DatabaseError::NotConnected)
    }

    pub async fn remove_connection(
        &self,
        connection_id: Option<&str>,
    ) -> Result<(), DatabaseError> {
        let target_id = match connection_id {
            Some(id) if !id.trim().is_empty() => id.to_string(),
            _ => {
                let primary = self
                    .primary_connection_id
                    .read()
                    .expect("primary connection lock poisoned");
                match primary.clone() {
                    Some(id) => id,
                    None => return Ok(()),
                }
            }
        };

        let removed = {
            let mut map = self.connections.write().expect("connections lock poisoned");
            map.remove(&target_id)
        };

        if let Some(entry) = removed {
            entry.pool.close().await;
        }

        let remaining_id = {
            let map = self.connections.read().expect("connections lock poisoned");
            map.keys().next().cloned()
        };

        let mut primary = self
            .primary_connection_id
            .write()
            .expect("primary connection lock poisoned");
        if primary.as_deref() == Some(target_id.as_str()) {
            *primary = remaining_id;
        }

        Ok(())
    }

    pub fn list_connections(&self) -> Vec<ConnectionSummary> {
        let map = self.connections.read().expect("connections lock poisoned");
        let mut items: Vec<ConnectionSummary> = map.values().map(|c| c.summary.clone()).collect();
        items.sort_by(|a, b| a.connected_at_ms.cmp(&b.connected_at_ms));
        items
    }

    pub fn register_cancel(&self, query_id: &str, target: CancelTarget) {
        let mut map = self
            .active_queries
            .lock()
            .expect("active_queries lock poisoned");
        map.insert(query_id.to_string(), target);
    }

    pub fn unregister_cancel(&self, query_id: &str) {
        let mut map = self
            .active_queries
            .lock()
            .expect("active_queries lock poisoned");
        map.remove(query_id);
    }

    pub async fn cancel_query(&self, query_id: &str) -> Result<bool, DatabaseError> {
        let target = {
            let map = self
                .active_queries
                .lock()
                .expect("active_queries lock poisoned");
            map.get(query_id).cloned()
        };

        match target {
            Some(CancelTarget::Sqlite(flag)) => {
                flag.store(true, Ordering::Relaxed);
                Ok(true)
            }
            Some(CancelTarget::Postgres { pool, backend_pid }) => {
                let cancelled: bool = sqlx::query_scalar("SELECT pg_cancel_backend($1)")
                    .bind(backend_pid)
                    .fetch_one(&pool)
                    .await
                    .unwrap_or(false);
                Ok(cancelled)
            }
            Some(CancelTarget::Mysql {
                pool,
                connection_id,
            }) => {
                let sql = "KILL QUERY ?";
                let ok = sqlx::query(sql)
                    .bind(connection_id as i64)
                    .execute(&pool)
                    .await
                    .is_ok();
                Ok(ok)
            }
            None => Ok(false),
        }
    }
}
