export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_or_equal'
  | 'less_than'
  | 'less_or_equal'
  | 'between'
  | 'in_list'
  | 'is_null'
  | 'is_not_null';

export interface FilterRule {
  id: string;
  column?: string;
  operator: FilterOperator;
  value?: string;
  value2?: string;
  enabled?: boolean;
}

export interface QueryRequest {
  connectionId?: string;
  sql: string;
  page?: number;
  pageSize?: number;
  maxRows?: number;
  queryId?: string;
}

export interface QueryResponse {
  queryId: string;
  columns: string[];
  columnTypes: string[];
  rows: (string | null)[][];
  affectedRows: number;
  durationMs: number;
  totalRows?: number;
  truncated: boolean;
  statementType: string;
  usesRowid: boolean;
}

export interface MultiQueryResponse {
  queryId: string;
  results: QueryResponse[];
  totalDurationMs: number;
}

export type QueryResult = QueryResponse;

export interface ExplainResponse {
  plan: string[];
  durationMs: number;
  mode?: 'analyze' | 'estimate' | 'query_plan' | string;
  safetyNotice?: string;
}

export interface TableDataRequest {
  connectionId?: string;
  table: string;
  schema?: string;
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortDesc: boolean;
  searchQuery?: string;
  filters?: Array<Omit<FilterRule, 'id' | 'enabled'>>;
  filterLogic?: 'and' | 'or';
  includeTotalCount?: boolean;
}

export interface TableMutationItem {
  operation: 'update' | 'insert' | 'delete';
  primaryKey?: Record<string, string | null>;
  rowid?: number;
  column?: string;
  value?: string | null;
  row?: Record<string, string | null>;
}

export interface TableChangeBatchRequest {
  connectionId?: string;
  table: string;
  schema?: string;
  mutations: TableMutationItem[];
}

export interface ColumnDefinition {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
  autoIncrement: boolean;
}

export interface CreateTableRequest {
  connectionId?: string;
  name: string;
  schema?: string;
  columns: ColumnDefinition[];
}

export interface DropTableRequest {
  connectionId?: string;
  name: string;
  schema?: string;
  cascade: boolean;
}

export interface TruncateTableRequest {
  connectionId?: string;
  name: string;
  schema?: string;
}

export interface CreateIndexRequest {
  connectionId?: string;
  table: string;
  schema?: string;
  indexName: string;
  columns: string[];
  unique: boolean;
  method?: string;
}

export interface DropIndexRequest {
  connectionId?: string;
  indexName: string;
  schema?: string;
}

export interface ExportRequest {
  connectionId?: string;
  sql?: string;
  table?: string;
  schema?: string;
  format: 'csv' | 'json';
  outputPath?: string;
  searchQuery?: string;
  filters?: Array<Omit<FilterRule, 'id' | 'enabled'>>;
  filterLogic?: 'and' | 'or';
  sortColumn?: string;
  sortDesc?: boolean;
}

export interface ExportResponse {
  content: string;
  rowCount: number;
  format: string;
  savedPath?: string;
}

export interface ImportRequest {
  connectionId?: string;
  table: string;
  schema?: string;
  format: 'csv' | 'json';
  content: string;
}

export interface ImportResponse {
  importedRows: number;
  durationMs: number;
}
