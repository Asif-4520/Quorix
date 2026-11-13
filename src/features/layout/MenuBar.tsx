import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import type { ConnectionSummary, ThemeMode, ThemeName } from '../../types/database';
import { EditMenuDropdown, FileMenuDropdown } from './FileEditMenus';
import { DatabaseMenuDropdown, HelpMenuDropdown, ViewMenuDropdown } from './ViewDatabaseHelpMenus';

interface MenuBarProps {
  currentConnection: ConnectionSummary | null;
  activeConnections: ConnectionSummary[];
  onSwitchConnection: (id: string) => void;
  onOpenNewConnectionModal: () => void;
  onDisconnect: () => void;
  onNewSqlTab: () => void;
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
  onSetThemePreset: (theme: ThemeName) => void;
  onCycleTheme: () => void;
  onCloseActiveTab: () => void;
  onReopenClosedTab: () => void;
  onCloseAllTabs: () => void;
  onRefreshSchema: () => void;
  onOpenErDiagram: () => void;
  onOpenSchemaDiff?: () => void;
  onOpenCreateTable: () => void;
  onExecuteQuery?: () => void;
  onExplainQuery?: () => void;
  onFormatSql?: () => void;
  hasActiveTabs: boolean;
  hasClosedTabs: boolean;
  isSqlTabActive: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

type MenuName = 'file' | 'edit' | 'view' | 'database' | 'help' | null;
const MENU_ORDER: Exclude<MenuName, null>[] = ['file', 'edit', 'view', 'database', 'help'];

export const MenuBar: React.FC<MenuBarProps> = ({
  currentConnection,
  activeConnections,
  onSwitchConnection,
  onOpenNewConnectionModal,
  onDisconnect,
  onNewSqlTab,
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
  onCloseActiveTab,
  onReopenClosedTab,
  onCloseAllTabs,
  onRefreshSchema,
  onOpenErDiagram,
  onOpenSchemaDiff,
  onOpenCreateTable,
  onExecuteQuery,
  onExplainQuery,
  onFormatSql,
  hasActiveTabs,
  hasClosedTabs,
  isSqlTabActive,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const [activeMenu, setActiveMenu] = useState<MenuName>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<'themes' | 'connections' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelMenuClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleMenuClose = () => {
    cancelMenuClose();
    closeTimerRef.current = setTimeout(() => {
      setActiveMenu(null);
      setActiveSubmenu(null);
    }, 140);
  };

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    },
    [],
  );

  const focusTrigger = (name: Exclude<MenuName, null>) => {
    requestAnimationFrame(() => {
      const el = menuRef.current?.querySelector<HTMLButtonElement>(`[data-menu-trigger="${name}"]`);
      el?.focus();
    });
  };

