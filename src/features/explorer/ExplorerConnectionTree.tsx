import {
  Activity,
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
  Loader2,
  Puzzle,
} from 'lucide-react';
import type React from 'react';
import { EngineIcon } from '../../components/ui/DatabaseIcons';
import { getEnvironmentMeta } from '../../services/envTag';
import type {
  ColumnInfo,
  ConnectionSummary,
  DatabaseOverviewResponse,
  FavoriteObject,
  InspectorTarget,
  SchemaInfo,
  SchemaObjectsResponse,
  TableInfo,
  TableSubTab,
} from '../../types/database';
import type { ContextMenuState } from './explorerTypes';
import { SchemaObjectGroups, TreeGroupHeader } from './SchemaObjectGroups';

interface ExplorerConnectionTreeProps {
  isOpen: boolean;
  activeConnections: ConnectionSummary[];
  activeConnectionId: string | null;
  schemasByConn: Record<string, SchemaInfo[]>;
  objectsByConnSchema: Record<string, SchemaObjectsResponse>;
  overviews: Record<string, DatabaseOverviewResponse>;
  loadingSchemas: Record<string, boolean>;
  loadingObjects: Record<string, boolean>;
  filterQuery: string;
  expandedConns: Record<string, boolean>;
  expandedSchemas: Record<string, boolean>;
  expandedGroups: Record<string, boolean>;
  expandedTables: Record<string, boolean>;
  tableColumnsCache: Record<string, ColumnInfo[]>;
  loadingTableCols: Record<string, boolean>;
  isFavorited: (connId: string, schema: string | undefined, name: string) => boolean;
  onToggleSection: () => void;
  onOpenConnections: () => void;
  onSwitchActiveConnection: (connId: string) => void;
  onToggleConnectionExpand: (connId: string, nextOpen: boolean) => void;
  onOpenDatabaseInfoTab: (connId: string, connName: string) => void;
  onToggleSchema: (connId: string, schemaName: string) => void;
  onOpenSchemaInfoTab: (connId: string, schemaName: string) => void;
  onToggleGroup: (key: string, nextOpen: boolean) => void;
  onToggleTable: (connId: string, schema: string, tableName: string) => void;
  onOpenTable: (conn: ConnectionSummary, table: TableInfo, subTab?: TableSubTab) => void;
  onToggleFavorite: (fav: Omit<FavoriteObject, 'addedAt'>) => void;
  onSetInspectorTarget: (target: InspectorTarget, openPanel?: boolean) => void;
  onOpenContextMenu: (menu: ContextMenuState) => void;
}

