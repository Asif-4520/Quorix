import type { ColumnInfo, ConnectionSummary, SavedQuery, TableInfo } from '../../types/database';

export type ContextMenuState =
  | { kind: 'connection'; x: number; y: number; conn: ConnectionSummary }
  | { kind: 'schema'; x: number; y: number; connId: string; schema: string }
  | { kind: 'table'; x: number; y: number; conn: ConnectionSummary; table: TableInfo }
  | {
      kind: 'column';
      x: number;
      y: number;
      tableName: string;
      schema?: string;
      column: ColumnInfo;
    }
  | { kind: 'query'; x: number; y: number; query: SavedQuery };
