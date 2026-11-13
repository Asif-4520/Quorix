import { PanelLeft, PanelRight } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { QuorixLogo } from '../../components/ui/QuorixLogo';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import {
  closeWindow,
  isWindowFullscreen,
  isWindowMaximized,
  minimizeWindow,
  subscribeWindowResized,
  toggleFullscreenWindow,
  toggleMaximizeWindow,
} from '../../services/tauri';
import type {
  ConnectionSummary,
  SavedConnection,
  TabItem,
  ThemeMode,
  ThemeName,
} from '../../types/database';
import { ConnectionSwitcherDropdown } from './ConnectionSwitcherDropdown';
import { MenuBar } from './MenuBar';

interface TitleBarProps {
  currentConnection: ConnectionSummary | null;
  activeConnections: ConnectionSummary[];
  savedConnections: SavedConnection[];
  onSwitchActiveConnection: (id: string) => void;
  onSelectSavedConnection: (conn: SavedConnection) => void;
  onOpenNewConnectionModal: () => void;
  onDisconnect: (id?: string) => void;
  isConnecting?: boolean;
  tabs: TabItem[];
  activeTabId: string;
  onCloseTab: (id: string) => void;
  onCloseAllTabs: () => void;
  onReopenClosedTab: () => void;
  onNewSqlTab: () => void;
  hasClosedTabs: boolean;
  onOpenCommandPalette: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenShortcuts?: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  themeMode: ThemeMode;
  effectiveTheme: ThemeName;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSetThemePreset: (t: ThemeName) => void;
  onCycleTheme: () => void;
  onExecuteQuery?: () => void;
  onExplainQuery?: () => void;
  onFormatSql?: () => void;
  onOpenErDiagram: () => void;
  onOpenSchemaDiff?: () => void;
  onRefreshSchema: () => void;
  onOpenCreateTable: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentConnection,
  activeConnections,
  savedConnections,
  onSwitchActiveConnection,
  onSelectSavedConnection,
  onOpenNewConnectionModal,
  onDisconnect,
  isConnecting = false,
  tabs,
  activeTabId,
  onCloseTab,
  onCloseAllTabs,
  onReopenClosedTab,
  onNewSqlTab,
  hasClosedTabs,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenShortcuts,
  sidebarOpen,
  onToggleSidebar,
  inspectorOpen,
  onToggleInspector,
  themeMode,
  effectiveTheme,
  onSetThemeMode,
  onSetThemePreset,
  onCycleTheme,
  onExecuteQuery,
  onExplainQuery,
  onFormatSql,
  onOpenErDiagram,
  onOpenSchemaDiff,
  onRefreshSchema,
  onOpenCreateTable,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const syncWindowState = () => {
      void isWindowMaximized().then((max) => {
        if (active) setIsMaximized(max);
      });
      void isWindowFullscreen().then((fs) => {
        if (active) setIsFullscreen(fs);
      });
    };
    syncWindowState();
    void subscribeWindowResized(syncWindowState).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const handleToggleFullscreen = async () => {
    const next = await toggleFullscreenWindow();
    setIsFullscreen(next);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <header className="titlebar-shell">
      <div className="titlebar-window-row">
        <div className="titlebar-window-left">
          <button
            type="button"
            className="titlebar-brand"
            onClick={onOpenCommandPalette}
            title={`Command Palette (${formatShortcutForDisplay(getEffectiveShortcut('command-palette'))})`}
          >
            <QuorixLogo variant="mark" className="brand-logo-img" />
            <span className="brand-name">Quorix</span>
          </button>

          <MenuBar
            currentConnection={currentConnection}
            activeConnections={activeConnections}
            onSwitchConnection={onSwitchActiveConnection}
            onOpenNewConnectionModal={onOpenNewConnectionModal}
            onDisconnect={() => onDisconnect()}
            onNewSqlTab={onNewSqlTab}
            onOpenCommandPalette={onOpenCommandPalette}
            onOpenSettings={onOpenSettings}
            onOpenShortcuts={onOpenShortcuts}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={onToggleSidebar}
            inspectorOpen={inspectorOpen}
            onToggleInspector={onToggleInspector}
            themeMode={themeMode}
            effectiveTheme={effectiveTheme}
            onSetThemeMode={onSetThemeMode}
            onSetThemePreset={onSetThemePreset}
            onCycleTheme={onCycleTheme}
            onCloseActiveTab={() => activeTabId && onCloseTab(activeTabId)}
            onReopenClosedTab={onReopenClosedTab}
            onCloseAllTabs={onCloseAllTabs}
            onRefreshSchema={onRefreshSchema}
            onOpenErDiagram={onOpenErDiagram}
            onOpenSchemaDiff={onOpenSchemaDiff}
            onOpenCreateTable={onOpenCreateTable}
            onExecuteQuery={onExecuteQuery}
            onExplainQuery={onExplainQuery}
            onFormatSql={onFormatSql}
            hasActiveTabs={tabs.length > 0}
            hasClosedTabs={hasClosedTabs}
            isSqlTabActive={activeTab?.type === 'sql'}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => void handleToggleFullscreen()}
          />
        </div>

