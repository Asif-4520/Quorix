import { ChevronDown, ChevronRight, Clock, Folder, Plus, Star, Trash2 } from 'lucide-react';
import type React from 'react';
import { SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import type {
  ConnectionSummary,
  FavoriteObject,
  RecentObject,
  SavedQuery,
  TableInfo,
} from '../../types/database';
import type { ContextMenuState } from './explorerTypes';

interface ExplorerSavedListsProps {
  favorites: FavoriteObject[];
  recentObjects: RecentObject[];
  filteredSavedQueries: SavedQuery[];
  activeConnections: ConnectionSummary[];
  activeConnectionId: string | null;
  favoritesOpen: boolean;
  recentOpen: boolean;
  queriesOpen: boolean;
  renamingQueryId: string | null;
  renameTitle: string;
  onToggleFavorites: () => void;
  onToggleRecent: () => void;
  onToggleQueries: () => void;
  onOpenFavorite: (fav: FavoriteObject) => void;
  onOpenTableTab: (table: TableInfo, connId: string, connName: string) => void;
  onOpenSqlTab: (opts: {
    title?: string;
    sql?: string;
    connectionId?: string;
    savedQueryId?: string;
  }) => void;
  onSaveQuery: (sq: SavedQuery) => void;
  onRemoveSavedQuery: (id: string) => void;
  onRenameTitleChange: (title: string) => void;
  onCancelRename: () => void;
  onOpenContextMenu: (menu: ContextMenuState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExplorerSavedLists: React.FC<ExplorerSavedListsProps> = ({
  favorites,
  recentObjects,
  filteredSavedQueries,
  activeConnections,
  activeConnectionId,
  favoritesOpen,
  recentOpen,
  queriesOpen,
  renamingQueryId,
  renameTitle,
  onToggleFavorites,
  onToggleRecent,
  onToggleQueries,
  onOpenFavorite,
  onOpenTableTab,
  onOpenSqlTab,
  onSaveQuery,
  onRemoveSavedQuery,
  onRenameTitleChange,
  onCancelRename,
  onOpenContextMenu,
  onShowToast,
}) => (
  <>
    {favorites.length > 0 && (
      <div className="border-t border-[var(--border-subtle)] pt-1">
        <button
          type="button"
          onClick={onToggleFavorites}
          className="w-full flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {favoritesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span>Favorites ({favorites.length})</span>
        </button>
        {favoritesOpen &&
          favorites.map((fav) => (
            <div
              key={fav.id}
              onClick={() => onOpenFavorite(fav)}
              className="group flex items-center gap-1.5 px-3 py-1 text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] cursor-pointer"
            >
              <Star size={11} className="text-amber-500 shrink-0" fill="currentColor" />
              <span className="truncate flex-1">{fav.name}</span>
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[70px]">
                {fav.connectionName}
              </span>
            </div>
          ))}
      </div>
    )}

    {recentObjects.length > 0 && (
      <div className="border-t border-[var(--border-subtle)] pt-1">
        <button
          type="button"
          onClick={onToggleRecent}
          className="w-full flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {recentOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span>Recent ({recentObjects.length})</span>
        </button>
        {recentOpen &&
          recentObjects.slice(0, 8).map((rec) => (
            <div
              key={rec.id}
              onClick={() => {
                const conn = activeConnections.find((c) => c.id === rec.connectionId);
                if (conn) {
                  onOpenTableTab(
                    {
                      name: rec.name,
                      schema: rec.schema,
                      kind: rec.kind,
                      hasPrimaryKey: true,
                      isStrict: false,
                      withoutRowid: false,
                    },
                    conn.id,
                    conn.name,
                  );
                } else {
                  onShowToast(`Connect to "${rec.connectionName}" first`, 'info');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              <Clock size={11} className="text-[var(--text-muted)] shrink-0" />
              <span className="truncate flex-1">{rec.name}</span>
              <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[70px]">
                {rec.connectionName}
              </span>
            </div>
          ))}
      </div>
    )}

    <div className="border-t border-[var(--border-subtle)] pt-1">
      <div className="flex items-center justify-between pr-2">
        <button
          type="button"
          onClick={onToggleQueries}
          className="flex-1 flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {queriesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span>Saved Queries ({filteredSavedQueries.length})</span>
        </button>
        <button
          type="button"
          onClick={() =>
            onOpenSqlTab({
              connectionId: activeConnectionId || undefined,
            })
          }
          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
          title="New SQL Query"
        >
          <Plus size={12} />
        </button>
      </div>

      {queriesOpen && (
        <div className="space-y-0.5">
          {filteredSavedQueries.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-[var(--text-muted)] italic">
              No saved queries yet
            </p>
          ) : (
            filteredSavedQueries.map((sq) => (
              <div
                key={sq.id}
                onClick={() =>
                  onOpenSqlTab({
                    title: sq.title,
                    sql: sq.sql,
                    connectionId: sq.connectionId || activeConnectionId || undefined,
                    savedQueryId: sq.id,
                  })
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenContextMenu({
                    kind: 'query',
                    x: e.clientX,
                    y: e.clientY,
                    query: sq,
                  });
                }}
                className="group flex items-center gap-1.5 px-3 py-1 text-[11.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] cursor-pointer"
              >
                {sq.folder ? (
                  <Folder size={11} className="text-[var(--warning)] shrink-0" />
                ) : (
                  <SqlQueryIcon size={11} className="text-[var(--info)] shrink-0" />
                )}
                {renamingQueryId === sq.id ? (
                  <input
                    type="text"
                    value={renameTitle}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onRenameTitleChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameTitle.trim()) {
                        onSaveQuery({ ...sq, title: renameTitle.trim() });
                        onCancelRename();
                      } else if (e.key === 'Escape') {
                        onCancelRename();
                      }
                    }}
                    onBlur={onCancelRename}
                    className="flex-1 py-0 px-1 text-[11px]"
                  />
                ) : (
                  <span className="truncate flex-1">{sq.title}</span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSavedQuery(sq.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--error)]"
                  title="Delete Saved Query"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  </>
);
