import { useCallback, useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { TooltipHost } from '../components/ui/TooltipHost';
import { Sidebar } from '../features/explorer/Sidebar';
import { StatusBar } from '../features/layout/StatusBar';
import { TitleBar } from '../features/layout/TitleBar';
import { ToolWindowStrip } from '../features/layout/ToolWindowStrip';
import type { PaletteScope } from '../features/palette/CommandPalette';
import type { SqlEditorHandle } from '../features/sqleditor/SqlEditor';
import {
  cancelQuery,
  dropTable,
  isTauri,
  openSettingsDesktopWindow,
  openShortcutsDesktopWindow,
  subscribeCrossWindowClearHistory,
  subscribeCrossWindowOpenSettings,
  subscribeCrossWindowSettingsUpdated,
  subscribeCrossWindowShortcutsUpdated,
  truncateTable,
} from '../services/tauri';
import { useConnectionStore } from '../stores/connectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { applyTheme, THEMES } from '../theme/themes';
import { AppModals } from './AppModals';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import { WorkspaceViewport } from './WorkspaceViewport';

export default function App() {
  const settings = useSettingsStore((s) => s.settings);
  const effectiveTheme = useSettingsStore((s) => s.effectiveTheme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setGlobalFontSize = useSettingsStore((s) => s.setGlobalFontSize);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const setThemePreset = useSettingsStore((s) => s.setThemePreset);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);
  const syncSystemTheme = useSettingsStore((s) => s.syncSystemTheme);

  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const savedConnections = useConnectionStore((s) => s.savedConnections);
  const schemasByConn = useConnectionStore((s) => s.schemasByConn);
  const introspectionsByConn = useConnectionStore((s) => s.introspectionsByConn);
  const loadingSchemas = useConnectionStore((s) => s.loadingSchemas);
  const connectingId = useConnectionStore((s) => s.connectingId);
  const hydrateConnections = useConnectionStore((s) => s.hydrateConnections);
  const switchActiveConnection = useConnectionStore((s) => s.switchActiveConnection);
  const connectSavedProfile = useConnectionStore((s) => s.connectSavedProfile);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const refreshConnectionTree = useConnectionStore((s) => s.refreshConnectionTree);

  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const closedTabs = useWorkspaceStore((s) => s.closedTabs);
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const sidebarWidth = useWorkspaceStore((s) => s.sidebarWidth);
  const inspectorOpen = useWorkspaceStore((s) => s.inspectorOpen);
  const inspectorWidth = useWorkspaceStore((s) => s.inspectorWidth);
  const inspectorTarget = useWorkspaceStore((s) => s.inspectorTarget);
  const savedQueries = useWorkspaceStore((s) => s.savedQueries);
  const runningQueries = useWorkspaceStore((s) => s.runningQueries);
  const activeStatusMetrics = useWorkspaceStore((s) => s.activeStatusMetrics);

  const setSidebarOpen = useWorkspaceStore((s) => s.setSidebarOpen);
  const setSidebarWidth = useWorkspaceStore((s) => s.setSidebarWidth);
  const setInspectorOpen = useWorkspaceStore((s) => s.setInspectorOpen);
  const setInspectorWidth = useWorkspaceStore((s) => s.setInspectorWidth);
  const openTableTab = useWorkspaceStore((s) => s.openTableTab);
  const openSqlTab = useWorkspaceStore((s) => s.openSqlTab);
  const openErDiagramTab = useWorkspaceStore((s) => s.openErDiagramTab);
  const openSchemaDiffTab = useWorkspaceStore((s) => s.openSchemaDiffTab);
  const openSchemaInfoTab = useWorkspaceStore((s) => s.openSchemaInfoTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const updateTab = useWorkspaceStore((s) => s.updateTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const closeOtherTabs = useWorkspaceStore((s) => s.closeOtherTabs);
  const closeAllUnpinnedTabs = useWorkspaceStore((s) => s.closeAllUnpinnedTabs);
  const reopenClosedTab = useWorkspaceStore((s) => s.reopenClosedTab);
  const togglePinTab = useWorkspaceStore((s) => s.togglePinTab);
  const cycleTab = useWorkspaceStore((s) => s.cycleTab);
  const closeTabsForConnection = useWorkspaceStore((s) => s.closeTabsForConnection);

  const [showConnections, setShowConnections] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteScope, setPaletteScope] = useState<PaletteScope>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>('appearance');
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    sql?: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const activeEditorRef = useRef<SqlEditorHandle | null>(null);
  const explorerSearchRef = useRef<HTMLInputElement>(null);

  const openUniversalPalette = useCallback((scope: PaletteScope = 'all', toggle = false) => {
    setPaletteScope(scope);
    setShowPalette((prev) => (toggle ? !prev : true));
  }, []);

  useEffect(() => {
    applyTheme(effectiveTheme);
    document.documentElement.style.fontSize = `${settings.uiFontSize}px`;
  }, [effectiveTheme, settings.uiFontSize]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => syncSystemTheme();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [syncSystemTheme]);

  useEffect(() => {
    void hydrateConnections().then((conn) => {
      if (!conn && useWorkspaceStore.getState().tabs.length === 0) {
        setShowConnections(true);
      }
    });
  }, [hydrateConnections]);

  const currentConnection =
    activeConnections.find((c) => c.id === activeConnectionId) ?? activeConnections[0] ?? null;
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabConnection =
    activeConnections.find((c) => c.id === activeTab?.connectionId) ?? currentConnection;
  const activeIntrospection = currentConnection
    ? (introspectionsByConn[currentConnection.id] ?? null)
    : null;

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (type === 'error') toast.error(msg);
    else if (type === 'success') toast.success(msg);
    else toast.info(msg);
  }, []);

  const handleRequestDropTable = useCallback(
    (connId: string, tableName: string, schema?: string) => {
      const qual = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
      const sql = `DROP TABLE ${qual};`;
      const run = async () => {
        try {
          await dropTable({
            connectionId: connId,
            name: tableName,
            schema,
            cascade: false,
          });
          toast.success(`Table "${tableName}" dropped`);
          await refreshConnectionTree(connId);
        } catch (err) {
          toast.error(`Drop table failed: ${err}`);
        }
      };

      if (!settings.confirmDropTable) {
        void run();
        return;
      }
      setConfirmModal({
        isOpen: true,
        title: 'Drop Table',
        message: `Permanently drop table "${tableName}"? This action cannot be undone.`,
        sql,
        onConfirm: run,
      });
    },
    [settings.confirmDropTable, refreshConnectionTree],
  );

  const handleRequestTruncateTable = useCallback(
    (connId: string, tableName: string, schema?: string) => {
      const qual = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
      const sql = `TRUNCATE TABLE ${qual};`;
      const run = async () => {
        try {
          await truncateTable({ connectionId: connId, name: tableName, schema });
          toast.success(`Table "${tableName}" truncated`);
          await refreshConnectionTree(connId);
        } catch (err) {
          toast.error(`Truncate failed: ${err}`);
        }
      };

      if (!settings.confirmTruncateTable) {
        void run();
        return;
      }
      setConfirmModal({
        isOpen: true,
        title: 'Truncate Table',
        message: `Delete all rows from "${tableName}"?`,
        sql,
        onConfirm: run,
      });
    },
    [settings.confirmTruncateTable, refreshConnectionTree],
  );

  const openShortcutsWindow = useCallback(() => {
    void openShortcutsDesktopWindow().then((openedDesktop) => {
      if (!openedDesktop) {
        setShowShortcuts(true);
      }
    });
  }, []);

  const openSettingsModalLocal = useCallback((tab?: string) => {
    setSettingsTab(tab || 'appearance');
    setShowSettings(true);
  }, []);

  const openSettingsSection = useCallback(
    (tab?: string) => {
      if (tab === 'shortcuts') {
        openShortcutsWindow();
        return;
      }
      const targetTab = tab || 'appearance';
      void openSettingsDesktopWindow(targetTab).then((openedDesktop) => {
        if (!openedDesktop) {
          openSettingsModalLocal(targetTab);
        }
      });
    },
    [openShortcutsWindow, openSettingsModalLocal],
  );

  useEffect(() => {
    let active = true;
    let unlistenShortcuts: (() => void) | null = null;
    let unlistenOpenSettings: (() => void) | null = null;
    let unlistenSettingsUpdated: (() => void) | null = null;
    let unlistenClearHistory: (() => void) | null = null;

    void subscribeCrossWindowShortcutsUpdated(() => {
      window.dispatchEvent(new Event('quorix-shortcuts-updated'));
    }).then((fn) => {
      if (active) unlistenShortcuts = fn;
      else fn?.();
    });

    void subscribeCrossWindowOpenSettings((tab) => {
      openSettingsModalLocal(tab);
    }).then((fn) => {
      if (active) unlistenOpenSettings = fn;
      else fn?.();
    });

    void subscribeCrossWindowSettingsUpdated(() => {
      useSettingsStore.getState().syncFromStorage();
    }).then((fn) => {
      if (active) unlistenSettingsUpdated = fn;
      else fn?.();
    });

    void subscribeCrossWindowClearHistory(() => {
      useWorkspaceStore.getState().clearHistory();
    }).then((fn) => {
      if (active) unlistenClearHistory = fn;
      else fn?.();
    });

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes('keybindings')) {
        window.dispatchEvent(new Event('quorix-shortcuts-updated'));
      }
      if (!e.key || e.key.includes('settings')) {
        useSettingsStore.getState().syncFromStorage();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      unlistenShortcuts?.();
      unlistenOpenSettings?.();
      unlistenSettingsUpdated?.();
      unlistenClearHistory?.();
      window.removeEventListener('storage', onStorage);
    };
  }, [openSettingsModalLocal]);

  useGlobalShortcuts({
    activeTabId,
    currentConnection,
    sidebarOpen,
    inspectorOpen,
    settings,
    effectiveTheme,
    explorerSearchRef,
    onDismissModals: () => {
      setShowPalette(false);
      setShowConnections(false);
      setShowSettings(false);
      setShowShortcuts(false);
      setShowCreateTable(false);
      setConfirmModal((p) => ({ ...p, isOpen: false }));
    },
    onOpenPalette: openUniversalPalette,
    onSetSidebarOpen: setSidebarOpen,
    onSetInspectorOpen: setInspectorOpen,
    onOpenConnections: () => setShowConnections(true),
    onOpenCreateTable: () => setShowCreateTable(true),
    onOpenSettings: openSettingsSection,
    onToggleShortcuts: () => {
      if (isTauri()) {
        openShortcutsWindow();
      } else {
        setShowShortcuts((p) => !p);
      }
    },
    onRefreshConnectionTree: (id) => void refreshConnectionTree(id),
    onTogglePinTab: togglePinTab,
    onDisconnect: (id) => disconnect(id),
    onCloseTab: closeTab,
    onReopenClosedTab: reopenClosedTab,
    onCloseAllUnpinnedTabs: closeAllUnpinnedTabs,
    onCloseOtherTabs: closeOtherTabs,
    onCycleTab: cycleTab,
    onOpenSqlTab: (connId) => openSqlTab({ connectionId: connId }),
    onOpenErDiagramTab: (id) => openErDiagramTab(id),
    onOpenSchemaDiffTab: (id) => openSchemaDiffTab(id),
    onUpdateSettings: updateSettings,
    onSetGlobalFontSize: setGlobalFontSize,
    onSetThemeMode: setThemeMode,
    onCycleTheme: cycleTheme,
  });

  const firstRunning = Object.entries(runningQueries)[0];

  return (
    <div className="quorix-root">
      <TitleBar
        currentConnection={currentConnection}
        activeConnections={activeConnections}
        savedConnections={savedConnections}
        onSwitchActiveConnection={switchActiveConnection}
        onSelectSavedConnection={async (conn) => {
          try {
            const summary = await connectSavedProfile(conn);
            toast.success(`Connected to ${summary.name}`);
          } catch (err) {
            toast.error(`Connect failed: ${err}`);
          }
        }}
        onOpenNewConnectionModal={() => setShowConnections(true)}
        onDisconnect={async (id) => {
          const targetId = id ?? currentConnection?.id;
          await disconnect(targetId);
          if (targetId) closeTabsForConnection(targetId);
          toast.info('Disconnected');
        }}
        isConnecting={Boolean(connectingId)}
        tabs={tabs}
        activeTabId={activeTabId}
        onCloseTab={closeTab}
        onCloseAllTabs={closeAllUnpinnedTabs}
        onReopenClosedTab={reopenClosedTab}
        onNewSqlTab={() => openSqlTab({ connectionId: currentConnection?.id })}
        hasClosedTabs={closedTabs.length > 0}
        onOpenCommandPalette={() => openUniversalPalette('all')}
        onOpenSettings={openSettingsSection}
        onOpenShortcuts={openShortcutsWindow}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((p) => !p)}
        themeMode={settings.themeMode}
        effectiveTheme={effectiveTheme}
        onSetThemeMode={setThemeMode}
        onSetThemePreset={setThemePreset}
        onCycleTheme={() => {
          const next = cycleTheme();
          toast.info(`Theme: ${THEMES[next].displayName}`);
        }}
        onExecuteQuery={() => activeEditorRef.current?.execute()}
        onExplainQuery={() => activeEditorRef.current?.explain()}
        onFormatSql={() => activeEditorRef.current?.formatSql()}
        onOpenErDiagram={() => currentConnection && openErDiagramTab(currentConnection.id)}
        onOpenSchemaDiff={() => currentConnection && openSchemaDiffTab(currentConnection.id)}
        onRefreshSchema={() =>
          currentConnection && void refreshConnectionTree(currentConnection.id)
        }
        onOpenCreateTable={() => setShowCreateTable(true)}
      />

      <div className="quorix-body-layout">
        {settings.toolRailVisible !== false && (
          <ToolWindowStrip
            databaseOpen={sidebarOpen}
            onToggleDatabase={() => setSidebarOpen((p) => !p)}
            onOpenNewConsole={() => openSqlTab({ connectionId: currentConnection?.id })}
            onOpenErDiagram={() => currentConnection && openErDiagramTab(currentConnection.id)}
            onOpenSchemaDiff={() => currentConnection && openSchemaDiffTab(currentConnection.id)}
            onOpenSettings={() => openSettingsSection('appearance')}
            isConnected={Boolean(currentConnection)}
          />
        )}

        {sidebarOpen && (
          <Sidebar
            width={sidebarWidth}
            onResizeWidth={setSidebarWidth}
            searchInputRef={explorerSearchRef}
            onOpenConnections={() => setShowConnections(true)}
            onOpenCreateTable={() => setShowCreateTable(true)}
            onRequestDropTable={handleRequestDropTable}
            onRequestTruncateTable={handleRequestTruncateTable}
            onRequestConfirm={(title, message, sql, onConfirm) =>
              setConfirmModal({ isOpen: true, title, message, sql, onConfirm })
            }
            onShowToast={showToast}
          />
        )}

        <WorkspaceViewport
          tabs={tabs}
          activeTabId={activeTabId}
          activeTab={activeTab}
          currentConnection={currentConnection}
          tabConnection={tabConnection}
          activeConnectionId={activeConnectionId}
          hasClosedTabs={closedTabs.length > 0}
          isRefreshingSchema={Boolean(currentConnection && loadingSchemas[currentConnection.id])}
          inspectorOpen={inspectorOpen}
          inspectorWidth={inspectorWidth}
          inspectorTarget={inspectorTarget}
          activeEditorRef={activeEditorRef}
          onSelectTab={setActiveTab}
          onSwitchActiveConnection={switchActiveConnection}
          onCloseTab={closeTab}
          onCloseOtherTabs={closeOtherTabs}
          onCloseAllTabs={closeAllUnpinnedTabs}
          onReopenClosedTab={reopenClosedTab}
          onTogglePinTab={togglePinTab}
          onNewSqlTab={() => openSqlTab({ connectionId: currentConnection?.id })}
          onRefreshSchema={() =>
            currentConnection && void refreshConnectionTree(currentConnection.id)
          }
          onOpenErDiagram={() => currentConnection && openErDiagramTab(currentConnection.id)}
          onOpenCommandPalette={() => openUniversalPalette('all')}
          onToggleInspector={() => setInspectorOpen((p) => !p)}
          onCloseInspector={() => setInspectorOpen(false)}
          onResizeInspectorWidth={setInspectorWidth}
          onOpenConnections={() => setShowConnections(true)}
          onOpenCreateTable={() => setShowCreateTable(true)}
          onUpdateTab={updateTab}
          onOpenTableTab={openTableTab}
          onShowToast={showToast}
          onRequestConfirm={(title, message, sql, onConfirm) =>
            setConfirmModal({ isOpen: true, title, message, sql, onConfirm })
          }
        />
      </div>

      {settings.statusBarVisible !== false && (
        <StatusBar
          currentConnection={tabConnection}
          activeConnectionCount={activeConnections.length}
          activeTabTitle={activeTab?.title}
          activeTabType={activeTab?.type}
          rowsInfo={activeStatusMetrics.rowsInfo}
          cellInfo={activeStatusMetrics.cellInfo}
          durationMs={activeStatusMetrics.durationMs}
          txState={activeStatusMetrics.txState}
          runningQueryId={firstRunning?.[0]}
          runningLabel={firstRunning?.[1].label}
          tableCount={
            activeIntrospection
              ? activeIntrospection.tables.filter(
                  (t) => t.kind === 'table' || t.kind === 'partitioned_table',
                ).length
              : undefined
          }
          viewCount={
            activeIntrospection
              ? activeIntrospection.tables.filter(
                  (t) => t.kind === 'view' || t.kind === 'materialized_view',
                ).length
              : undefined
          }
          themeName={THEMES[effectiveTheme]?.displayName}
          onCancelRunningQuery={(qid) => void cancelQuery(qid)}
          onNewSqlTab={() => openSqlTab({ connectionId: currentConnection?.id })}
          onRefreshSchema={() =>
            currentConnection && void refreshConnectionTree(currentConnection.id)
          }
          onCycleTheme={() => {
            const next = cycleTheme();
            toast.info(`Theme: ${THEMES[next].displayName}`);
          }}
        />
      )}

      <AppModals
        showPalette={showPalette}
        paletteScope={paletteScope}
        showSettings={showSettings}
        settingsTab={settingsTab}
        showShortcuts={showShortcuts}
        showConnections={showConnections}
        showCreateTable={showCreateTable}
        confirmModal={confirmModal}
        currentConnection={currentConnection}
        schemasByConn={schemasByConn}
        activeIntrospection={activeIntrospection}
        isSqlActive={activeTab?.type === 'sql'}
        savedQueries={savedQueries}
        savedConnections={savedConnections}
        activeTabId={activeTabId}
        onClosePalette={() => setShowPalette(false)}
        onCloseSettings={() => setShowSettings(false)}
        onCloseShortcuts={() => setShowShortcuts(false)}
        onCloseConnections={() => setShowConnections(false)}
        onCloseCreateTable={() => setShowCreateTable(false)}
        onCancelConfirm={() => setConfirmModal((p) => ({ ...p, isOpen: false }))}
        onOpenConfirm={(title, message, onConfirm) =>
          setConfirmModal({ isOpen: true, title, message, onConfirm })
        }
        onOpenConnections={() => setShowConnections(true)}
        onOpenSettings={openSettingsSection}
        onOpenShortcuts={openShortcutsWindow}
        onDisconnect={() => currentConnection && void disconnect(currentConnection.id)}
        onNewSqlTab={() => openSqlTab({ connectionId: currentConnection?.id })}
        onOpenTable={(tbl) =>
          currentConnection && openTableTab(tbl, currentConnection.id, currentConnection.name)
        }
        onOpenSchema={(schemaName) =>
          currentConnection && openSchemaInfoTab(currentConnection.id, schemaName)
        }
        onOpenSavedQuery={(q) =>
          openSqlTab({
            title: q.title,
            sql: q.sql,
            connectionId: q.connectionId || currentConnection?.id,
            savedQueryId: q.id,
          })
        }
        onSelectSavedConnection={(sc) => void connectSavedProfile(sc)}
        onOpenErDiagram={() => currentConnection && openErDiagramTab(currentConnection.id)}
        onOpenSchemaDiff={() => currentConnection && openSchemaDiffTab(currentConnection.id)}
        onRefreshSchema={() =>
          currentConnection && void refreshConnectionTree(currentConnection.id)
        }
        onExecuteQuery={() => activeEditorRef.current?.execute()}
        onExecuteAll={() => activeEditorRef.current?.executeAll()}
        onExplainQuery={() => activeEditorRef.current?.explain()}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        onToggleInspector={() => setInspectorOpen((p) => !p)}
        onOpenCreateTable={() => setShowCreateTable(true)}
        onSetThemeMode={setThemeMode}
        onSetThemePreset={setThemePreset}
        onReopenClosedTab={reopenClosedTab}
        onCloseActiveTab={() => activeTabId && closeTab(activeTabId)}
        onShowToast={showToast}
      />

      <Toaster
        position="bottom-right"
        theme={THEMES[effectiveTheme]?.isDark ? 'dark' : 'light'}
        closeButton
        richColors
      />

      <TooltipHost />
    </div>
  );
}
