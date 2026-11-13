import { Database, Layers, Plus, Puzzle, Table } from 'lucide-react';
import type React from 'react';
import { Badge } from '../../components/ui/Badge';
import { EngineIcon, ErDiagramIcon, SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import { QuorixLogo } from '../../components/ui/QuorixLogo';
import { getEnvironmentMeta } from '../../services/envTag';
import { useConnectionStore } from '../../stores/connectionStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { SqliteMaintenancePanel } from './SqliteMaintenancePanel';

interface DatabaseOverviewProps {
  connectionId?: string;
  schemaFilter?: string;
  onOpenConnections: () => void;
  onOpenCreateTable: () => void;
}

export const DatabaseOverview: React.FC<DatabaseOverviewProps> = ({
  connectionId,
  schemaFilter,
  onOpenConnections,
  onOpenCreateTable,
}) => {
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const targetId = connectionId || activeConnectionId || undefined;
  const conn = activeConnections.find((c) => c.id === targetId);
  const overview = useConnectionStore((s) => (targetId ? s.overviews[targetId] : undefined));
  const schemas = useConnectionStore((s) => (targetId ? s.schemasByConn[targetId] || [] : []));
  const objectsBySchema = useConnectionStore((s) => s.objectsByConnSchema);
  const recentSqliteFiles = useConnectionStore((s) => s.recentSqliteFiles);
  const savedConnections = useConnectionStore((s) => s.savedConnections);
  const connectSavedProfile = useConnectionStore((s) => s.connectSavedProfile);

  const openTableTab = useWorkspaceStore((s) => s.openTableTab);
  const openSqlTab = useWorkspaceStore((s) => s.openSqlTab);
  const openErDiagramTab = useWorkspaceStore((s) => s.openErDiagramTab);
  const openSchemaDiffTab = useWorkspaceStore((s) => s.openSchemaDiffTab);

  if (!conn) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
        <div className="max-w-lg w-full space-y-6">
          <div className="flex items-center gap-3.5">
            <QuorixLogo variant="badge" className="w-11 h-11 drop-shadow-sm" />
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[var(--text)]">Quorix</h2>
              <p className="text-xs text-[var(--text-muted)]">
                SQL workspace for PostgreSQL, MySQL, and SQLite.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenConnections}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold inline-flex items-center gap-2"
            >
              <Plus size={14} /> Connect Database
            </button>
            <button
              type="button"
              onClick={() => openSqlTab()}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-2"
            >
              <SqlQueryIcon size={14} /> Open SQL Console
            </button>
          </div>

          {savedConnections.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Saved Connections
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {savedConnections.slice(0, 6).map((sc) => (
                  <button
                    type="button"
                    key={sc.id}
                    onClick={() => connectSavedProfile(sc)}
                    className="p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--border-focus)] text-left flex items-center gap-2.5 transition-colors"
                  >
                    <EngineIcon
                      engine={sc.engine}
                      size={16}
                      className={
                        sc.engine === 'sqlite'
                          ? 'text-[var(--success)] shrink-0'
                          : 'text-[var(--info)] shrink-0'
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${getEnvironmentMeta(sc.environment).dotClass}`}
                        />
                        <span className="text-xs font-semibold text-[var(--text)] truncate">
                          {sc.name}
                        </span>
                      </div>
                      <div className="text-[10.5px] font-mono text-[var(--text-muted)] truncate mt-0.5">
                        {sc.engine === 'sqlite'
                          ? sc.path
                          : `${sc.host}:${sc.port || (sc.engine === 'mysql' ? 3306 : 5432)}/${sc.database || ''}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentSqliteFiles.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Recent SQLite Files
              </h3>
              <div className="space-y-1">
                {recentSqliteFiles.slice(0, 4).map((p) => (
                  <div
                    key={p}
                    className="px-3 py-1.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] truncate"
                  >
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const primarySchema =
    schemaFilter ||
    schemas.find((s) => s.name === 'public')?.name ||
    schemas.find((s) => s.name === 'main')?.name ||
    schemas[0]?.name ||
    'main';
  const schemaObjs = objectsBySchema[`${conn.id}:${primarySchema}`];

  return (
    <div className="flex-1 overflow-y-auto p-6 select-text">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <EngineIcon
                engine={conn.engineKind}
                size={19}
                className={
                  conn.engineKind === 'sqlite' ? 'text-[var(--success)]' : 'text-[var(--info)]'
                }
              />
              <h2 className="text-lg font-bold text-[var(--text)]">
                {schemaFilter ? `${conn.name} · ${schemaFilter}` : conn.name}
              </h2>
              <Badge variant="accent">{conn.engine}</Badge>
              {conn.serverVersion && <Badge variant="type">{conn.serverVersion}</Badge>}
            </div>
            <p className="text-xs font-mono text-[var(--text-muted)]">{conn.location}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openSqlTab({ connectionId: conn.id })}
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <SqlQueryIcon size={13} /> New SQL Query
            </button>
            <button
              type="button"
              onClick={() => openErDiagramTab(conn.id, schemaFilter)}
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <ErDiagramIcon size={13} /> ER Diagram
            </button>
            <button
              type="button"
              onClick={() => openSchemaDiffTab(conn.id)}
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Layers size={13} /> Compare Schema
            </button>
            {!conn.readOnly && (
              <button
                type="button"
                onClick={onOpenCreateTable}
                className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus size={13} /> Create Table
              </button>
            )}
          </div>
        </div>

        {overview && !schemaFilter && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] space-y-2.5">
              <div className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                <Database size={13} className="text-[var(--accent)]" />
                Databases ({overview.databases.length})
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
                {overview.databases.map((db) => (
                  <div key={db.name} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono font-medium text-[var(--text)]">{db.name}</span>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                      {db.encoding && <span>{db.encoding}</span>}
                      {db.sizePretty && <span>{db.sizePretty}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] space-y-2.5">
              <div className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                <Layers size={13} className="text-[var(--accent)]" />
                Schemas ({schemas.length})
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
                {schemas.map((s) => (
                  <div key={s.name} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono font-medium text-[var(--text)]">{s.name}</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {s.tableCount} tables · {s.viewCount} views
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {conn.engineKind === 'sqlite' && !schemaFilter && (
          <SqliteMaintenancePanel connection={conn} />
        )}

        {overview && overview.extensions.length > 0 && !schemaFilter && (
          <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] space-y-2">
            <div className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Puzzle size={13} className="text-[var(--accent)]" />
              Installed Extensions ({overview.extensions.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {overview.extensions.map((ext) => (
                <Badge
                  key={ext.name}
                  variant="neutral"
                  size="sm"
                  title={ext.description || undefined}
                >
                  {ext.name} {ext.version}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {schemaObjs && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">
              Tables in <span className="font-mono text-[var(--text)]">{primarySchema}</span> (
              {schemaObjs.tables.length})
            </div>
            {schemaObjs.tables.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)]">
                No tables in schema &ldquo;{primarySchema}&rdquo;.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {schemaObjs.tables.map((tbl) => (
                  <button
                    type="button"
                    key={tbl.name}
                    onClick={() => openTableTab(tbl, conn.id, conn.name)}
                    className="p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--border-focus)] text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Table size={14} className="text-[var(--accent)] shrink-0" />
                      <span className="text-xs font-semibold text-[var(--text)] truncate">
                        {tbl.name}
                      </span>
                    </div>
                    {tbl.rowCountEstimate !== undefined && tbl.rowCountEstimate !== null && (
                      <span className="text-[10.5px] font-mono text-[var(--text-muted)] shrink-0">
                        ~{tbl.rowCountEstimate.toLocaleString()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
