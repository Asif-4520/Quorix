import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Eye,
  Hash,
  Key,
  Layers,
  Loader2,
  Star,
  Table,
} from 'lucide-react';
import type React from 'react';
import { FunctionIcon } from '../../components/ui/DatabaseIcons';
import type {
  ColumnInfo,
  ConnectionSummary,
  FavoriteObject,
  FunctionInfo,
  InspectorTarget,
  SchemaInfo,
  SchemaObjectsResponse,
  SequenceInfo,
  TableInfo,
  TableSubTab,
} from '../../types/database';
import type { ContextMenuState } from './explorerTypes';

interface TreeGroupHeaderProps {
  groupKey: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  hasFilter: boolean;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (key: string, nextOpen: boolean) => void;
}

export const TreeGroupHeader: React.FC<TreeGroupHeaderProps> = ({
  groupKey,
  label,
  count,
  icon,
  defaultOpen = false,
  hasFilter,
  expandedGroups,
  onToggleGroup,
}) => {
  const isOpen = hasFilter ? count > 0 : (expandedGroups[groupKey] ?? defaultOpen);
  return (
    <button
      type="button"
      data-tree-item="true"
      aria-expanded={isOpen}
      onClick={() => onToggleGroup(groupKey, !isOpen)}
      className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] focus:outline-none focus:bg-[var(--bg-hover)]"
    >
      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      {icon}
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] px-1.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)]">
        {count}
      </span>
    </button>
  );
};

interface SchemaObjectGroupsProps {
  conn: ConnectionSummary;
  schema: SchemaInfo;
  objs: SchemaObjectsResponse;
  filterQuery: string;
  expandedGroups: Record<string, boolean>;
  expandedTables: Record<string, boolean>;
  tableColumnsCache: Record<string, ColumnInfo[]>;
  loadingTableCols: Record<string, boolean>;
  isFavorited: (connId: string, schema: string | undefined, name: string) => boolean;
  onToggleGroup: (key: string, nextOpen: boolean) => void;
  onToggleTable: (connId: string, schema: string, tableName: string) => void;
  onOpenTable: (conn: ConnectionSummary, table: TableInfo, subTab?: TableSubTab) => void;
  onToggleFavorite: (fav: Omit<FavoriteObject, 'addedAt'>) => void;
  onSetInspectorTarget: (target: InspectorTarget, openPanel?: boolean) => void;
  onOpenContextMenu: (menu: ContextMenuState) => void;
}