export const ExplorerConnectionTree: React.FC<ExplorerConnectionTreeProps> = ({
  isOpen,
  activeConnections,
  activeConnectionId,
  schemasByConn,
  objectsByConnSchema,
  overviews,
  loadingSchemas,
  loadingObjects,
  filterQuery,
  expandedConns,
  expandedSchemas,
  expandedGroups,
  expandedTables,
  tableColumnsCache,
  loadingTableCols,
  isFavorited,
  onToggleSection,
  onOpenConnections,
  onSwitchActiveConnection,
  onToggleConnectionExpand,
  onOpenDatabaseInfoTab,
  onToggleSchema,
  onOpenSchemaInfoTab,
  onToggleGroup,
  onToggleTable,
  onOpenTable,
  onToggleFavorite,
  onSetInspectorTarget,
  onOpenContextMenu,
}) => (
  <div>
    <button
      type="button"
      onClick={onToggleSection}
      className="w-full flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)]"
    >
      {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      <span>Databases ({activeConnections.length})</span>
    </button>

    {isOpen && (
      <div>
        {activeConnections.length === 0 ? (
          <div className="mx-2.5 my-2 p-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-panel)]/50 text-center space-y-2">
            <Database size={20} className="mx-auto text-[var(--text-muted)] opacity-50" />
            <p className="text-[11px] text-[var(--text-muted)]">No active connections</p>
            <button
              type="button"
              onClick={onOpenConnections}
              className="px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--accent-text)] text-[11px] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
            >
              Connect Database
            </button>
          </div>
        ) : (
          activeConnections.map((conn) => {
            const isConnOpen = expandedConns[conn.id] ?? conn.id === activeConnectionId;
            const isActive = conn.id === activeConnectionId;
            const schemas = schemasByConn[conn.id] || [];
            const overview = overviews[conn.id];

            return (
              <div key={conn.id} className="mb-1">
                <div
                  data-tree-item="true"
                  aria-expanded={isConnOpen}
                  tabIndex={0}
                  onClick={() => {
                    onSwitchActiveConnection(conn.id);
                    onToggleConnectionExpand(conn.id, !isConnOpen);
                  }}
                  onDoubleClick={() => onOpenDatabaseInfoTab(conn.id, conn.name)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onOpenContextMenu({
                      kind: 'connection',
                      x: e.clientX,
                      y: e.clientY,
                      conn,
                    });
                  }}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer focus:outline-none ${
                    isActive
                      ? 'bg-[var(--accent-muted)] text-[var(--text)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {isConnOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <EngineIcon
                    engine={conn.engineKind}
                    size={14}
                    className={
                      conn.engineKind === 'sqlite'
                        ? 'text-[var(--success)] shrink-0'
                        : 'text-[var(--info)] shrink-0'
                    }
                  />
                  <span className="truncate flex-1">{conn.name}</span>
                  {conn.environment === 'production' ? (
                    <span
                      className={`text-[9px] uppercase px-1 rounded border ${getEnvironmentMeta(conn.environment).badgeClass}`}
                    >
                      PROD
                    </span>
                  ) : conn.environment === 'staging' ? (
                    <span
                      className={`text-[9px] uppercase px-1 rounded border ${getEnvironmentMeta(conn.environment).badgeClass}`}
                    >
                      STG
                    </span>
                  ) : null}
                  {loadingSchemas[conn.id] && (
                    <Loader2 size={11} className="animate-spin text-[var(--accent)]" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDatabaseInfoTab(conn.id, conn.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-muted)]"
                    title="Database Overview"
                  >
                    <Activity size={11} />
                  </button>
                </div>

                {isConnOpen && (
                  <div className="pl-2 border-l border-[var(--border-subtle)] ml-3">
                    {schemas.map((schema) => {
                      const sk = `${conn.id}:${schema.name}`;
                      const isSchemaOpen =
                        expandedSchemas[sk] ?? (schema.name === 'public' || schema.name === 'main');
                      const objs = objectsByConnSchema[sk];
                      const isLoadingObjs = loadingObjects[sk];

                      return (
                        <div key={schema.name}>
                          <div
                            data-tree-item="true"
                            aria-expanded={isSchemaOpen}
                            tabIndex={0}
                            onClick={() => onToggleSchema(conn.id, schema.name)}
                            onDoubleClick={() => onOpenSchemaInfoTab(conn.id, schema.name)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              onOpenContextMenu({
                                kind: 'schema',
                                x: e.clientX,
                                y: e.clientY,
                                connId: conn.id,
                                schema: schema.name,
                              });
                            }}
                            className={`group flex items-center gap-1.5 px-2 py-1 text-[11.5px] cursor-pointer hover:bg-[var(--bg-hover)] focus:outline-none focus:bg-[var(--bg-hover)] ${
                              schema.isSystem
                                ? 'text-[var(--text-muted)]'
                                : 'text-[var(--text)] font-medium'
                            }`}
                          >
                            {isSchemaOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <Layers size={12} className="text-[var(--accent)] shrink-0" />
                            <span className="truncate flex-1">{schema.name}</span>
                            {isLoadingObjs ? (
                              <Loader2 size={10} className="animate-spin text-[var(--accent)]" />
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {schema.tableCount + schema.viewCount}
                              </span>
                            )}
                          </div>

                          {isSchemaOpen && objs && (
                            <SchemaObjectGroups
                              conn={conn}
                              schema={schema}
                              objs={objs}
                              filterQuery={filterQuery}
                              expandedGroups={expandedGroups}
                              expandedTables={expandedTables}
                              tableColumnsCache={tableColumnsCache}
                              loadingTableCols={loadingTableCols}
                              isFavorited={isFavorited}
                              onToggleGroup={onToggleGroup}
                              onToggleTable={onToggleTable}
                              onOpenTable={onOpenTable}
                              onToggleFavorite={onToggleFavorite}
                              onSetInspectorTarget={onSetInspectorTarget}
                              onOpenContextMenu={onOpenContextMenu}
                            />
                          )}
                        </div>
                      );
                    })}

                    {overview && overview.extensions.length > 0 && (
                      <div>
                        <TreeGroupHeader
                          groupKey={`${conn.id}:extensions`}
                          label="Extensions"
                          count={overview.extensions.length}
                          icon={<Puzzle size={11} className="text-[var(--text-muted)]" />}
                          hasFilter={Boolean(filterQuery)}
                          expandedGroups={expandedGroups}
                          onToggleGroup={onToggleGroup}
                        />
                        {expandedGroups[`${conn.id}:extensions`] &&
                          overview.extensions.map((ext) => (
                            <div
                              key={ext.name}
                              onClick={() =>
                                onSetInspectorTarget(
                                  {
                                    kind: 'object',
                                    objectType: 'extension',
                                    title: ext.name,
                                    subtitle: `Version ${ext.version}`,
                                    details: {
                                      Schema: ext.schema,
                                      Version: ext.version,
                                      Description: ext.description,
                                    },
                                  },
                                  true,
                                )
                              }
                              className="flex items-center justify-between px-4 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                            >
                              <span className="truncate font-mono">{ext.name}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {ext.version}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    )}
  </div>
);
