import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { Key, Link2, Table } from 'lucide-react';
import { memo } from 'react';
import type { ColumnInfo, TableInfo } from '../../types/database';

export const NODE_WIDTH = 250;

export interface SchemaNodeData extends Record<string, unknown> {
  table: TableInfo;
  columns: ColumnInfo[];
  fkColumns: string[];
  showColumns: boolean;
  dimmed: boolean;
  highlighted: boolean;
  onOpenTable: (table: TableInfo) => void;
}

export const DatabaseSchemaNode = memo(({ data, selected }: NodeProps<Node<SchemaNodeData>>) => {
  const { table, columns, fkColumns, showColumns, dimmed, highlighted, onOpenTable } = data;
  const visibleCols = showColumns
    ? columns
    : columns.filter((c) => c.primaryKey || fkColumns.includes(c.name));

  return (
    <div
      onDoubleClick={() => onOpenTable(table)}
      className={`rounded-lg border bg-[var(--bg-panel)] shadow-md transition-opacity text-xs w-[250px] overflow-hidden ${
        selected || highlighted
          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30'
          : 'border-[var(--border)]'
      } ${dimmed ? 'opacity-30' : 'opacity-100'}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-[var(--accent)] !border-[var(--bg-panel)]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-[var(--accent)] !border-[var(--bg-panel)]"
      />

      <div className="px-3 py-2 bg-[var(--bg-surface)] border-b border-[var(--border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Table size={12} className="text-[var(--accent)] shrink-0" />
          <span className="font-semibold text-[var(--text)] truncate" title={table.name}>
            {table.name}
          </span>
        </div>
        {table.schema && (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">
            {table.schema}
          </span>
        )}
      </div>

      <div className="divide-y divide-[var(--border-subtle)] max-h-[260px] overflow-y-auto">
        {visibleCols.length === 0 ? (
          <div className="px-3 py-2 text-[10.5px] text-[var(--text-muted)] italic">
            {columns.length} column(s)
          </div>
        ) : (
          visibleCols.map((col) => {
            const isFk = fkColumns.includes(col.name);
            return (
              <div
                key={col.name}
                className="px-2.5 py-1 flex items-center justify-between gap-2 text-[11px] font-mono"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {col.primaryKey ? (
                    <Key size={10} className="text-amber-500 shrink-0" />
                  ) : isFk ? (
                    <Link2 size={10} className="text-[var(--info)] shrink-0" />
                  ) : (
                    <span className="w-2.5 text-center text-[var(--text-muted)]">·</span>
                  )}
                  <span className="truncate text-[var(--text)]">
                    {col.name}
                    {!col.nullable && <span className="text-[var(--error)] ml-0.5">*</span>}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px] shrink-0">
                  {col.dataType}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export const schemaNodeTypes = { schemaNode: DatabaseSchemaNode };
