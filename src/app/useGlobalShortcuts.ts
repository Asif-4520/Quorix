import type React from 'react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PaletteScope } from '../features/palette/CommandPalette';
import {
  getEffectiveShortcut,
  matchesKeyCombination,
  shouldIgnoreShortcut,
} from '../services/shortcuts';
import type { AppSettings } from '../services/storage';
import {
  closeWindow,
  minimizeWindow,
  toggleFullscreenWindow,
  toggleMaximizeWindow,
} from '../services/tauri';
import { THEMES } from '../theme/themes';
import type { ConnectionSummary, ThemeMode, ThemeName } from '../types/database';

interface UseGlobalShortcutsParams {
  activeTabId: string;
  currentConnection: ConnectionSummary | null;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  settings: AppSettings;
  effectiveTheme: ThemeName;
  explorerSearchRef: React.RefObject<HTMLInputElement | null>;
  onDismissModals: () => void;
  onOpenPalette: (scope: PaletteScope, toggle?: boolean) => void;
  onSetSidebarOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  onSetInspectorOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenConnections: () => void;
  onOpenCreateTable: () => void;
  onOpenSettings: (tab: string) => void;
  onToggleShortcuts: () => void;
  onRefreshConnectionTree: (connId: string) => void;
  onTogglePinTab: (tabId: string) => void;
  onDisconnect: (connId: string) => Promise<void>;
  onCloseTab: (tabId: string) => void;
  onReopenClosedTab: () => void;
  onCloseAllUnpinnedTabs: () => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCycleTab: (dir: 1 | -1) => void;
  onOpenSqlTab: (connId?: string) => void;
  onOpenErDiagramTab: (connId: string) => void;
  onOpenSchemaDiffTab: (connId: string) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSetGlobalFontSize: (size: number) => void;
  onSetThemeMode: (mode: ThemeMode) => void;
  onCycleTheme: () => ThemeName;
}

