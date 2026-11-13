use super::ConnectionSummary;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    pub name: String,
    pub owner: Option<String>,
    pub encoding: Option<String>,
    pub size_bytes: Option<i64>,
    pub size_pretty: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaInfo {
    pub name: String,
    pub owner: Option<String>,
    pub is_system: bool,
    pub table_count: i64,
    pub view_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub name: String,
    pub schema: Option<String>,
    pub kind: String,
    pub row_count_estimate: Option<i64>,
    pub comment: Option<String>,
    pub has_primary_key: bool,
    pub is_strict: bool,
    pub without_rowid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub udt_name: Option<String>,
    pub nullable: bool,
    pub primary_key: bool,
    pub is_unique: bool,
    pub is_identity: bool,
    pub is_generated: bool,
    pub generation_expression: Option<String>,
    pub auto_increment: bool,
    pub default_value: Option<String>,
    pub ordinal_position: i32,
    pub comment: Option<String>,
    pub enum_values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub name: String,
    pub schema: Option<String>,
    pub table_name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
    pub index_type: Option<String>,
    pub is_partial: bool,
    pub predicate: Option<String>,
    pub definition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConstraintInfo {
    pub name: String,
    pub constraint_type: String,
    pub columns: Vec<String>,
    pub definition: String,
    pub referenced_table: Option<String>,
    pub referenced_columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyInfo {
    pub name: Option<String>,
    pub from_schema: Option<String>,
    pub from_table: String,
    pub from_column: String,
    pub to_schema: Option<String>,
    pub to_table: String,
    pub to_column: String,
    pub on_update: Option<String>,
    pub on_delete: Option<String>,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerInfo {
    pub name: String,
    pub table_name: String,
    pub event: String,
    pub timing: String,
    pub definition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionInfo {
    pub name: String,
    pub schema: Option<String>,
    pub kind: String,
    pub return_type: String,
    pub arguments: String,
    pub language: Option<String>,
    pub definition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceInfo {
    pub name: String,
    pub schema: Option<String>,
    pub data_type: String,
    pub start_value: Option<i64>,
    pub increment_by: Option<i64>,
    pub min_value: Option<i64>,
    pub max_value: Option<i64>,
    pub last_value: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnumTypeInfo {
    pub name: String,
    pub schema: Option<String>,
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInfo {
    pub name: String,
    pub version: String,
    pub schema: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableStatistics {
    pub row_count_estimate: Option<i64>,
    pub exact_row_count: Option<i64>,
    pub table_size_bytes: Option<i64>,
    pub indexes_size_bytes: Option<i64>,
    pub total_size_bytes: Option<i64>,
    pub table_size_pretty: Option<String>,
    pub indexes_size_pretty: Option<String>,
    pub total_size_pretty: Option<String>,
    pub last_vacuum: Option<String>,
    pub last_analyze: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaObjectsResponse {
    pub schema: String,
    pub tables: Vec<TableInfo>,
    pub views: Vec<TableInfo>,
    pub materialized_views: Vec<TableInfo>,
    pub functions: Vec<FunctionInfo>,
    pub sequences: Vec<SequenceInfo>,
    pub enum_types: Vec<EnumTypeInfo>,
    pub triggers: Vec<TriggerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableDetailsResponse {
    pub table: TableInfo,
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
    pub constraints: Vec<ConstraintInfo>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
    pub triggers: Vec<TriggerInfo>,
    pub statistics: TableStatistics,
    pub ddl: String,
    pub editable: bool,
    pub readonly_reason: Option<String>,
    pub primary_key_columns: Vec<String>,
    pub uses_rowid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseOverviewResponse {
    pub summary: ConnectionSummary,
    pub databases: Vec<DatabaseInfo>,
    pub schemas: Vec<SchemaInfo>,
    pub extensions: Vec<ExtensionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaIntrospection {
    pub schemas: Vec<SchemaInfo>,
    pub tables: Vec<TableInfo>,
    pub columns: HashMap<String, Vec<ColumnInfo>>,
    pub indexes: Vec<IndexInfo>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
    pub triggers: Vec<TriggerInfo>,
    pub functions: Vec<FunctionInfo>,
    pub sequences: Vec<SequenceInfo>,
    pub enum_types: Vec<EnumTypeInfo>,
    pub extensions: Vec<ExtensionInfo>,
}