        <div className="titlebar-window-center" data-tauri-drag-region>
          <div className="titlebar-drag-spacer" data-tauri-drag-region />
          <ConnectionSwitcherDropdown
            currentConnection={currentConnection}
            activeConnections={activeConnections}
            savedConnections={savedConnections}
            isConnecting={isConnecting}
            onSwitchActiveConnection={onSwitchActiveConnection}
            onSelectSavedConnection={onSelectSavedConnection}
            onOpenNewConnectionModal={onOpenNewConnectionModal}
            onDisconnect={onDisconnect}
          />
          <div className="titlebar-drag-spacer" data-tauri-drag-region />
        </div>

        <div className="titlebar-window-right">
          <button
            type="button"
            className={`icon-action-btn ${sidebarOpen ? 'active' : ''}`}
            aria-label="Toggle Sidebar"
            aria-pressed={sidebarOpen}
            title={`Toggle Sidebar (${formatShortcutForDisplay(getEffectiveShortcut('toggle-sidebar'))})`}
            onClick={onToggleSidebar}
          >
            <PanelLeft size={13} />
          </button>

          <button
            type="button"
            className={`icon-action-btn ${inspectorOpen ? 'active' : ''}`}
            aria-label="Toggle Inspector Panel"
            aria-pressed={inspectorOpen}
            title={`Toggle Inspector (${formatShortcutForDisplay(getEffectiveShortcut('toggle-inspector'))})`}
            onClick={onToggleInspector}
          >
            <PanelRight size={13} />
          </button>

          <div className="titlebar-separator-line" />

          <div className="window-controls" role="group" aria-label="Window controls">
            <button
              type="button"
              className="window-control-btn"
              aria-label="Minimize"
              title={`Minimize (${formatShortcutForDisplay(getEffectiveShortcut('minimize-window'))})`}
              onClick={() => void minimizeWindow()}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button
              type="button"
              className="window-control-btn"
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
              title={`${isMaximized ? 'Restore Window' : 'Maximize Window'} (${formatShortcutForDisplay(getEffectiveShortcut('maximize-window'))})`}
              onClick={() => void toggleMaximizeWindow()}
            >
              {isMaximized ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2.5 2.5V0.5H9.5V7.5H7.5" stroke="currentColor" strokeWidth="1" />
                  <rect
                    x="0.5"
                    y="2.5"
                    width="7"
                    height="7"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <rect
                    x="0.5"
                    y="0.5"
                    width="9"
                    height="9"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="window-control-btn close"
              aria-label="Close"
              title="Close"
              onClick={() => void closeWindow()}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.1" />
                <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