  const focusMenuItem = (index: 'first' | 'last' | number) => {
    requestAnimationFrame(() => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '.menubar-dropdown > .menubar-dropdown-item:not(:disabled), .menubar-submenu-wrapper > .menubar-dropdown-item:not(:disabled)',
        ) ?? [],
      );
      if (items.length === 0) return;
      if (index === 'first') items[0].focus();
      else if (index === 'last') items[items.length - 1].focus();
      else {
        const clamped = ((index % items.length) + items.length) % items.length;
        items[clamped].focus();
      }
    });
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isTrigger = target.hasAttribute('data-menu-trigger');
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '.menubar-dropdown > .menubar-dropdown-item:not(:disabled), .menubar-submenu-wrapper > .menubar-dropdown-item:not(:disabled)',
      ) ?? [],
    );
    const currentItemIdx = items.indexOf(target as HTMLButtonElement);

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const base =
        activeMenu ??
        (target.getAttribute('data-menu-trigger') as Exclude<MenuName, null>) ??
        'file';
      const next = MENU_ORDER[(MENU_ORDER.indexOf(base) + 1) % MENU_ORDER.length];
      if (activeMenu) {
        setActiveMenu(next);
        setActiveSubmenu(null);
        focusMenuItem('first');
      } else {
        focusTrigger(next);
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const base =
        activeMenu ??
        (target.getAttribute('data-menu-trigger') as Exclude<MenuName, null>) ??
        'file';
      const prev =
        MENU_ORDER[(MENU_ORDER.indexOf(base) - 1 + MENU_ORDER.length) % MENU_ORDER.length];
      if (activeMenu) {
        setActiveMenu(prev);
        setActiveSubmenu(null);
        focusMenuItem('first');
      } else {
        focusTrigger(prev);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isTrigger) {
        const menuName = target.getAttribute('data-menu-trigger') as Exclude<MenuName, null>;
        setActiveMenu(menuName);
        focusMenuItem('first');
      } else if (items.length > 0) {
        focusMenuItem(currentItemIdx >= 0 ? currentItemIdx + 1 : 0);
      }
      return;
    }

    if (e.key === 'ArrowUp' && currentItemIdx >= 0 && items.length > 0) {
      e.preventDefault();
      focusMenuItem(currentItemIdx - 1);
      return;
    }

    if (e.key === 'Home' && activeMenu) {
      e.preventDefault();
      focusMenuItem('first');
      return;
    }

    if (e.key === 'End' && activeMenu) {
      e.preventDefault();
      focusMenuItem('last');
      return;
    }

    if (e.key === 'Escape' && activeMenu) {
      e.preventDefault();
      const current = activeMenu;
      setActiveMenu(null);
      setActiveSubmenu(null);
      focusTrigger(current);
    }
  };

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setActiveSubmenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        setActiveSubmenu(null);
      }
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleOutside);
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [activeMenu]);

  const closeMenu = () => {
    cancelMenuClose();
    setActiveMenu(null);
    setActiveSubmenu(null);
  };

  const toggleMenu = (name: Exclude<MenuName, null>) => {
    cancelMenuClose();
    setActiveMenu((prev) => (prev === name ? null : name));
    setActiveSubmenu(null);
  };

  const openMenuOnHover = (name: Exclude<MenuName, null>) => {
    cancelMenuClose();
    if (activeMenu !== name) {
      setActiveMenu(name);
      setActiveSubmenu(null);
    }
  };

  const sc = (id: string) => formatShortcutForDisplay(getEffectiveShortcut(id));

  return (
    <div
      className="desktop-menubar"
      ref={menuRef}
      role="menubar"
      aria-label="Application Menu"
      data-menubar-root="true"
      onKeyDown={handleMenuKeyDown}
      onMouseEnter={cancelMenuClose}
      onMouseLeave={scheduleMenuClose}
    >
      <div className="menubar-item-wrapper" onMouseEnter={() => openMenuOnHover('file')}>
        <button
          type="button"
          data-menu-trigger="file"
          data-menubar-first-trigger="true"
          className={`menubar-trigger ${activeMenu === 'file' ? 'active' : ''}`}
          onClick={() => toggleMenu('file')}
        >
          File
        </button>
        {activeMenu === 'file' && (
          <FileMenuDropdown
            currentConnection={currentConnection}
            hasActiveTabs={hasActiveTabs}
            hasClosedTabs={hasClosedTabs}
            sc={sc}
            closeMenu={closeMenu}
            onOpenNewConnectionModal={onOpenNewConnectionModal}
            onNewSqlTab={onNewSqlTab}
            onReopenClosedTab={onReopenClosedTab}
            onCloseActiveTab={onCloseActiveTab}
            onCloseAllTabs={onCloseAllTabs}
            onOpenSettings={onOpenSettings}
            onDisconnect={onDisconnect}
          />
        )}
      </div>

      <div className="menubar-item-wrapper" onMouseEnter={() => openMenuOnHover('edit')}>
        <button
          type="button"
          data-menu-trigger="edit"
          className={`menubar-trigger ${activeMenu === 'edit' ? 'active' : ''}`}
          onClick={() => toggleMenu('edit')}
        >
          Edit
        </button>
        {activeMenu === 'edit' && (
          <EditMenuDropdown
            isSqlTabActive={isSqlTabActive}
            sc={sc}
            closeMenu={closeMenu}
            onOpenCommandPalette={onOpenCommandPalette}
            onFormatSql={onFormatSql}
            onExecuteQuery={onExecuteQuery}
            onExplainQuery={onExplainQuery}
          />
        )}
      </div>

      <div className="menubar-item-wrapper" onMouseEnter={() => openMenuOnHover('view')}>
        <button
          type="button"
          data-menu-trigger="view"
          className={`menubar-trigger ${activeMenu === 'view' ? 'active' : ''}`}
          onClick={() => toggleMenu('view')}
        >
          View
        </button>
        {activeMenu === 'view' && (
          <ViewMenuDropdown
            sidebarOpen={sidebarOpen}
            inspectorOpen={inspectorOpen}
            isFullscreen={isFullscreen}
            themeMode={themeMode}
            effectiveTheme={effectiveTheme}
            activeSubmenu={activeSubmenu}
            setActiveSubmenu={setActiveSubmenu}
            sc={sc}
            closeMenu={closeMenu}
            onToggleSidebar={onToggleSidebar}
            onToggleInspector={onToggleInspector}
            onToggleFullscreen={onToggleFullscreen}
            onSetThemeMode={onSetThemeMode}
            onSetThemePreset={onSetThemePreset}
            onCycleTheme={onCycleTheme}
          />
        )}
      </div>

      <div className="menubar-item-wrapper" onMouseEnter={() => openMenuOnHover('database')}>
        <button
          type="button"
          data-menu-trigger="database"
          className={`menubar-trigger ${activeMenu === 'database' ? 'active' : ''}`}
          onClick={() => toggleMenu('database')}
        >
          Database
        </button>
        {activeMenu === 'database' && (
          <DatabaseMenuDropdown
            currentConnection={currentConnection}
            activeConnections={activeConnections}
            activeSubmenu={activeSubmenu}
            setActiveSubmenu={setActiveSubmenu}
            sc={sc}
            closeMenu={closeMenu}
            onOpenNewConnectionModal={onOpenNewConnectionModal}
            onSwitchConnection={onSwitchConnection}
            onRefreshSchema={onRefreshSchema}
            onOpenErDiagram={onOpenErDiagram}
            onOpenSchemaDiff={onOpenSchemaDiff}
            onOpenCreateTable={onOpenCreateTable}
          />
        )}
      </div>

      <div className="menubar-item-wrapper" onMouseEnter={() => openMenuOnHover('help')}>
        <button
          type="button"
          data-menu-trigger="help"
          className={`menubar-trigger ${activeMenu === 'help' ? 'active' : ''}`}
          onClick={() => toggleMenu('help')}
        >
          Help
        </button>
        {activeMenu === 'help' && (
          <HelpMenuDropdown
            sc={sc}
            closeMenu={closeMenu}
            onOpenShortcuts={onOpenShortcuts}
            onOpenSettings={onOpenSettings}
          />
        )}
      </div>
    </div>
  );
};
