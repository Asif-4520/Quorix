import type {
  ConnectionRequest,
  ConnectionSummary,
  CreateIndexRequest,
  CreateTableRequest,
  DatabaseOverviewResponse,
  DropIndexRequest,
  DropTableRequest,
  ExplainResponse,
  ExportRequest,
  ExportResponse,
  ImportRequest,
  ImportResponse,
  MultiQueryResponse,
  QueryRequest,
  QueryResponse,
  SchemaInfo,
  SchemaIntrospection,
  SchemaObjectsResponse,
  SqliteMaintenanceInfo,
  TableChangeBatchRequest,
  TableDataRequest,
  TableDetailsResponse,
  TruncateTableRequest,
} from '../../types/database';
import { invoke, withTimeout } from './client';

export async function connectDatabase(request: ConnectionRequest): Promise<ConnectionSummary> {
  const timeoutSeconds = request.timeoutSeconds || 10;
  return await withTimeout(
    invoke<ConnectionSummary>('connect_database', { request }),
    (timeoutSeconds + 2) * 1000,
    'Database connection',
  );
}

export async function testDatabaseConnection(
  request: ConnectionRequest,
): Promise<ConnectionSummary> {
  const timeoutSeconds = request.timeoutSeconds || 8;
  return await withTimeout(
    invoke<ConnectionSummary>('test_database_connection', { request }),
    (timeoutSeconds + 2) * 1000,
    'Database connection test',
  );
}

export async function disconnectDatabase(connectionId?: string): Promise<void> {
  return await invoke<void>('disconnect_database', { connectionId });
}

export async function setActiveConnection(connectionId: string): Promise<void> {
  return await invoke<void>('set_active_connection', { connectionId });
}

export async function listActiveConnections(): Promise<ConnectionSummary[]> {
  return await invoke<ConnectionSummary[]>('list_active_connections');
}

export async function getDatabaseOverview(
  connectionId?: string,
): Promise<DatabaseOverviewResponse> {
  return await invoke<DatabaseOverviewResponse>('get_database_overview', { connectionId });
}

export async function listSchemas(connectionId?: string): Promise<SchemaInfo[]> {
  return await invoke<SchemaInfo[]>('list_schemas', { connectionId });
}

export async function listSchemaObjects(
  schema: string,
  connectionId?: string,
): Promise<SchemaObjectsResponse> {
  return await invoke<SchemaObjectsResponse>('list_schema_objects', { connectionId, schema });
}

export async function getTableDetails(
  table: string,
  schema?: string,
  connectionId?: string,
): Promise<TableDetailsResponse> {
  return await invoke<TableDetailsResponse>('get_table_details', {
    connectionId,
    table,
    schema,
  });
}

export async function introspectSchema(connectionId?: string): Promise<SchemaIntrospection> {
  return await invoke<SchemaIntrospection>('introspect_schema', { connectionId });
}

export async function executeQuery(request: QueryRequest): Promise<MultiQueryResponse> {
  return await invoke<MultiQueryResponse>('execute_query', { request });
}

export async function cancelQuery(queryId: string): Promise<boolean> {
  return await invoke<boolean>('cancel_query', { queryId });
}

export async function explainQuery(
  sql: string,
  connectionId?: string,
  analyze = true,
): Promise<ExplainResponse> {
  return await invoke<ExplainResponse>('explain_query', { connectionId, sql, analyze });
}

export async function getTableData(request: TableDataRequest): Promise<QueryResponse> {
  return await invoke<QueryResponse>('get_table_data', { request });
}

export async function applyTableChanges(request: TableChangeBatchRequest): Promise<number> {
  return await invoke<number>('apply_table_changes', { request });
}

export async function createTable(request: CreateTableRequest): Promise<void> {
  return await invoke<void>('create_table', { request });
}

export async function dropTable(request: DropTableRequest): Promise<void> {
  return await invoke<void>('drop_table', { request });
}

export async function truncateTable(request: TruncateTableRequest): Promise<void> {
  return await invoke<void>('truncate_table', { request });
}

export async function createIndex(request: CreateIndexRequest): Promise<void> {
  return await invoke<void>('create_index', { request });
}

export async function dropIndex(request: DropIndexRequest): Promise<void> {
  return await invoke<void>('drop_index', { request });
}

export async function exportData(request: ExportRequest): Promise<ExportResponse> {
  return await invoke<ExportResponse>('export_data', { request });
}

export async function importData(request: ImportRequest): Promise<ImportResponse> {
  return await invoke<ImportResponse>('import_data', { request });
}

export type SqliteMaintenanceAction =
  | 'vacuum'
  | 'analyze'
  | 'reindex'
  | 'wal_checkpoint'
  | 'integrity_check';

export async function getSqliteMaintenanceInfo(
  connectionId?: string,
): Promise<SqliteMaintenanceInfo> {
  return await invoke<SqliteMaintenanceInfo>('get_sqlite_maintenance_info', { connectionId });
}

export async function runSqliteMaintenance(
  action: SqliteMaintenanceAction,
  connectionId?: string,
): Promise<SqliteMaintenanceInfo> {
  return await invoke<SqliteMaintenanceInfo>('run_sqlite_maintenance', { action, connectionId });
}
