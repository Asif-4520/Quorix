mod credentials;
mod drivers;
mod export_import;
mod models;
mod state;

use models::{
    ConnectionRequest, ConnectionSummary, CreateIndexRequest, CreateTableRequest,
    DatabaseOverviewResponse, DropIndexRequest, DropTableRequest, ExplainResponse, ExportRequest,
    ExportResponse, ImportRequest, ImportResponse, MultiQueryResponse, QueryRequest, QueryResponse,
    SchemaInfo, SchemaIntrospection, SchemaObjectsResponse, TableChangeBatchRequest,
    TableDataRequest, TableDetailsResponse, TruncateTableRequest,
};
use state::AppDbState;

#[tauri::command]
async fn connect_database(
    state: tauri::State<'_, AppDbState>,
    request: ConnectionRequest,
) -> Result<ConnectionSummary, String> {
    drivers::connect_and_register(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_database_connection(request: ConnectionRequest) -> Result<ConnectionSummary, String> {
    drivers::test_connection(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn disconnect_database(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
) -> Result<(), String> {
    state
        .remove_connection(connection_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_active_connection(
    state: tauri::State<'_, AppDbState>,
    connection_id: String,
) -> Result<(), String> {
    state
        .set_primary_connection(&connection_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_active_connections(
    state: tauri::State<'_, AppDbState>,
) -> Result<Vec<ConnectionSummary>, String> {
    Ok(state.list_connections())
}

#[tauri::command]
async fn get_database_overview(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
) -> Result<DatabaseOverviewResponse, String> {
    drivers::get_database_overview(&state, connection_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_schemas(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
) -> Result<Vec<SchemaInfo>, String> {
    drivers::list_schemas(&state, connection_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_schema_objects(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
    schema: String,
) -> Result<SchemaObjectsResponse, String> {
    drivers::list_schema_objects(&state, connection_id.as_deref(), &schema)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_table_details(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
    table: String,
    schema: Option<String>,
) -> Result<TableDetailsResponse, String> {
    drivers::get_table_details(&state, connection_id.as_deref(), &table, schema.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn introspect_schema(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
) -> Result<SchemaIntrospection, String> {
    drivers::introspect_schema(&state, connection_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn execute_query(
    state: tauri::State<'_, AppDbState>,
    request: QueryRequest,
) -> Result<MultiQueryResponse, String> {
    drivers::execute_query(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_query(
    state: tauri::State<'_, AppDbState>,
    query_id: String,
) -> Result<bool, String> {
    state
        .cancel_query(&query_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn explain_query(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
    sql: String,
    analyze: Option<bool>,
) -> Result<ExplainResponse, String> {
    drivers::explain_query(
        &state,
        connection_id.as_deref(),
        &sql,
        analyze.unwrap_or(true),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_table_data(
    state: tauri::State<'_, AppDbState>,
    request: TableDataRequest,
) -> Result<QueryResponse, String> {
    drivers::get_table_data(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn apply_table_changes(
    state: tauri::State<'_, AppDbState>,
    request: TableChangeBatchRequest,
) -> Result<u64, String> {
    drivers::apply_table_changes(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_table(
    state: tauri::State<'_, AppDbState>,
    request: CreateTableRequest,
) -> Result<(), String> {
    drivers::create_table(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn drop_table(
    state: tauri::State<'_, AppDbState>,
    request: DropTableRequest,
) -> Result<(), String> {
    drivers::drop_table(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn truncate_table(
    state: tauri::State<'_, AppDbState>,
    request: TruncateTableRequest,
) -> Result<(), String> {
    drivers::truncate_table(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_index(
    state: tauri::State<'_, AppDbState>,
    request: CreateIndexRequest,
) -> Result<(), String> {
    drivers::create_index(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn drop_index(
    state: tauri::State<'_, AppDbState>,
    request: DropIndexRequest,
) -> Result<(), String> {
    drivers::drop_index(&state, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_data(
    state: tauri::State<'_, AppDbState>,
    request: ExportRequest,
) -> Result<ExportResponse, String> {
    export_import::export_data(&state, &request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_data(
    state: tauri::State<'_, AppDbState>,
    request: ImportRequest,
) -> Result<ImportResponse, String> {
    export_import::import_data(&state, &request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn store_credential(connection_id: String, password: String) -> Result<(), String> {
    credentials::store_password(&connection_id, &password)
}

#[tauri::command]
async fn get_credential(connection_id: String) -> Result<Option<String>, String> {
    credentials::get_password(&connection_id)
}

#[tauri::command]
async fn delete_credential(connection_id: String) -> Result<(), String> {
    credentials::delete_password(&connection_id)
}

#[tauri::command]
async fn get_sqlite_maintenance_info(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
) -> Result<models::SqliteMaintenanceInfo, String> {
    drivers::get_sqlite_maintenance_info(&state, connection_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn run_sqlite_maintenance(
    state: tauri::State<'_, AppDbState>,
    connection_id: Option<String>,
    action: String,
) -> Result<models::SqliteMaintenanceInfo, String> {
    drivers::run_sqlite_maintenance(&state, connection_id.as_deref(), &action)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_text_file(path: String, content: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("File path cannot be empty".to_string());
    }
    std::fs::write(trimmed, content)
        .map_err(|e| format!("Failed writing file to {trimmed}: {e}"))?;
    Ok(trimmed.to_string())
}

#[tauri::command]
async fn save_binary_file(path: String, bytes: Vec<u8>) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("File path cannot be empty".to_string());
    }
    std::fs::write(trimmed, bytes).map_err(|e| format!("Failed writing file to {trimmed}: {e}"))?;
    Ok(trimmed.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    sqlx::any::install_default_drivers();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppDbState::default())
        .invoke_handler(tauri::generate_handler![
            connect_database,
            test_database_connection,
            disconnect_database,
            set_active_connection,
            list_active_connections,
            get_database_overview,
            list_schemas,
            list_schema_objects,
            get_table_details,
            introspect_schema,
            execute_query,
            cancel_query,
            explain_query,
            get_table_data,
            apply_table_changes,
            create_table,
            drop_table,
            truncate_table,
            create_index,
            drop_index,
            export_data,
            import_data,
            store_credential,
            get_credential,
            delete_credential,
            get_sqlite_maintenance_info,
            run_sqlite_maintenance,
            save_text_file,
            save_binary_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests;
