import { Command, Search, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Kbd } from '../../components/ui/Kbd';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import { buildPaletteItems } from './buildPaletteItems';
import {
  type CommandPaletteProps,
  type PaletteItem,
  type PaletteScope,
  parsePaletteQuery,
  SCOPE_TABS,
  scorePaletteItem,
} from './paletteTypes';

export type { PaletteScope } from './paletteTypes';

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  isConnected,
  isSqlActive,
  schema,
  savedQueries = [],
  savedConnections = [],
  initialScope = 'all',
  onOpenConnections,
  onDisconnect,
  onNewSqlTab,
  onOpenTable,
  onOpenSchema,
  onOpenSavedQuery,
  onSelectSavedConnection,
  onOpenErDiagram,
  onOpenSchemaDiff,
  onRefreshSchema,
  onExecuteQuery,
  onExecuteAll,
  onExplainQuery,
  onToggleSidebar,
  onToggleInspector,
  onOpenCreateTable,
  onOpenSettings,
  onOpenShortcuts,
  onSetThemeMode,
  onSetThemePreset,
  onReopenClosedTab,
  onCloseActiveTab,
}) => {
  const [query, setQuery] = useState('');
  const [manualScope, setManualScope] = useState<PaletteScope>(initialScope);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setManualScope(initialScope);
    setSelectedIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, [isOpen, initialScope]);

  const parsed = useMemo(() => parsePaletteQuery(query), [query]);
  const activeScope: PaletteScope = parsed.prefixScope ?? manualScope;

  const allItems = useMemo<PaletteItem[]>(
    () =>
      buildPaletteItems({
        isConnected,
        isSqlActive,
        schema,
        savedQueries,
        savedConnections,
        onOpenConnections,
        onDisconnect,
        onNewSqlTab,
        onExecuteQuery,
        onExecuteAll,
        onExplainQuery,
        onRefreshSchema,
        onOpenErDiagram,
        onOpenSchemaDiff,
        onOpenCreateTable,
        onToggleSidebar,
        onToggleInspector,
        onCloseActiveTab,
        onReopenClosedTab,
        onSetThemeMode,
        onSetThemePreset,
        onOpenSettings,
        onOpenShortcuts,
        onOpenTable,
        onOpenSchema,
        onOpenSavedQuery,
        onSelectSavedConnection,
      }),
    [
      isConnected,
      isSqlActive,
      schema,
      savedQueries,
      savedConnections,
      onOpenConnections,
      onDisconnect,
      onNewSqlTab,
      onExecuteQuery,
      onExecuteAll,
      onExplainQuery,
      onRefreshSchema,
      onOpenErDiagram,
      onOpenSchemaDiff,
      onOpenCreateTable,
      onToggleSidebar,
      onToggleInspector,
      onCloseActiveTab,
      onReopenClosedTab,
      onSetThemeMode,
      onSetThemePreset,
      onOpenSettings,
      onOpenShortcuts,
      onOpenTable,
      onOpenSchema,
      onOpenSavedQuery,
      onSelectSavedConnection,
    ],
  );

  const scopeCounts = useMemo(() => {
    const counts: Record<PaletteScope, number> = {
      all: allItems.length,
      commands: 0,
      objects: 0,
      fields: 0,
      saved: 0,
    };
    for (const item of allItems) {
      counts[item.scope] += 1;
    }
    return counts;
  }, [allItems]);

  const filtered = useMemo(() => {
    const inScope =
      activeScope === 'all' ? allItems : allItems.filter((item) => item.scope === activeScope);

    if (!parsed.term) {
      if (activeScope === 'all') {
        const objects = inScope.filter((i) => i.scope === 'objects').slice(0, 25);
        const saved = inScope.filter((i) => i.scope === 'saved').slice(0, 12);
        const commands = inScope.filter((i) => i.scope === 'commands');
        const fields = inScope.filter((i) => i.scope === 'fields');
        const compactFields = fields.length <= 24 ? fields : [];
        return [...objects, ...saved, ...commands, ...compactFields];
      }
      return inScope.slice(0, 80);
    }

    const tokens = parsed.term.split(/\s+/).filter(Boolean);
    return inScope
      .map((item) => ({ item, score: scorePaletteItem(item, tokens) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 80)
      .map((entry) => entry.item);
  }, [allItems, activeScope, parsed.term]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const executeItem = (item?: PaletteItem) => {
    if (!item) return;
    onClose();
    item.action();
  };

  const handleSelectScopeTab = (nextScope: PaletteScope) => {
    setManualScope(nextScope);
    setSelectedIndex(0);
    const currentParsed = parsePaletteQuery(query);
    if (currentParsed.prefixScope) {
      const targetTab = SCOPE_TABS.find((t) => t.id === nextScope);
      const nextPrefix = targetTab?.prefix ? `${targetTab.prefix} ` : '';
      setQuery(`${nextPrefix}${currentParsed.term}`.trimStart());
    }
    inputRef.current?.focus();
  };

  const activeScopeMeta = SCOPE_TABS.find((t) => t.id === activeScope);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/55 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Universal Command Palette"
        className="w-full max-w-2xl bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.55)] overflow-hidden animate-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3.5 py-2.5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center gap-2.5">
          {activeScope === 'commands' ? (
            <Command size={15} className="text-[var(--accent)] shrink-0" />
          ) : (
            <Search size={15} className="text-[var(--accent)] shrink-0" />
          )}
          {activeScopeMeta?.prefix && !parsed.prefixScope && (
            <span className="px-1.5 py-0.5 rounded bg-[var(--accent-muted)] text-[var(--accent)] font-mono text-[11px] font-semibold shrink-0">
              {activeScopeMeta.prefix}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const idx = SCOPE_TABS.findIndex((t) => t.id === activeScope);
                const dir = e.shiftKey ? -1 : 1;
                const nextIdx = (idx + dir + SCOPE_TABS.length) % SCOPE_TABS.length;
                handleSelectScopeTab(SCOPE_TABS[nextIdx].id);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) =>
                  filtered.length ? (i - 1 + filtered.length) % filtered.length : 0,
                );
              } else if (e.key === 'PageDown') {
                e.preventDefault();
                setSelectedIndex((i) =>
                  filtered.length ? Math.min(filtered.length - 1, i + 8) : 0,
                );
              } else if (e.key === 'PageUp') {
                e.preventDefault();
                setSelectedIndex((i) => (filtered.length ? Math.max(0, i - 8) : 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                executeItem(filtered[selectedIndex]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Type a command, table, column, query, or prefix (> # @ $)…"
            className="flex-1 bg-transparent border-none p-0 text-xs focus:ring-0 focus:shadow-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={12} />
            </button>
          )}
          <Kbd size="xs">Esc</Kbd>
        </div>

        <div
          role="tablist"
          aria-label="Palette scope"
          className="px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/55 flex items-center gap-1 overflow-x-auto"
        >
          {SCOPE_TABS.map((tab) => {
            const active = activeScope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectScopeTab(tab.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/40'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] border border-transparent'
                }`}
              >
                {tab.prefix && (
                  <span className="font-mono text-[10px] opacity-80">{tab.prefix}</span>
                )}
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono opacity-65">{scopeCounts[tab.id]}</span>
              </button>
            );
          })}
        </div>

        <div ref={listRef} className="max-h-[420px] overflow-y-auto p-1.5 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              No matching commands or database items found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const active = idx === selectedIndex;
              const sc = item.shortcutId
                ? formatShortcutForDisplay(getEffectiveShortcut(item.shortcutId))
                : '';
              return (
                <button
                  type="button"
                  key={item.id}
                  data-idx={idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => executeItem(item)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                    active ? 'bg-[var(--accent-muted)]' : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] shrink-0">
                          {item.category}
                        </span>
                        <span className="text-xs font-medium text-[var(--text)] truncate">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sc ? (
                      <Kbd size="xs">{sc}</Kbd>
                    ) : (
                      active && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                          {item.actionLabel}
                        </span>
                      )
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-3.5 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 flex items-center justify-between gap-3 text-[10.5px] text-[var(--text-muted)]">
          <div className="flex items-center gap-2.5 overflow-x-auto whitespace-nowrap">
            <span>
              <code className="font-mono text-[var(--text-secondary)]">&gt;</code> commands
            </span>
            <span>
              <code className="font-mono text-[var(--text-secondary)]">#</code> tables
            </span>
            <span>
              <code className="font-mono text-[var(--text-secondary)]">@</code> columns
            </span>
            <span>
              <code className="font-mono text-[var(--text-secondary)]">$</code> queries &amp; DBs
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span>
              <Kbd size="xs">Tab</Kbd> scope
            </span>
            <span>
              <Kbd size="xs">↑↓</Kbd> navigate
            </span>
            <span>
              <Kbd size="xs">Enter</Kbd> select
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
