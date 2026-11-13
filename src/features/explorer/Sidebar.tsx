import { Plus, RefreshCw, Search, Table, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErDiagramIcon } from '../../components/ui/DatabaseIcons';
import { getTableDetails } from '../../services/tauri';
import { useConnectionStore } from '../../stores/connectionStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import type {
  ColumnInfo,
  ConnectionSummary,
  FavoriteObject,
  TableInfo,
  TableSubTab,
} from '../../types/database';
import { ExplorerConnectionTree } from './ExplorerConnectionTree';
import { ExplorerContextMenu } from './ExplorerContextMenu';
import { ExplorerSavedLists } from './ExplorerSavedLists';
import type { ContextMenuState } from './explorerTypes';

interface SidebarProps {
  width: number;
  onResizeWidth: (width: number) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onOpenConnections: () => void;
  onOpenCreateTable: () => void;
  onRequestDropTable: (connId: string, tableName: string, schema?: string) => void;
  onRequestTruncateTable: (connId: string, tableName: string, schema?: string) => void;
  onRequestConfirm?: (
    title: string,
    message: string,
    sql: string | undefined,
    onConfirm: () => Promise<void> | void,
  ) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  width,
  onResizeWidth,
  searchInputRef,
  onOpenConnections,
  onOpenCreateTable,
  onRequestDropTable,
  onRequestTruncateTable,
  onRequestConfirm,
  onShowToast,
}) => {
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const schemasByConn = useConnectionStore((s) => s.schemasByConn);
  const objectsByConnSchema = useConnectionStore((s) => s.objectsByConnSchema);
  const overviews = useConnectionStore((s) => s.overviews);
  const loadingSchemas = useConnectionStore((s) => s.loadingSchemas);
  const loadingObjects = useConnectionStore((s) => s.loadingObjects);
  const switchActiveConnection = useConnectionStore((s) => s.switchActiveConnection);
  const refreshConnectionTree = useConnectionStore((s) => s.refreshConnectionTree);
  const loadSchemaObjects = useConnectionStore((s) => s.loadSchemaObjects);
  const disconnect = useConnectionStore((s) => s.disconnect);

  const favorites = useWorkspaceStore((s) => s.favorites);
  const recentObjects = useWorkspaceStore((s) => s.recentObjects);
  const savedQueries = useWorkspaceStore((s) => s.savedQueries);
  const openTableTab = useWorkspaceStore((s) => s.openTableTab);
  const openSqlTab = useWorkspaceStore((s) => s.openSqlTab);
  const openErDiagramTab = useWorkspaceStore((s) => s.openErDiagramTab);
  const openDatabaseInfoTab = useWorkspaceStore((s) => s.openDatabaseInfoTab);
  const openSchemaInfoTab = useWorkspaceStore((s) => s.openSchemaInfoTab);
  const openSchemaDiffTab = useWorkspaceStore((s) => s.openSchemaDiffTab);
  const toggleFavorite = useWorkspaceStore((s) => s.toggleFavorite);
  const saveQuery = useWorkspaceStore((s) => s.saveQuery);
  const removeSavedQuery = useWorkspaceStore((s) => s.removeSavedQuery);
  const setInspectorTarget = useWorkspaceStore((s) => s.setInspectorTarget);
  const closeTabsForConnection = useWorkspaceStore((s) => s.closeTabsForConnection);

  const handleRemoveSavedQuery = (queryId: string) => {
    const query = savedQueries.find((q) => q.id === queryId);
    const title = query?.title || 'this saved query';
    const run = () => {
      removeSavedQuery(queryId);
      onShowToast(`Removed saved query "${title}"`, 'info');
    };
    if (onRequestConfirm) {
      onRequestConfirm(
        'Delete Saved Query',
        `Permanently remove saved query "${title}"?`,
        query?.sql,
        run,
      );
      return;
    }
    run();
  };

  const [filterText, setFilterText] = useState('');
  const [expandedConns, setExpandedConns] = useState<Record<string, boolean>>({});
  const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [tableColumnsCache, setTableColumnsCache] = useState<Record<string, ColumnInfo[]>>({});
  const [loadingTableCols, setLoadingTableCols] = useState<Record<string, boolean>>({});

  const [sectionOpen, setSectionOpen] = useState({
    explorer: true,
    favorites: true,
    recent: false,
    queries: true,
  });

  const [renamingQueryId, setRenamingQueryId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeConnectionId) return;
    setExpandedConns((prev) =>
      prev[activeConnectionId] !== undefined ? prev : { ...prev, [activeConnectionId]: true },
    );
    const schemas = schemasByConn[activeConnectionId] || [];
    const defSchema =
      schemas.find((s) => s.name === 'public') ||
      schemas.find((s) => s.name === 'main') ||
      schemas.find((s) => !s.isSystem);
    if (defSchema) {
      const sk = `${activeConnectionId}:${defSchema.name}`;
      setExpandedSchemas((prev) => (prev[sk] !== undefined ? prev : { ...prev, [sk]: true }));
      setExpandedGroups((prev) => ({
        ...prev,
        [`${sk}:tables`]: prev[`${sk}:tables`] ?? true,
      }));
    }
  }, [activeConnectionId, schemasByConn]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => onResizeWidth(startW + (ev.clientX - startX));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast(`Copied "${text}"`, 'info');
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedId(null);
      copyTimerRef.current = null;
    }, 1200);
  };

  const toggleSchema = async (connId: string, schemaName: string) => {
    const sk = `${connId}:${schemaName}`;
    const next = !expandedSchemas[sk];
    setExpandedSchemas((prev) => ({ ...prev, [sk]: next }));
    if (next && !objectsByConnSchema[sk]) {
      try {
        await loadSchemaObjects(connId, schemaName);
        setExpandedGroups((prev) => ({ ...prev, [`${sk}:tables`]: true }));
      } catch (err) {
        onShowToast(`Failed loading schema "${schemaName}": ${err}`, 'error');
      }
    }
  };

  const toggleTable = async (connId: string, schema: string, tableName: string) => {
    const tk = `${connId}:${schema}.${tableName}`;
    const next = !expandedTables[tk];
    setExpandedTables((prev) => ({ ...prev, [tk]: next }));
    if (next && !tableColumnsCache[tk]) {
      setLoadingTableCols((p) => ({ ...p, [tk]: true }));
      try {
        const details = await getTableDetails(tableName, schema, connId);
        setTableColumnsCache((p) => ({ ...p, [tk]: details.columns }));
      } catch {
        setTableColumnsCache((p) => p);
      } finally {
        setLoadingTableCols((p) => ({ ...p, [tk]: false }));
      }
    }
  };

  const q = filterText.trim().toLowerCase();

  const filteredSavedQueries = useMemo(() => {
    if (!q) return savedQueries;
    return savedQueries.filter(
      (sq) =>
        sq.title.toLowerCase().includes(q) ||
        sq.sql.toLowerCase().includes(q) ||
        (sq.folder || '').toLowerCase().includes(q),
    );
  }, [savedQueries, q]);

  const isFavorited = (connId: string, schema: string | undefined, name: string) =>
    favorites.some((f) => f.id === `${connId}:${schema || 'main'}.${name}`);

  const handleOpenTable = (
    conn: ConnectionSummary,
    table: TableInfo,
    subTab: TableSubTab = 'data',
  ) => {
    if (activeConnectionId !== conn.id) {
      switchActiveConnection(conn.id);
    }
    openTableTab(table, conn.id, conn.name, subTab);
  };

  const handleOpenFavorite = (fav: FavoriteObject) => {
    const conn = activeConnections.find((c) => c.id === fav.connectionId);
    if (!conn) {
      onShowToast(`Connect to "${fav.connectionName}" first`, 'info');
      onOpenConnections();
      return;
    }
    openTableTab(
      {
        name: fav.name,
        schema: fav.schema,
        kind: fav.kind,
        hasPrimaryKey: true,
        isStrict: false,
        withoutRowid: false,
      },
      conn.id,
      conn.name,
    );
  };

  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    if (!treeRef.current) return;
    const focusables = Array.from(
      treeRef.current.querySelectorAll<HTMLElement>('[data-tree-item="true"]'),
    );
    const activeEl = document.activeElement as HTMLElement | null;
    const idx = activeEl ? focusables.indexOf(activeEl) : -1;
    if (idx < 0 || !activeEl) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const target = focusables[Math.min(focusables.length - 1, idx + 1)];
      target?.focus();
      target?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const target = focusables[Math.max(0, idx - 1)];
      target?.focus();
      target?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusables[0]?.focus();
      focusables[0]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = focusables[focusables.length - 1];
      last?.focus();
      last?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowRight') {
      const expanded = activeEl.getAttribute('aria-expanded');
      if (expanded === 'false' && activeEl.dataset.treeKind !== 'table') {
        e.preventDefault();
        activeEl.click();
      } else if (expanded === 'true' && idx + 1 < focusables.length) {
        e.preventDefault();
        focusables[idx + 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      const expanded = activeEl.getAttribute('aria-expanded');
      if (expanded === 'true' && activeEl.dataset.treeKind !== 'table') {
        e.preventDefault();
        activeEl.click();
      }
    } else if ((e.key === 'Enter' || e.key === ' ') && activeEl.tagName !== 'BUTTON') {
      e.preventDefault();
      activeEl.click();
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const rect = activeEl.getBoundingClientRect();
      activeEl.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: Math.min(rect.left + 28, window.innerWidth - 220),
          clientY: Math.min(rect.bottom + 2, window.innerHeight - 240),
        }),
      );
    }
  };

  return (
    <aside
      data-sidebar-root="true"
      tabIndex={-1}
      style={{ width }}
      className="relative shrink-0 bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex flex-col min-h-0 select-none outline-none"
    >
      <div
        onMouseDown={startResize}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent)]/60 transition-colors z-10"
        title="Drag to resize explorer"
      />

      <div className="h-9 shrink-0 px-2.5 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenConnections}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
            title="New / Manage Connections"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            disabled={!activeConnectionId}
            onClick={() => activeConnectionId && refreshConnectionTree(activeConnectionId)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
            title="Refresh Active Connection"
          >
            <RefreshCw
              size={13}
              className={
                activeConnectionId && loadingSchemas[activeConnectionId] ? 'animate-spin' : ''
              }
            />
          </button>
          <button
            type="button"
            disabled={!activeConnectionId}
            onClick={() => activeConnectionId && openErDiagramTab(activeConnectionId)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
            title="Open ER Diagram"
          >
            <ErDiagramIcon size={13} />
          </button>
          <button
            type="button"
            disabled={!activeConnectionId}
            onClick={onOpenCreateTable}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
            title="Create Table"
          >
            <Table size={13} />
          </button>
        </div>
      </div>

      <div className="p-2 border-b border-[var(--border-subtle)]">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter objects & queries… (Ctrl+Shift+F)"
            className="w-full pl-7 pr-6 py-1 text-[11.5px] bg-[var(--bg)] border border-[var(--border)] rounded-md"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              title="Clear filter"
              aria-label="Clear filter"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={treeRef}
        onKeyDown={handleTreeKeyDown}
        className="flex-1 overflow-y-auto py-1 space-y-1"
      >
        <ExplorerConnectionTree
          isOpen={sectionOpen.explorer}
          activeConnections={activeConnections}
          activeConnectionId={activeConnectionId}
          schemasByConn={schemasByConn}
          objectsByConnSchema={objectsByConnSchema}
          overviews={overviews}
          loadingSchemas={loadingSchemas}
          loadingObjects={loadingObjects}
          filterQuery={q}
          expandedConns={expandedConns}
          expandedSchemas={expandedSchemas}
          expandedGroups={expandedGroups}
          expandedTables={expandedTables}
          tableColumnsCache={tableColumnsCache}
          loadingTableCols={loadingTableCols}
          isFavorited={isFavorited}
          onToggleSection={() => setSectionOpen((s) => ({ ...s, explorer: !s.explorer }))}
          onOpenConnections={onOpenConnections}
          onSwitchActiveConnection={switchActiveConnection}
          onToggleConnectionExpand={(connId, nextOpen) =>
            setExpandedConns((p) => ({ ...p, [connId]: nextOpen }))
          }
          onOpenDatabaseInfoTab={openDatabaseInfoTab}
          onToggleSchema={toggleSchema}
          onOpenSchemaInfoTab={openSchemaInfoTab}
          onToggleGroup={(key, nextOpen) => setExpandedGroups((p) => ({ ...p, [key]: nextOpen }))}
          onToggleTable={toggleTable}
          onOpenTable={handleOpenTable}
          onToggleFavorite={toggleFavorite}
          onSetInspectorTarget={setInspectorTarget}
          onOpenContextMenu={setContextMenu}
        />

        <ExplorerSavedLists
          favorites={favorites}
          recentObjects={recentObjects}
          filteredSavedQueries={filteredSavedQueries}
          activeConnections={activeConnections}
          activeConnectionId={activeConnectionId}
          favoritesOpen={sectionOpen.favorites}
          recentOpen={sectionOpen.recent}
          queriesOpen={sectionOpen.queries}
          renamingQueryId={renamingQueryId}
          renameTitle={renameTitle}
          onToggleFavorites={() => setSectionOpen((s) => ({ ...s, favorites: !s.favorites }))}
          onToggleRecent={() => setSectionOpen((s) => ({ ...s, recent: !s.recent }))}
          onToggleQueries={() => setSectionOpen((s) => ({ ...s, queries: !s.queries }))}
          onOpenFavorite={handleOpenFavorite}
          onOpenTableTab={openTableTab}
          onOpenSqlTab={openSqlTab}
          onSaveQuery={saveQuery}
          onRemoveSavedQuery={handleRemoveSavedQuery}
          onRenameTitleChange={setRenameTitle}
          onCancelRename={() => setRenamingQueryId(null)}
          onOpenContextMenu={setContextMenu}
          onShowToast={onShowToast}
        />
      </div>

      {contextMenu && (
        <ExplorerContextMenu
          contextMenu={contextMenu}
          copiedId={copiedId}
          onClose={() => setContextMenu(null)}
          onCopyText={copyText}
          onOpenDatabaseInfoTab={openDatabaseInfoTab}
          onOpenSqlTab={openSqlTab}
          onOpenErDiagramTab={openErDiagramTab}
          onOpenSchemaDiffTab={openSchemaDiffTab}
          onRefreshConnectionTree={refreshConnectionTree}
          onDisconnect={disconnect}
          onCloseTabsForConnection={closeTabsForConnection}
          onOpenSchemaInfoTab={openSchemaInfoTab}
          onLoadSchemaObjects={loadSchemaObjects}
          onOpenTable={handleOpenTable}
          onRequestTruncateTable={onRequestTruncateTable}
          onRequestDropTable={onRequestDropTable}
          onSetInspectorTarget={setInspectorTarget}
          onStartRenameQuery={(id, title) => {
            setRenamingQueryId(id);
            setRenameTitle(title);
          }}
          onRemoveSavedQuery={handleRemoveSavedQuery}
        />
      )}
    </aside>
  );
};
