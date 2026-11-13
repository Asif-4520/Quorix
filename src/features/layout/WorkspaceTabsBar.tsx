import { Info, PanelRight, Pin, Plus, RefreshCw, Search, Table, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ErDiagramIcon, SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import type { TabItem } from '../../types/database';

interface WorkspaceTabsBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseAllTabs: () => void;
  onReopenClosedTab: () => void;
  onTogglePinTab: (id: string) => void;
  onNewSqlTab: () => void;
  hasClosedTabs: boolean;
  isConnected: boolean;
  isRefreshing?: boolean;
  onRefreshSchema: () => void;
  onOpenErDiagram: () => void;
  onOpenCommandPalette: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

export const WorkspaceTabsBar: React.FC<WorkspaceTabsBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onReopenClosedTab,
  onTogglePinTab,
  onNewSqlTab,
  hasClosedTabs,
  isConnected,
  isRefreshing = false,
  onRefreshSchema,
  onOpenErDiagram,
  onOpenCommandPalette,
  inspectorOpen,
  onToggleInspector,
}) => {
  const [tabContext, setTabContext] = useState<{
    tab: TabItem;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!tabContext) return;
    const handleOutside = () => setTabContext(null);
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [tabContext]);

  const getTabIcon = (type: TabItem['type']) => {
    switch (type) {
      case 'table':
        return <Table size={12} className="text-[var(--accent)]" />;
      case 'sql':
        return <SqlQueryIcon size={12} className="text-[var(--info)]" />;
      case 'er-diagram':
        return <ErDiagramIcon size={12} className="text-[var(--warning)]" />;
      case 'database-info':
      case 'schema-info':
        return <Info size={12} className="text-[var(--text-secondary)]" />;
    }
  };

  const clampMenuPos = (x: number, y: number) => ({
    left: Math.max(
      8,
      Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 200),
    ),
    top: Math.max(8, Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 768) - 220)),
  });

  return (
    <div className="h-10 px-3 flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] shrink-0 select-none">
      <div className="flex-1 min-w-0 h-full flex items-center overflow-hidden">
        <div className="titlebar-tabs-scroll" role="tablist" aria-label="Workspace Tabs">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                data-workspace-tab-id={tab.id}
                className={`titlebar-tab group ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTab(tab.id);
                  } else if (e.key === 'ArrowRight' && tabs.length > 1) {
                    e.preventDefault();
                    const nextTab = tabs[(idx + 1) % tabs.length];
                    const el = document.querySelector<HTMLElement>(
                      `[data-workspace-tab-id="${nextTab.id}"]`,
                    );
                    el?.focus();
                  } else if (e.key === 'ArrowLeft' && tabs.length > 1) {
                    e.preventDefault();
                    const prevTab = tabs[(idx - 1 + tabs.length) % tabs.length];
                    const el = document.querySelector<HTMLElement>(
                      `[data-workspace-tab-id="${prevTab.id}"]`,
                    );
                    el?.focus();
                  } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTabContext({ tab, x: rect.left, y: rect.bottom + 4 });
                  }
                }}
                onAuxClick={(e) => {
                  if (e.button === 1 && !tab.pinned) {
                    e.preventDefault();
                    onCloseTab(tab.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabContext({ tab, x: e.clientX, y: e.clientY });
                }}
              >
                <span className="tab-glyph">{getTabIcon(tab.type)}</span>
                <span className="tab-text">{tab.title}</span>
                {tab.isDirty && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0"
                    title="Unsaved changes"
                  />
                )}
                {tab.pinned ? (
                  <button
                    type="button"
                    className="tab-close-icon text-[var(--accent)]"
                    title="Unpin Tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePinTab(tab.id);
                    }}
                  >
                    <Pin size={10} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="tab-close-icon opacity-60 group-hover:opacity-100"
                    title={`Close (${formatShortcutForDisplay(getEffectiveShortcut('close-tab'))})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="new-sql-tab-btn"
            onClick={onNewSqlTab}
            title={`New SQL Query (${formatShortcutForDisplay(getEffectiveShortcut('new-sql-tab'))})`}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          className="icon-action-btn disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!isConnected || isRefreshing}
          onClick={onRefreshSchema}
          title={`Refresh Schema (${formatShortcutForDisplay(getEffectiveShortcut('refresh-schema'))})`}
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
        </button>

        <button
          type="button"
          className="icon-action-btn disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!isConnected}
          onClick={onOpenErDiagram}
          title={`ER Diagram (${formatShortcutForDisplay(getEffectiveShortcut('open-er'))})`}
        >
          <ErDiagramIcon size={13} />
        </button>

        <button
          type="button"
          className="icon-action-btn"
          onClick={onOpenCommandPalette}
          title={`Universal Command Palette (${formatShortcutForDisplay(getEffectiveShortcut('command-palette'))})`}
        >
          <Search size={13} />
        </button>

        <button
          type="button"
          className={`icon-action-btn ${inspectorOpen ? 'text-[var(--accent)] bg-[var(--accent-muted)]' : ''}`}
          onClick={onToggleInspector}
          title={`Toggle Information Panel (${formatShortcutForDisplay(getEffectiveShortcut('toggle-inspector'))})`}
        >
          <PanelRight size={13} />
        </button>
      </div>

      {tabContext && (
        <div
          className="fixed z-50 min-w-[180px] bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-xl p-1 animate-fade-in text-xs"
          style={clampMenuPos(tabContext.x, tabContext.y)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onTogglePinTab(tabContext.tab.id);
              setTabContext(null);
            }}
          >
            <Pin size={12} />
            <span>{tabContext.tab.pinned ? 'Unpin Tab' : 'Pin Tab'}</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onCloseTab(tabContext.tab.id);
              setTabContext(null);
            }}
          >
            <X size={12} />
            <span>Close Tab</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onCloseOtherTabs(tabContext.tab.id);
              setTabContext(null);
            }}
          >
            <X size={12} />
            <span>Close Other Tabs</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onCloseAllTabs();
              setTabContext(null);
            }}
          >
            <X size={12} />
            <span>Close All Unpinned</span>
          </button>
          {hasClosedTabs && (
            <>
              <div className="menubar-separator" />
              <button
                type="button"
                className="menubar-dropdown-item"
                onClick={() => {
                  onReopenClosedTab();
                  setTabContext(null);
                }}
              >
                <span>Reopen Closed Tab</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
