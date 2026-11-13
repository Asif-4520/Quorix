import type { ConnectionSummary } from './connection';

export interface DatabaseInfo {
  name: string;
  owner?: string;
  encoding?: string;
  sizeBytes?: number;
  sizePretty?: string;
}

export interface SchemaInfo {
  name: string;
  owner?: string;
  isSystem: boolean;
  tableCount: number;
  viewCount: number;
}

export interface TableInfo {
  name: string;
  schema?: string;
  kind: 'table' | 'view' | 'materialized_view' | 'foreign_table' | 'partitioned_table' | string;
  rowCountEstimate?: number;
  comment?: string | null;
  hasPrimaryKey: boolean;
  isStrict: boolean;
  withoutRowid: boolean;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  udtName?: string;
  nullable: boolean;
  primaryKey: boolean;
  isUnique: boolean;
  isIdentity: boolean;
  isGenerated: boolean;
  generationExpression?: string | null;
  autoIncrement: boolean;
  defaultValue?: string | null;
  ordinalPosition: number;
  comment?: string | null;
  enumValues: string[];
}

export interface IndexInfo {
  name: string;
  schema?: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  indexType?: string;
  isPartial: boolean;
  predicate?: string | null;
  definition?: string | null;
}

export interface ConstraintInfo {
  name: string;
  constraintType: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'EXCLUSION' | string;
  columns: string[];
  definition: string;
  referencedTable?: string | null;
  referencedColumns: string[];
}

export interface ForeignKeyInfo {
  name?: string;
  fromSchema?: string;
  fromTable: string;
  fromColumn: string;
  toSchema?: string;
  toTable: string;
  toColumn: string;
  onUpdate?: string;
  onDelete?: string;
  direction: 'outgoing' | 'incoming' | string;
}

export interface TriggerInfo {
  name: string;
  tableName: string;
  event: string;
  timing: string;
  definition?: string | null;
}

export interface FunctionInfo {
  name: string;
  schema?: string;
  kind: 'function' | 'procedure' | string;
  returnType: string;
  arguments: string;
  language?: string;
  definition?: string | null;
}

export interface SequenceInfo {
  name: string;
  schema?: string;
  dataType: string;
  startValue?: number;
  incrementBy?: number;
  minValue?: number;
  maxValue?: number;
  lastValue?: number;
}

export interface EnumTypeInfo {
  name: string;
  schema?: string;
  values: string[];
}

export interface ExtensionInfo {
  name: string;
  version: string;
  schema?: string;
  description?: string | null;
}

export interface TableStatistics {
  rowCountEstimate?: number;
  exactRowCount?: number;
  tableSizeBytes?: number;
  indexesSizeBytes?: number;
  totalSizeBytes?: number;
  tableSizePretty?: string;
  indexesSizePretty?: string;
  totalSizePretty?: string;
  lastVacuum?: string | null;
  lastAnalyze?: string | null;
}

export interface SchemaObjectsResponse {
  schema: string;
  tables: TableInfo[];
  views: TableInfo[];
  materializedViews: TableInfo[];
  functions: FunctionInfo[];
  sequences: SequenceInfo[];
  enumTypes: EnumTypeInfo[];
  triggers: TriggerInfo[];
}

export interface TableDetailsResponse {
  table: TableInfo;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  foreignKeys: ForeignKeyInfo[];
  triggers: TriggerInfo[];
  statistics: TableStatistics;
  ddl: string;
  editable: boolean;
  readonlyReason?: string | null;
  primaryKeyColumns: string[];
  usesRowid: boolean;
}

export interface DatabaseOverviewResponse {
  summary: ConnectionSummary;
  databases: DatabaseInfo[];
  schemas: SchemaInfo[];
  extensions: ExtensionInfo[];
}

export interface SchemaIntrospection {
  schemas: SchemaInfo[];
  tables: TableInfo[];
  columns: Record<string, ColumnInfo[]>;
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
  triggers: TriggerInfo[];
  functions: FunctionInfo[];
  sequences: SequenceInfo[];
  enumTypes: EnumTypeInfo[];
  extensions: ExtensionInfo[];
}