export const SchemaObjectGroups: React.FC<SchemaObjectGroupsProps> = ({
  conn,
  schema,
  objs,
  filterQuery,
  expandedGroups,
  expandedTables,
  tableColumnsCache,
  loadingTableCols,
  isFavorited,
  onToggleGroup,
  onToggleTable,
  onOpenTable,
  onToggleFavorite,
  onSetInspectorTarget,
  onOpenContextMenu,
}) => {
  const sk = `${conn.id}:${schema.name}`;
  const hasFilter = Boolean(filterQuery);

  const tables = (objs.tables || []).filter(
    (t) => !filterQuery || t.name.toLowerCase().includes(filterQuery),
  );
  const views = (objs.views || []).filter(
    (v) => !filterQuery || v.name.toLowerCase().includes(filterQuery),
  );
  const matViews = (objs.materializedViews || []).filter(
    (v) => !filterQuery || v.name.toLowerCase().includes(filterQuery),
  );
  const functions = (objs.functions || []).filter(
    (f) => !filterQuery || f.name.toLowerCase().includes(filterQuery),
  );
  const sequences = (objs.sequences || []).filter(
    (s) => !filterQuery || s.name.toLowerCase().includes(filterQuery),
  );
  const enums = (objs.enumTypes || []).filter(
    (e) => !filterQuery || e.name.toLowerCase().includes(filterQuery),
  );

  return (
    <div className="pl-2 ml-2 border-l border-[var(--border-subtle)]">
      <TreeGroupHeader
        groupKey={`${sk}:tables`}
        label="Tables"
        count={tables.length}
        icon={<Table size={11} className="text-[var(--accent)]" />}
        defaultOpen
        hasFilter={hasFilter}
        expandedGroups={expandedGroups}
        onToggleGroup={onToggleGroup}
      />
      {(hasFilter ? tables.length > 0 : (expandedGroups[`${sk}:tables`] ?? true)) &&
        tables.map((tbl) => {
          const tk = `${conn.id}:${schema.name}.${tbl.name}`;
          const isTblOpen = !!expandedTables[tk];
          const cols = tableColumnsCache[tk];
          const fav = isFavorited(conn.id, tbl.schema, tbl.name);

          return (
            <div key={tk}>
              <div
                data-tree-item="true"
                data-tree-kind="table"
                aria-expanded={isTblOpen}
                tabIndex={0}
                onClick={() => onOpenTable(conn, tbl, 'data')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onOpenTable(conn, tbl, 'data');
                  } else if (e.key === 'ArrowRight' && !isTblOpen) {
                    onToggleTable(conn.id, schema.name, tbl.name);
                  } else if (e.key === 'ArrowLeft' && isTblOpen) {
                    onToggleTable(conn.id, schema.name, tbl.name);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenContextMenu({
                    kind: 'table',
                    x: e.clientX,
                    y: e.clientY,
                    conn,
                    table: tbl,
                  });
                }}
                className="group flex items-center gap-1 px-2 py-1 text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] cursor-pointer focus:outline-none focus:bg-[var(--bg-hover)]"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTable(conn.id, schema.name, tbl.name);
                  }}
                  className="p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-muted)]"
                >
                  {isTblOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </button>
                <Table size={12} className="text-[var(--accent)] shrink-0" />
                <span className="truncate flex-1">{tbl.name}</span>
                {tbl.rowCountEstimate !== undefined && tbl.rowCountEstimate !== null && (
                  <span className="text-[10px] font-mono text-[var(--text-muted)] group-hover:hidden">
                    ~{tbl.rowCountEstimate}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite({
                      id: `${conn.id}:${schema.name}.${tbl.name}`,
                      connectionId: conn.id,
                      connectionName: conn.name,
                      schema: schema.name,
                      name: tbl.name,
                      kind: 'table',
                    });
                  }}
                  className={`p-0.5 rounded ${
                    fav
                      ? 'text-amber-500 opacity-100'
                      : 'opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-amber-500'
                  }`}
                  title={fav ? 'Remove Favorite' : 'Add to Favorites'}
                >
                  <Star size={10} fill={fav ? 'currentColor' : 'none'} />
                </button>
              </div>

              {isTblOpen && (
                <div className="pl-5 ml-2 border-l border-[var(--border-subtle)] py-0.5">
                  {loadingTableCols[tk] ? (
                    <div className="px-2 py-1 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" />
                      Loading columns…
                    </div>
                  ) : (
                    (cols || []).map((col) => (
                      <div
                        key={col.name}
                        onClick={() =>
                          onSetInspectorTarget(
                            {
                              kind: 'object',
                              objectType: 'column',
                              title: `${tbl.name}.${col.name}`,
                              subtitle: `${schema.name}.${tbl.name}`,
                              details: {
                                Type: col.dataType,
                                Nullable: col.nullable ? 'YES' : 'NO',
                                'Primary Key': col.primaryKey ? 'YES' : 'NO',
                                Default: col.defaultValue,
                                Identity: col.isIdentity ? 'YES' : 'NO',
                                Generated: col.isGenerated
                                  ? col.generationExpression || 'YES'
                                  : 'NO',
                                Comment: col.comment,
                              },
                            },
                            true,
                          )
                        }
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onOpenContextMenu({
                            kind: 'column',
                            x: e.clientX,
                            y: e.clientY,
                            tableName: tbl.name,
                            schema: schema.name,
                            column: col,
                          });
                        }}
                        className="flex items-center gap-1.5 px-2 py-0.5 text-[10.5px] font-mono text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] cursor-pointer"
                      >
                        {col.primaryKey ? (
                          <Key size={10} className="text-amber-500 shrink-0" />
                        ) : (
                          <span className="w-2.5 text-center opacity-50">·</span>
                        )}
                        <span className="truncate text-[var(--text-secondary)]">{col.name}</span>
                        <span className="ml-auto text-[9.5px] opacity-75 truncate max-w-[70px]">
                          {col.dataType}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

      {(views.length > 0 || !hasFilter) && (
        <>
          <TreeGroupHeader
            groupKey={`${sk}:views`}
            label="Views"
            count={views.length}
            icon={<Eye size={11} className="text-[var(--info)]" />}
            hasFilter={hasFilter}
            expandedGroups={expandedGroups}
            onToggleGroup={onToggleGroup}
          />
          {(hasFilter ? views.length > 0 : expandedGroups[`${sk}:views`]) &&
            views.map((v) => (
              <div
                key={`${sk}:view:${v.name}`}
                data-tree-item="true"
                tabIndex={0}
                onClick={() => onOpenTable(conn, v, 'data')}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenContextMenu({
                    kind: 'table',
                    x: e.clientX,
                    y: e.clientY,
                    conn,
                    table: v,
                  });
                }}
                className="flex items-center gap-1.5 px-4 py-1 text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] cursor-pointer"
              >
                <Eye size={11} className="text-[var(--info)] shrink-0" />
                <span className="truncate">{v.name}</span>
              </div>
            ))}
        </>
      )}

      {matViews.length > 0 && (
        <>
          <TreeGroupHeader
            groupKey={`${sk}:matviews`}
            label="Materialized Views"
            count={matViews.length}
            icon={<Layers size={11} className="text-purple-400" />}
            hasFilter={hasFilter}
            expandedGroups={expandedGroups}
            onToggleGroup={onToggleGroup}
          />
          {(hasFilter ? matViews.length > 0 : expandedGroups[`${sk}:matviews`]) &&
            matViews.map((mv) => (
              <div
                key={`${sk}:mv:${mv.name}`}
                data-tree-item="true"
                tabIndex={0}
                onClick={() => onOpenTable(conn, mv, 'data')}
                className="flex items-center gap-1.5 px-4 py-1 text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] cursor-pointer"
              >
                <Layers size={11} className="text-purple-400 shrink-0" />
                <span className="truncate">{mv.name}</span>
              </div>
            ))}
        </>
      )}

      {functions.length > 0 && (
        <>
          <TreeGroupHeader
            groupKey={`${sk}:functions`}
            label="Functions"
            count={functions.length}
            icon={<FunctionIcon size={11} className="text-amber-400" />}
            hasFilter={hasFilter}
            expandedGroups={expandedGroups}
            onToggleGroup={onToggleGroup}
          />
          {(hasFilter ? functions.length > 0 : expandedGroups[`${sk}:functions`]) &&
            functions.map((fn: FunctionInfo) => (
              <div
                key={`${sk}:fn:${fn.name}:${fn.arguments}`}
                onClick={() =>
                  onSetInspectorTarget(
                    {
                      kind: 'object',
                      objectType: 'function',
                      title: `${fn.name}(${fn.arguments})`,
                      subtitle: `${schema.name} · ${fn.kind}`,
                      details: {
                        Kind: fn.kind,
                        'Return Type': fn.returnType,
                        Language: fn.language,
                        Arguments: fn.arguments || '(none)',
                      },
                      definition: fn.definition,
                    },
                    true,
                  )
                }
                className="flex items-center gap-1.5 px-4 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <FunctionIcon size={10} className="text-amber-400 shrink-0" />
                <span className="truncate font-mono">{fn.name}</span>
              </div>
            ))}
        </>
      )}

      {sequences.length > 0 && (
        <>
          <TreeGroupHeader
            groupKey={`${sk}:sequences`}
            label="Sequences"
            count={sequences.length}
            icon={<Hash size={11} className="text-[var(--text-muted)]" />}
            hasFilter={hasFilter}
            expandedGroups={expandedGroups}
            onToggleGroup={onToggleGroup}
          />
          {(hasFilter ? sequences.length > 0 : expandedGroups[`${sk}:sequences`]) &&
            sequences.map((seq: SequenceInfo) => (
              <div
                key={`${sk}:seq:${seq.name}`}
                onClick={() =>
                  onSetInspectorTarget(
                    {
                      kind: 'object',
                      objectType: 'sequence',
                      title: seq.name,
                      subtitle: schema.name,
                      details: {
                        'Data Type': seq.dataType,
                        'Start Value': seq.startValue,
                        Increment: seq.incrementBy,
                        Min: seq.minValue,
                        Max: seq.maxValue,
                      },
                    },
                    true,
                  )
                }
                className="flex items-center gap-1.5 px-4 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <Hash size={10} className="shrink-0" />
                <span className="truncate font-mono">{seq.name}</span>
              </div>
            ))}
        </>
      )}

      {enums.length > 0 && (
        <>
          <TreeGroupHeader
            groupKey={`${sk}:enums`}
            label="Types / Enums"
            count={enums.length}
            icon={<Bookmark size={11} className="text-[var(--accent)]" />}
            hasFilter={hasFilter}
            expandedGroups={expandedGroups}
            onToggleGroup={onToggleGroup}
          />
          {(hasFilter ? enums.length > 0 : expandedGroups[`${sk}:enums`]) &&
            enums.map((en) => (
              <div
                key={`${sk}:enum:${en.name}`}
                onClick={() =>
                  onSetInspectorTarget(
                    {
                      kind: 'object',
                      objectType: 'enum',
                      title: en.name,
                      subtitle: `${schema.name} · ENUM`,
                      details: { Values: en.values },
                    },
                    true,
                  )
                }
                className="flex items-center gap-1.5 px-4 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <Bookmark size={10} className="shrink-0" />
                <span className="truncate font-mono">{en.name}</span>
              </div>
            ))}
        </>
      )}
    </div>
  );
};
