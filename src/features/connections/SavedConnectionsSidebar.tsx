import { Database, Loader2, Plus, Search } from 'lucide-react';
import type React from 'react';
import { EngineIcon } from '../../components/ui/DatabaseIcons';
import type { ConnectionSummary, SavedConnection } from '../../types/database';

interface SavedConnectionsSidebarProps {
  savedConnections: SavedConnection[];
  filteredSaved: SavedConnection[];
  activeConnections: ConnectionSummary[];
  editingId: string | null;
  connectingProfileId: string | null;
  savedFilter: string;
  onSavedFilterChange: (value: string) => void;
  onNewConnection: () => void;
  onLoadForEdit: (conn: SavedConnection) => void;
  onConnectProfileDirect: (conn: SavedConnection) => void;
  onDisconnect: (connectionId: string) => void;
}

export const SavedConnectionsSidebar: React.FC<SavedConnectionsSidebarProps> = ({
  savedConnections,
  filteredSaved,
  activeConnections,
  editingId,
  connectingProfileId,
  savedFilter,
  onSavedFilterChange,
  onNewConnection,
  onLoadForEdit,
  onConnectProfileDirect,
  onDisconnect,
}) => (
  <aside className="w-full md:w-[244px] max-h-44 md:max-h-none shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--bg-sidebar)] flex flex-col">
    <div className="p-2.5 border-b border-[var(--border-subtle)] space-y-2">
      <button
        type="button"
        onClick={onNewConnection}
        className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
          !editingId
            ? 'bg-[var(--accent)] text-[var(--accent-text)]'
            : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]'
        }`}
      >
        <Plus size={13} /> New Connection
      </button>

      {savedConnections.length > 3 && (
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            type="text"
            value={savedFilter}
            onChange={(e) => onSavedFilterChange(e.target.value)}
            placeholder="Filter saved…"
            className="w-full pl-7 pr-2.5 py-1 text-[11px]"
          />
        </div>
      )}
    </div>

    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {savedConnections.length === 0 ? (
        <div className="py-10 text-center space-y-1.5 text-[var(--text-muted)]">
          <Database size={18} className="mx-auto opacity-45" />
          <p className="text-[11px]">No saved profiles</p>
        </div>
      ) : filteredSaved.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-[var(--text-muted)]">No matches</div>
      ) : (
        filteredSaved.map((conn) => {
          const isConnected = activeConnections.some((ac) => ac.id === conn.id);
          const isSelected = editingId === conn.id;
          const isBusy = connectingProfileId === conn.id;
          const accentEdgeClass =
            conn.environment === 'production'
              ? 'border-l-rose-500'
              : conn.environment === 'staging'
                ? 'border-l-amber-500'
                : 'border-l-emerald-500/75';
          return (
            <div
              key={conn.id}
              className={`group relative rounded-lg border border-l-[3px] ${accentEdgeClass} flex items-center gap-1 pr-1.5 transition-colors ${
                isSelected
                  ? 'bg-[var(--accent-muted)] border-[var(--accent)]/60'
                  : 'bg-[var(--bg-panel)]/70 border-[var(--border-subtle)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)]/60'
              }`}
            >
              <button
                type="button"
                onClick={() => onLoadForEdit(conn)}
                onDoubleClick={() => {
                  if (!isConnected) onConnectProfileDirect(conn);
                }}
                className="flex-1 min-w-0 px-2.5 py-2 text-left flex items-center gap-2"
              >
                <EngineIcon engine={conn.engine} size={15} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isConnected && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                        title="Connected"
                      />
                    )}
                    <span className="text-[11.5px] font-medium text-[var(--text)] truncate">
                      {conn.name}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                    {conn.engine === 'sqlite'
                      ? conn.path?.split(/[/\\]/).pop() || conn.path
                      : `${conn.host || 'localhost'}:${conn.port || (conn.engine === 'mysql' ? 3306 : 5432)}`}
                  </p>
                </div>
              </button>

              {isConnected ? (
                <button
                  type="button"
                  onClick={() => onDisconnect(conn.id)}
                  title="Disconnect session"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--error)]/40 text-[var(--error)] bg-[var(--bg-panel)] transition-opacity shrink-0"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onConnectProfileDirect(conn)}
                  title="Connect to this profile"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] transition-opacity inline-flex items-center shrink-0"
                >
                  {isBusy ? <Loader2 size={10} className="animate-spin" /> : 'Go'}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  </aside>
);
