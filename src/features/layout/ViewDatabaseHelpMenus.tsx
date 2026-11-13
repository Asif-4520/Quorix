import {
  Check,
  ChevronRight,
  Database,
  GitCompareArrows,
  Info,
  Keyboard,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Palette,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Sun,
  Table,
} from 'lucide-react';
import type React from 'react';
import { EngineIcon, ErDiagramIcon } from '../../components/ui/DatabaseIcons';
import { Kbd } from '../../components/ui/Kbd';
import { getEngineShortLabel } from '../../services/envTag';
import { minimizeWindow, toggleMaximizeWindow } from '../../services/tauri';
import { THEMES } from '../../theme/themes';
import type { ConnectionSummary, ThemeMode, ThemeName } from '../../types/database';

interface ViewMenuDropdownProps {
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  isFullscreen: boolean;
  themeMode: ThemeMode;
  effectiveTheme: ThemeName;
  activeSubmenu: 'themes' | 'connections' | null;
  setActiveSubmenu: (submenu: 'themes' | 'connections' | null) => void;
  sc: (id: string) => string;
  closeMenu: () => void;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onToggleFullscreen?: () => void;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSetThemePreset: (theme: ThemeName) => void;
  onCycleTheme: () => void;
}

export const ViewMenuDropdown: React.FC<ViewMenuDropdownProps> = ({
  sidebarOpen,
  inspectorOpen,
  isFullscreen,
  themeMode,
  effectiveTheme,
  activeSubmenu,
  setActiveSubmenu,
  sc,
  closeMenu,
  onToggleSidebar,
  onToggleInspector,
  onToggleFullscreen,
  onSetThemeMode,
  onSetThemePreset,
  onCycleTheme,
}) => (
  <div className="menubar-dropdown animate-fade-in">
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onToggleSidebar();
      }}
    >
      <PanelLeft size={13} className="item-icon" />
      <span className="item-label">
        {sidebarOpen ? 'Hide Explorer Sidebar' : 'Show Explorer Sidebar'}
      </span>
      <Kbd size="xs">{sc('toggle-sidebar')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onToggleInspector();
      }}
    >
      <PanelRight size={13} className="item-icon" />
      <span className="item-label">
        {inspectorOpen ? 'Hide Inspector Panel' : 'Show Inspector Panel'}
      </span>
      <Kbd size="xs">{sc('toggle-inspector')}</Kbd>
    </button>

    <div className="menubar-separator" />

    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onToggleFullscreen?.();
      }}
    >
      {isFullscreen ? (
        <Minimize2 size={13} className="item-icon accent" />
      ) : (
        <Maximize2 size={13} className="item-icon accent" />
      )}
      <span className="item-label">
        {isFullscreen ? 'Exit Fullscreen Mode' : 'Enter Fullscreen Mode'}
      </span>
      <Kbd size="xs">{sc('toggle-fullscreen')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        void minimizeWindow();
      }}
    >
      <span className="item-icon text-center w-[13px]">_</span>
      <span className="item-label">Minimize Window</span>
      <Kbd size="xs">{sc('minimize-window')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        void toggleMaximizeWindow();
      }}
    >
      <span className="item-icon text-center w-[13px]">□</span>
      <span className="item-label">Maximize / Restore Window</span>
      <Kbd size="xs">{sc('maximize-window')}</Kbd>
    </button>

    <div className="menubar-separator" />

    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onSetThemeMode('system');
      }}
    >
      <Monitor size={13} className="item-icon" />
      <span className="item-label">System Theme</span>
      {themeMode === 'system' && <Check size={12} className="check-icon" />}
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onSetThemeMode('dark');
      }}
    >
      <Moon size={13} className="item-icon" />
      <span className="item-label">Dark Theme</span>
      {themeMode === 'dark' && <Check size={12} className="check-icon" />}
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onSetThemeMode('light');
      }}
    >
      <Sun size={13} className="item-icon" />
      <span className="item-label">Light Theme</span>
      {themeMode === 'light' && <Check size={12} className="check-icon" />}
    </button>

    <div className="menubar-submenu-wrapper" onMouseEnter={() => setActiveSubmenu('themes')}>
      <button
        type="button"
        className="menubar-dropdown-item"
        onClick={() => {
          closeMenu();
          onCycleTheme();
        }}
      >
        <Palette size={13} className="item-icon accent" />
        <span className="item-label">Theme Presets</span>
        <ChevronRight size={13} className="submenu-arrow" />
      </button>
      {activeSubmenu === 'themes' && (
        <div className="menubar-subdropdown animate-fade-in">
          {Object.values(THEMES).map((t) => (
            <button
              type="button"
              key={t.name}
              className={`menubar-dropdown-item ${effectiveTheme === t.name ? 'selected' : ''}`}
              onClick={() => {
                onSetThemePreset(t.name);
                closeMenu();
              }}
            >
              <span className="theme-swatch" style={{ background: t.accent }} />
              <span className="item-label">{t.displayName}</span>
              {effectiveTheme === t.name && <Check size={12} className="check-icon" />}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

interface DatabaseMenuDropdownProps {
  currentConnection: ConnectionSummary | null;
  activeConnections: ConnectionSummary[];
  activeSubmenu: 'themes' | 'connections' | null;
  setActiveSubmenu: (submenu: 'themes' | 'connections' | null) => void;
  sc: (id: string) => string;
  closeMenu: () => void;
  onOpenNewConnectionModal: () => void;
  onSwitchConnection: (id: string) => void;
  onRefreshSchema: () => void;
  onOpenErDiagram: () => void;
  onOpenSchemaDiff?: () => void;
  onOpenCreateTable: () => void;
}

export const DatabaseMenuDropdown: React.FC<DatabaseMenuDropdownProps> = ({
  currentConnection,
  activeConnections,
  activeSubmenu,
  setActiveSubmenu,
  sc,
  closeMenu,
  onOpenNewConnectionModal,
  onSwitchConnection,
  onRefreshSchema,
  onOpenErDiagram,
  onOpenSchemaDiff,
  onOpenCreateTable,
}) => (
  <div className="menubar-dropdown animate-fade-in">
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onOpenNewConnectionModal();
      }}
    >
      <Database size={13} className="item-icon accent" />
      <span className="item-label">Manage Connections…</span>
      <Kbd size="xs">{sc('open-connections')}</Kbd>
    </button>

    <div className="menubar-submenu-wrapper" onMouseEnter={() => setActiveSubmenu('connections')}>
      <button type="button" className="menubar-dropdown-item">
        <span className="item-label">Active Connections ({activeConnections.length})</span>
        <ChevronRight size={13} className="submenu-arrow" />
      </button>
      {activeSubmenu === 'connections' && (
        <div className="menubar-subdropdown animate-fade-in">
          {activeConnections.length === 0 ? (
            <div className="menubar-empty-note">No active connections</div>
          ) : (
            activeConnections.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`menubar-dropdown-item ${currentConnection?.id === c.id ? 'selected' : ''}`}
                onClick={() => {
                  closeMenu();
                  onSwitchConnection(c.id);
                }}
              >
                <EngineIcon
                  engine={c.engineKind}
                  size={12}
                  className={
                    c.engineKind === 'sqlite'
                      ? 'text-[var(--success)] shrink-0'
                      : 'text-[var(--info)] shrink-0'
                  }
                />
                <span className={`mini-engine-chip ${c.engineKind}`}>
                  {getEngineShortLabel(c.engineKind)}
                </span>
                <span className="item-label truncate">{c.name}</span>
                {currentConnection?.id === c.id && <Check size={12} className="check-icon" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>

    <div className="menubar-separator" />

    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!currentConnection}
      onClick={() => {
        closeMenu();
        onRefreshSchema();
      }}
    >
      <RefreshCw size={13} className="item-icon" />
      <span className="item-label">Refresh Schema Explorer</span>
      <Kbd size="xs">{sc('refresh-schema')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!currentConnection}
      onClick={() => {
        closeMenu();
        onOpenErDiagram();
      }}
    >
      <ErDiagramIcon size={13} className="item-icon" />
      <span className="item-label">ER Diagram</span>
      <Kbd size="xs">{sc('open-er')}</Kbd>
    </button>
    {onOpenSchemaDiff && (
      <button
        type="button"
        className="menubar-dropdown-item"
        disabled={!currentConnection}
        onClick={() => {
          closeMenu();
          onOpenSchemaDiff();
        }}
      >
        <GitCompareArrows size={13} className="item-icon" />
        <span className="item-label">Schema Diff &amp; Migration…</span>
        <Kbd size="xs">{sc('open-schema-diff')}</Kbd>
      </button>
    )}
    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!currentConnection || currentConnection.readOnly}
      onClick={() => {
        closeMenu();
        onOpenCreateTable();
      }}
    >
      <Table size={13} className="item-icon" />
      <span className="item-label">Create New Table…</span>
      <Kbd size="xs">{sc('create-table')}</Kbd>
    </button>
  </div>
);

interface HelpMenuDropdownProps {
  sc: (id: string) => string;
  closeMenu: () => void;
  onOpenShortcuts?: () => void;
  onOpenSettings: (tab?: string) => void;
}

export const HelpMenuDropdown: React.FC<HelpMenuDropdownProps> = ({
  sc,
  closeMenu,
  onOpenShortcuts,
  onOpenSettings,
}) => (
  <div className="menubar-dropdown animate-fade-in">
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        if (onOpenShortcuts) onOpenShortcuts();
        else onOpenSettings('shortcuts');
      }}
    >
      <Keyboard size={13} className="item-icon accent" />
      <span className="item-label">Keyboard Shortcuts</span>
      <Kbd size="xs">{sc('open-shortcuts')}</Kbd>
    </button>
    <div className="menubar-separator" />
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onOpenSettings('about');
      }}
    >
      <Info size={13} className="item-icon" />
      <span className="item-label">About Quorix</span>
      <Kbd size="xs">{sc('open-about')}</Kbd>
    </button>
  </div>
);
