use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseEngine {
    Sqlite,
    Postgres,
    Mysql,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionEnvironment {
    #[default]
    Local,
    Staging,
    Production,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionRequest {
    pub connection_id: Option<String>,
    pub engine: DatabaseEngine,
    pub name: String,
    pub path: Option<String>,
    pub create_if_missing: Option<bool>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub user: Option<String>,
    pub password: Option<String>,
    pub database: Option<String>,
    pub ssl_mode: Option<String>,
    pub timeout_seconds: Option<u64>,
    pub url: Option<String>,
    pub read_only: bool,
    pub pgbouncer_mode: Option<bool>,
    pub advanced_options: Option<HashMap<String, String>>,
    #[serde(default)]
    pub environment: Option<ConnectionEnvironment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionSummary {
    pub id: String,
    pub name: String,
    pub engine: String,
    pub engine_kind: DatabaseEngine,
    pub read_only: bool,
    pub location: String,
    pub current_database: Option<String>,
    pub server_version: Option<String>,
    pub connected_at_ms: u64,
    #[serde(default)]
    pub environment: ConnectionEnvironment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteMaintenanceInfo {
    pub file_path: String,
    pub file_size_bytes: u64,
    pub freelist_count: i64,
    pub page_count: i64,
    pub page_size: i64,
    pub journal_mode: String,
    pub synchronous: i64,
    pub auto_vacuum: i64,
    pub foreign_keys: bool,
    pub user_version: i64,
    pub application_id: i64,
    pub wal_size_bytes: Option<u64>,
    pub wal_checkpoint_result: Option<String>,
    pub integrity_status: Option<String>,
}
