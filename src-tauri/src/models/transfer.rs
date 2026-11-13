use super::FilterRule;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub connection_id: Option<String>,
    pub sql: Option<String>,
    pub table: Option<String>,
    pub schema: Option<String>,
    pub format: String,
    pub output_path: Option<String>,
    pub search_query: Option<String>,
    pub filters: Option<Vec<FilterRule>>,
    pub filter_logic: Option<String>,
    pub sort_column: Option<String>,
    pub sort_desc: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResponse {
    pub content: String,
    pub row_count: usize,
    pub format: String,
    pub saved_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequest {
    pub connection_id: Option<String>,
    pub table: String,
    pub schema: Option<String>,
    pub format: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResponse {
    pub imported_rows: usize,
    pub duration_ms: u128,
}
