use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterOperator {
    Equals,
    NotEquals,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    GreaterThan,
    GreaterOrEqual,
    LessThan,
    LessOrEqual,
    Between,
    InList,
    IsNull,
    IsNotNull,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterRule {
    pub column: Option<String>,
    pub operator: FilterOperator,
    pub value: Option<String>,
    pub value2: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub connection_id: Option<String>,
    pub sql: String,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub max_rows: Option<usize>,
    pub query_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResponse {
    pub query_id: String,
    pub columns: Vec<String>,
    pub column_types: Vec<String>,
    pub rows: Vec<Vec<Option<String>>>,
    pub affected_rows: u64,
    pub duration_ms: u128,
    pub total_rows: Option<u64>,
    pub truncated: bool,
    pub statement_type: String,
    pub uses_rowid: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiQueryResponse {
    pub query_id: String,
    pub results: Vec<QueryResponse>,
    pub total_duration_ms: u128,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainResponse {
    pub plan: Vec<String>,
    pub duration_ms: u128,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub safety_notice: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableDataRequest {
    pub connection_id: Option<String>,
    pub table: String,
    pub schema: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub sort_column: Option<String>,
    pub sort_desc: bool,
    pub search_query: Option<String>,
    pub filters: Option<Vec<FilterRule>>,
    pub filter_logic: Option<String>,
    pub include_total_count: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableMutationItem {
    pub operation: TableChangeOperation,
    pub primary_key: Option<HashMap<String, Option<String>>>,
    pub rowid: Option<i64>,
    pub column: Option<String>,
    pub value: Option<String>,
    pub row: Option<HashMap<String, Option<String>>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableChangeBatchRequest {
    pub connection_id: Option<String>,
    pub table: String,
    pub schema: Option<String>,
    pub mutations: Vec<TableMutationItem>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TableChangeOperation {
    Update,
    Insert,
    Delete,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDefinition {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub primary_key: bool,
    pub default_value: Option<String>,
    pub auto_increment: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableRequest {
    pub connection_id: Option<String>,
    pub name: String,
    pub schema: Option<String>,
    pub columns: Vec<ColumnDefinition>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DropTableRequest {
    pub connection_id: Option<String>,
    pub name: String,
    pub schema: Option<String>,
    pub cascade: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TruncateTableRequest {
    pub connection_id: Option<String>,
    pub name: String,
    pub schema: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIndexRequest {
    pub connection_id: Option<String>,
    pub table: String,
    pub schema: Option<String>,
    pub index_name: String,
    pub columns: Vec<String>,
    pub unique: bool,
    pub method: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DropIndexRequest {
    pub connection_id: Option<String>,
    pub index_name: String,
    pub schema: Option<String>,
}
