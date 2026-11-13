import type { FilterRule } from './query';
import type { ColumnInfo } from './schema';

export type TableSubTab =
  | 'data'
  | 'structure'
  | 'relations'
  | 'indexes'
  | 'constraints'
  | 'statistics'
  | 'ddl';

export interface TabItem {
  id: string;
  title: string;
  type: 'table' | 'sql' | 'er-diagram' | 'database-info' | 'schema-info' | 'schema-diff';
  connectionId?: string;
  sourceConnectionId?: string;
  targetConnectionId?: string;
  tableName?: string;
  schema?: string;
  tableKind?: string;
  sqlContent?: string;
  savedQueryId?: string;
  activeSubTab?: TableSubTab;
  initialFilters?: FilterRule[];
  pinned?: boolean;
  isDirty?: boolean;
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  connectionId?: string;
  connectionName?: string;
  timestamp: number;
  durationMs: number;
  status: 'success' | 'error' | 'cancelled';
  rowsCount?: number;
  errorMessage?: string;
}

export interface SavedQuery {
  id: string;
  title: string;
  sql: string;
  folder?: string;
  favorite?: boolean;
  connectionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FavoriteObject {
  id: string;
  connectionId: string;
  connectionName: string;
  schema?: string;
  name: string;
  kind: 'table' | 'view' | 'materialized_view' | 'query';
  addedAt: number;
}

export interface RecentObject {
  id: string;
  connectionId: string;
  connectionName: string;
  schema?: string;
  name: string;
  kind: string;
  openedAt: number;
}

export type ThemeName =
  | 'obsidian-dark'
  | 'datagrip-dark'
  | 'midnight'
  | 'graphite'
  | 'pearl-light'
  | 'snow-light'
  | 'soft-light';

export type ThemeMode = 'system' | 'dark' | 'light';

export type InspectorTarget =
  | {
      kind: 'row';
      connectionId: string;
      tableName: string;
      schema?: string;
      rowIndex: number;
      row: (string | null)[];
      columns: string[];
      columnMeta: ColumnInfo[];
      selectedColName: string;
      readOnly: boolean;
      autoStartEdit?: boolean;
      editRequestId?: number;
      onSaveField?: (colName: string, newVal: string | null) => Promise<void> | void;
    }
  | {
      kind: 'object';
      objectType: 'database' | 'schema' | 'function' | 'sequence' | 'enum' | 'extension' | 'column';
      title: string;
      subtitle?: string;
      details: Record<string, string | number | boolean | string[] | null | undefined>;
      definition?: string | null;
    };