export function useGlobalShortcuts(params: UseGlobalShortcutsParams) {
  const latestRef = useRef(params);
  latestRef.current = params;
  const searchFocusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const focusRegion = (region: 'menubar' | 'explorer' | 'workspace' | 'inspector') => {
      const p = latestRef.current;
      if (region === 'menubar') {
        document.querySelector<HTMLElement>('[data-menubar-first-trigger="true"]')?.focus();
        return;
      }
      if (region === 'explorer') {
        p.onSetSidebarOpen(true);
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>(
            '[data-sidebar-root] [data-tree-item="true"], [data-sidebar-root]',
          );
          target?.focus();
        });
        return;
      }
      if (region === 'workspace') {
        const target = document.querySelector<HTMLElement>(
          '[data-grid-focus-target="true"], .cm-content, [data-workspace-root="true"]',
        );
        target?.focus();
        return;
      }
      if (region === 'inspector') {
        p.onSetInspectorOpen(true);
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>('[data-inspector-root]')?.focus();
        });
      }
    };

    const cyclePaneFocus = (dir: 1 | -1) => {
      const p = latestRef.current;
      const available: Array<'menubar' | 'explorer' | 'workspace' | 'inspector'> = ['menubar'];
      if (p.sidebarOpen) available.push('explorer');
      available.push('workspace');
      if (p.inspectorOpen) available.push('inspector');

      const activeEl = document.activeElement as HTMLElement | null;
      let currentRegion: 'menubar' | 'explorer' | 'workspace' | 'inspector' = 'workspace';
      if (activeEl?.closest('[data-menubar-root]')) currentRegion = 'menubar';
      else if (activeEl?.closest('[data-sidebar-root]')) currentRegion = 'explorer';
      else if (activeEl?.closest('[data-inspector-root]')) {
        currentRegion = 'inspector';
      }

      const idx = available.indexOf(currentRegion);
      const nextIdx = (((idx + dir) % available.length) + available.length) % available.length;
      focusRegion(available[nextIdx]);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const p = latestRef.current;
      if (document.querySelector('[data-recording-shortcut="true"]')) {
        return;
      }

      if (e.key === 'Escape') {
        p.onDismissModals();
        return;
      }

      const match = (id: string) =>
        !shouldIgnoreShortcut(e, id) && matchesKeyCombination(e, getEffectiveShortcut(id));

      if (match('command-palette')) {
        e.preventDefault();
        p.onOpenPalette('all', true);
      } else if (match('quick-open')) {
        e.preventDefault();
        p.onOpenPalette('objects', true);
      } else if (match('toggle-fullscreen')) {
        e.preventDefault();
        void toggleFullscreenWindow();
      } else if (match('minimize-window')) {
        e.preventDefault();
        void minimizeWindow();
      } else if (match('maximize-window')) {
        e.preventDefault();
        void toggleMaximizeWindow();
      } else if (match('close-window')) {
        e.preventDefault();
        void closeWindow();
      } else if (match('zoom-in')) {
        e.preventDefault();
        const next = Math.min(20, (p.settings.uiFontSize || 13) + 1);
        if (p.settings.syncFontSizes ?? true) {
          p.onSetGlobalFontSize(next);
          toast.info(`Global Font Size: ${next}px`);
        } else {
          p.onUpdateSettings({ uiFontSize: next });
          toast.info(`UI Font Size: ${next}px`);
        }
      } else if (match('zoom-out')) {
        e.preventDefault();
        const next = Math.max(10, (p.settings.uiFontSize || 13) - 1);
        if (p.settings.syncFontSizes ?? true) {
          p.onSetGlobalFontSize(next);
          toast.info(`Global Font Size: ${next}px`);
        } else {
          p.onUpdateSettings({ uiFontSize: next });
          toast.info(`UI Font Size: ${next}px`);
        }
      } else if (match('zoom-reset')) {
        e.preventDefault();
        if (p.settings.syncFontSizes ?? true) {
          p.onSetGlobalFontSize(13);
          toast.info('Global Font Size reset to 13px');
        } else {
          p.onUpdateSettings({ uiFontSize: 13 });
          toast.info('UI Font Size reset to 13px');
        }
      } else if (match('toggle-tool-rail')) {
        e.preventDefault();
        p.onUpdateSettings({ toolRailVisible: !p.settings.toolRailVisible });
      } else if (match('toggle-status-bar')) {
        e.preventDefault();
        p.onUpdateSettings({ statusBarVisible: !p.settings.statusBarVisible });
      } else if (match('focus-menubar')) {
        e.preventDefault();
        focusRegion('menubar');
      } else if (match('focus-explorer')) {
        e.preventDefault();
        focusRegion('explorer');
      } else if (match('focus-workspace')) {
        e.preventDefault();
        focusRegion('workspace');
      } else if (match('focus-inspector')) {
        e.preventDefault();
        focusRegion('inspector');
      } else if (match('cycle-pane')) {
        e.preventDefault();
        cyclePaneFocus(1);
      } else if (match('cycle-pane-back')) {
        e.preventDefault();
        cyclePaneFocus(-1);
      } else if (match('new-connection') || match('open-connections')) {
        e.preventDefault();
        p.onOpenConnections();
      } else if (match('search-database-objects')) {
        e.preventDefault();
        p.onSetSidebarOpen(true);
        if (searchFocusTimerRef.current !== null) {
          window.clearTimeout(searchFocusTimerRef.current);
        }
        searchFocusTimerRef.current = window.setTimeout(() => {
          p.explorerSearchRef.current?.focus();
          searchFocusTimerRef.current = null;
        }, 20);
      } else if (match('refresh-schema')) {
        e.preventDefault();
        if (p.currentConnection) {
          p.onRefreshConnectionTree(p.currentConnection.id);
        }
      } else if (match('pin-tab')) {
        if (p.activeTabId) {
          e.preventDefault();
          p.onTogglePinTab(p.activeTabId);
        }
      } else if (match('disconnect-active')) {
        if (p.currentConnection) {
          e.preventDefault();
          void p.onDisconnect(p.currentConnection.id);
        }
      } else if (match('close-tab')) {
        e.preventDefault();
        if (p.activeTabId) p.onCloseTab(p.activeTabId);
      } else if (match('reopen-closed-tab')) {
        e.preventDefault();
        p.onReopenClosedTab();
      } else if (match('close-all-tabs')) {
        e.preventDefault();
        p.onCloseAllUnpinnedTabs();
      } else if (match('close-other-tabs')) {
        if (p.activeTabId) {
          e.preventDefault();
          p.onCloseOtherTabs(p.activeTabId);
        }
      } else if (match('next-tab')) {
        e.preventDefault();
        p.onCycleTab(1);
      } else if (match('previous-tab')) {
        e.preventDefault();
        p.onCycleTab(-1);
      } else if (match('new-sql-tab')) {
        e.preventDefault();
        p.onOpenSqlTab(p.currentConnection?.id);
      } else if (match('toggle-sidebar')) {
        e.preventDefault();
        p.onSetSidebarOpen((prev) => !prev);
      } else if (match('toggle-inspector')) {
        e.preventDefault();
        p.onSetInspectorOpen((prev) => !prev);
      } else if (match('open-settings')) {
        e.preventDefault();
        p.onOpenSettings('appearance');
      } else if (match('open-editor-settings')) {
        e.preventDefault();
        p.onOpenSettings('editor');
      } else if (match('open-grid-settings')) {
        e.preventDefault();
        p.onOpenSettings('grid');
      } else if (match('open-about')) {
        e.preventDefault();
        p.onOpenSettings('about');
      } else if (match('toggle-dark-light-mode')) {
        e.preventDefault();
        const isCurrentlyDark = THEMES[p.effectiveTheme]?.isDark ?? true;
        const nextMode = isCurrentlyDark ? 'light' : 'dark';
        p.onSetThemeMode(nextMode);
        toast.info(`Theme Mode: ${nextMode === 'dark' ? 'Dark' : 'Light'}`);
      } else if (match('toggle-editor-word-wrap')) {
        e.preventDefault();
        const next = !p.settings.editorWordWrap;
        p.onUpdateSettings({ editorWordWrap: next });
        toast.info(`SQL Word Wrap: ${next ? 'On' : 'Off'}`);
      } else if (match('toggle-editor-line-numbers')) {
        e.preventDefault();
        const next = !(p.settings.editorLineNumbers ?? true);
        p.onUpdateSettings({ editorLineNumbers: next });
        toast.info(`Editor Line Numbers: ${next ? 'On' : 'Off'}`);
      } else if (match('toggle-grid-striped')) {
        e.preventDefault();
        const next = !p.settings.gridStripedRows;
        p.onUpdateSettings({ gridStripedRows: next });
        toast.info(`Striped Grid Rows: ${next ? 'On' : 'Off'}`);
      } else if (match('open-appearance-settings')) {
        e.preventDefault();
        p.onOpenSettings('appearance');
      } else if (match('open-database-settings')) {
        e.preventDefault();
        p.onOpenSettings('database');
      } else if (match('open-workspace-settings')) {
        e.preventDefault();
        p.onOpenSettings('workspace');
      } else if (match('open-performance-settings')) {
        e.preventDefault();
        p.onOpenSettings('performance');
      } else if (match('open-security-settings')) {
        e.preventDefault();
        p.onOpenSettings('security');
      } else if (match('open-advanced-settings')) {
        e.preventDefault();
        p.onOpenSettings('advanced');
      } else if (match('toggle-reuse-table-tab')) {
        e.preventDefault();
        const next = !p.settings.reuseExistingTableTab;
        p.onUpdateSettings({ reuseExistingTableTab: next });
        toast.info(`Reuse Table Tabs: ${next ? 'On' : 'Off'}`);
      } else if (match('toggle-lazy-explorer')) {
        e.preventDefault();
        const next = !p.settings.lazyLoadExplorer;
        p.onUpdateSettings({ lazyLoadExplorer: next });
        toast.info(`Lazy Explorer Loading: ${next ? 'On' : 'Off'}`);
      } else if (match('toggle-editor-autocomplete')) {
        e.preventDefault();
        const next = !p.settings.editorAutocomplete;
        p.onUpdateSettings({ editorAutocomplete: next });
        toast.info(`SQL Autocomplete: ${next ? 'On' : 'Off'}`);
      } else if (match('toggle-grid-row-numbers')) {
        e.preventDefault();
        const next = !p.settings.gridShowRowNumbers;
        p.onUpdateSettings({ gridShowRowNumbers: next });
        toast.info(`Grid Row Numbers: ${next ? 'On' : 'Off'}`);
      } else if (match('toggle-distraction-free')) {
        e.preventDefault();
        const anyPanelOpen = p.sidebarOpen || p.inspectorOpen;
        p.onSetSidebarOpen(!anyPanelOpen);
        p.onSetInspectorOpen(!anyPanelOpen);
        toast.info(anyPanelOpen ? 'Distraction-Free Mode enabled' : 'Panels restored');
      } else if (match('open-shortcuts')) {
        e.preventDefault();
        p.onToggleShortcuts();
      } else if (match('cycle-theme')) {
        e.preventDefault();
        const next = p.onCycleTheme();
        toast.info(`Theme: ${THEMES[next].displayName}`);
      } else if (match('open-er')) {
        e.preventDefault();
        if (p.currentConnection) p.onOpenErDiagramTab(p.currentConnection.id);
      } else if (match('open-schema-diff')) {
        e.preventDefault();
        if (p.currentConnection) p.onOpenSchemaDiffTab(p.currentConnection.id);
      } else if (match('create-table')) {
        e.preventDefault();
        if (p.currentConnection && !p.currentConnection.readOnly) {
          p.onOpenCreateTable();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (searchFocusTimerRef.current !== null) {
        window.clearTimeout(searchFocusTimerRef.current);
      }
    };
  }, []);
}
