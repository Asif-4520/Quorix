import {
  AlertTriangle,
  Download,
  GripHorizontal,
  Keyboard,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/Badge';
import {
  DEFAULT_SHORTCUTS,
  findConflictsForCandidate,
  getCustomKeybindings,
  getEffectiveShortcut,
  getShortcutConflicts,
  keyboardEventToCombo,
  resetAllKeybindings,
  resetCustomKeybinding,
  type ShortcutItem,
  type ShortcutScope,
  setCustomKeybinding,
  unbindShortcut,
} from '../../services/shortcuts';
import { promptSaveTextFile } from '../../services/tauri';
import { ShortcutRecorderDialog } from './ShortcutRecorderDialog';
import { ShortcutsTable } from './ShortcutsTable';
import {
  COL_LIMITS,
  DEFAULT_COL_WIDTHS,
  type ResizableColKey,
  SHORTCUT_CATEGORIES,
  type SortKey,
} from './shortcutRenderUtils';

interface ShortcutsModalProps {
  isOpen: boolean;
  standaloneWindow?: boolean;
  onClose: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  standaloneWindow = false,
  onClose,
  onRequestConfirm,
}) => {
  const [filter, setFilter] = useState('');
  const [filterRecording, setFilterRecording] = useState(false);
  const [category, setCategory] = useState<string>('All');
  const [scopeFilter, setScopeFilter] = useState<'all' | ShortcutScope>('all');
  const [sortBy, setSortBy] = useState<{ key: SortKey; desc: boolean } | null>(null);
  const [colWidths, setColWidths] = useState<Record<ResizableColKey, number>>(DEFAULT_COL_WIDTHS);
  const [actionColWidth, setActionColWidth] = useState<number | null>(null);
  const [modalSize, setModalSize] = useState<{ width: number; height: number } | null>(null);

  const [customBindings, setCustomBindings] =
    useState<Record<string, string>>(getCustomKeybindings);
  const [focusedRowIdx, setFocusedRowIdx] = useState<number>(0);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [recordingMode, setRecordingMode] = useState(true);

  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!isOpen) return;
    setCustomBindings(getCustomKeybindings());
    setEditingId(null);
    setCustomInput('');
    setFilterRecording(false);
    setFocusedRowIdx(0);

    const onUpdated = () => {
      setCustomBindings(getCustomKeybindings());
    };
    window.addEventListener('quorix-shortcuts-updated', onUpdated);
    return () => window.removeEventListener('quorix-shortcuts-updated', onUpdated);
  }, [isOpen]);

  const conflicts = useMemo(() => {
    void customBindings;
    return getShortcutConflicts();
  }, [customBindings]);
  const conflictActionIds = useMemo(
    () => new Set(conflicts.flatMap((c) => c.actionIds)),
    [conflicts],
  );
  const customCount = Object.keys(customBindings).length;
  const unboundCount = useMemo(() => {
    return DEFAULT_SHORTCUTS.filter((s) => {
      const effective =
        s.id in customBindings && typeof customBindings[s.id] === 'string'
          ? customBindings[s.id]
          : s.defaultKeys;
      return !effective;
    }).length;
  }, [customBindings]);

  const filteredShortcuts = useMemo(() => {
    const hasCustom = (id: string) =>
      id in customBindings && typeof customBindings[id] === 'string';
    const effectiveOf = (item: ShortcutItem) =>
      hasCustom(item.id) ? customBindings[item.id] : item.defaultKeys;

    const base = DEFAULT_SHORTCUTS.filter((s) => {
      const isCustom = hasCustom(s.id);
      const effective = effectiveOf(s);
      if (category === 'Modified') {
        if (!isCustom) return false;
      } else if (category === 'Unbound') {
        if (effective) return false;
      } else if (category === 'Conflicts') {
        if (!conflictActionIds.has(s.id)) return false;
      } else if (category !== 'All' && s.category !== category) {
        return false;
      }
      if (scopeFilter !== 'all' && s.scope !== scopeFilter) {
        return false;
      }
      const q = filter.trim().toLowerCase();
      if (!q) return true;
      if (q === '@user' || q === '@custom' || q === '@modified') return isCustom;
      if (q === '@unbound') return !effective;
      if (q === '@conflict') return conflictActionIds.has(s.id);
      return (
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.scope.toLowerCase().includes(q) ||
        effective.toLowerCase().includes(q)
      );
    });

    if (!sortBy) return base;

    return [...base].sort((a, b) => {
      const getVal = (item: ShortcutItem): string => {
        switch (sortBy.key) {
          case 'name':
            return item.name.toLowerCase();
          case 'category':
            return item.category.toLowerCase();
          case 'scope':
            return item.scope.toLowerCase();
          case 'keys':
            return effectiveOf(item).toLowerCase() || 'zzz';
          case 'source': {
            const eff = effectiveOf(item);
            if (!eff) return 'unbound';
            return hasCustom(item.id) ? 'user' : 'default';
          }
        }
      };
      const cmp = getVal(a).localeCompare(getVal(b));
      return sortBy.desc ? -cmp : cmp;
    });
  }, [customBindings, category, scopeFilter, filter, conflictActionIds, sortBy]);

  useEffect(() => {
    setFocusedRowIdx((idx) => Math.min(idx, Math.max(0, filteredShortcuts.length - 1)));
  }, [filteredShortcuts.length]);

  const startColumnResize = useCallback(
    (col: ResizableColKey | 'action', e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth =
        col === 'action'
          ? (actionColWidth ??
            Math.max(
              220,
              (tableScrollRef.current?.clientWidth ?? 760) -
                (colWidths.category +
                  colWidths.context +
                  colWidths.keybinding +
                  colWidths.source +
                  colWidths.actions),
            ))
          : colWidths[col];

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        if (col === 'action') {
          setActionColWidth(Math.min(540, Math.max(180, startWidth + delta)));
        } else {
          const { min, max } = COL_LIMITS[col];
          setColWidths((prev) => ({
            ...prev,
            [col]: Math.min(max, Math.max(min, startWidth + delta)),
          }));
        }
      };
      const onUp = () => {
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      document.body.style.cursor = 'col-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [actionColWidth, colWidths],
  );

  const startWindowResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = rect.width;
    const startH = rect.height;

    const onMove = (ev: MouseEvent) => {
      const nextW = Math.min(
        window.innerWidth - 32,
        Math.max(660, startW + (ev.clientX - startX) * 2),
      );
      const nextH = Math.min(
        window.innerHeight - 32,
        Math.max(420, startH + (ev.clientY - startY) * 2),
      );
      setModalSize({ width: Math.round(nextW), height: Math.round(nextH) });
    };
    const onUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    document.body.style.cursor = 'nwse-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  if (!isOpen) return null;

  const visibleCategories = SHORTCUT_CATEGORIES.filter(
    (c) => c !== 'Conflicts' || conflicts.length > 0,
  );

  const hasCustomLayout =
    actionColWidth !== null ||
    modalSize !== null ||
    sortBy !== null ||
    (Object.keys(DEFAULT_COL_WIDTHS) as ResizableColKey[]).some(
      (k) => colWidths[k] !== DEFAULT_COL_WIDTHS[k],
    );

  const resetTableLayout = () => {
    setColWidths(DEFAULT_COL_WIDTHS);
    setActionColWidth(null);
    setModalSize(null);
    setSortBy(null);
  };

  const toggleSort = (key: SortKey) => {
    setSortBy((prev) => {
      if (!prev || prev.key !== key) return { key, desc: false };
      if (!prev.desc) return { key, desc: true };
      return null;
    });
  };

  const startEditing = (s: ShortcutItem, idx?: number) => {
    if (typeof idx === 'number') setFocusedRowIdx(idx);
    setFilterRecording(false);
    setEditingId(s.id);
    setRecordingMode(true);
    setCustomInput(getEffectiveShortcut(s.id));
  };

  const handleSaveShortcut = (id: string, clearConflictsWith?: ShortcutItem[]) => {
    if (clearConflictsWith) {
      for (const conflict of clearConflictsWith) {
        unbindShortcut(conflict.id);
      }
    }
    const trimmed = customInput.trim();
    const def = DEFAULT_SHORTCUTS.find((item) => item.id === id);
    if (def && def.defaultKeys === trimmed) {
      resetCustomKeybinding(id);
    } else {
      setCustomKeybinding(id, trimmed);
    }
    setCustomBindings(getCustomKeybindings());
    setEditingId(null);
    setCustomInput('');
  };

  const handleExportKeymap = async () => {
    const payload = DEFAULT_SHORTCUTS.map((s) => {
      const isCustom = s.id in customBindings && typeof customBindings[s.id] === 'string';
      const effective = isCustom ? customBindings[s.id] : s.defaultKeys;
      return {
        command: s.id,
        name: s.name,
        category: s.category,
        context: s.scope,
        keys: effective || null,
        defaultKeys: s.defaultKeys || null,
        source: !effective ? 'unbound' : isCustom ? 'user' : 'default',
      };
    });
    const content = JSON.stringify(payload, null, 2);
    const res = await promptSaveTextFile('quorix-keymap.json', 'json', content);
    if (!res.saved) return;
    if (res.path && !res.inBrowserDownloads) {
      toast.success(`Exported ${payload.length} keybindings to ${res.path}`);
    } else {
      toast.success(`Saved ${payload.length} keybindings to your browser Downloads folder`);
    }
  };

  const focusedShortcut = filteredShortcuts[focusedRowIdx] ?? null;

  const editingShortcut = editingId
    ? (DEFAULT_SHORTCUTS.find((item) => item.id === editingId) ?? null)
    : null;
  const candidateConflicts = editingShortcut
    ? findConflictsForCandidate(editingShortcut.id, customInput)
    : [];

  const totalFixedColsWidth =
    colWidths.category +
    colWidths.context +
    colWidths.keybinding +
    colWidths.source +
    colWidths.actions;
  const minTableWidth = (actionColWidth ?? 240) + totalFixedColsWidth;

  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    if (editingId || filterRecording || filteredShortcuts.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(filteredShortcuts.length - 1, focusedRowIdx + 1);
      setFocusedRowIdx(next);
      const item = filteredShortcuts[next];
      if (item) rowRefs.current.get(item.id)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, focusedRowIdx - 1);
      setFocusedRowIdx(prev);
      const item = filteredShortcuts[prev];
      if (item) rowRefs.current.get(item.id)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedRowIdx(0);
      const item = filteredShortcuts[0];
      if (item) rowRefs.current.get(item.id)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = filteredShortcuts.length - 1;
      setFocusedRowIdx(last);
      const item = filteredShortcuts[last];
      if (item) rowRefs.current.get(item.id)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const targetItem = filteredShortcuts[focusedRowIdx];
      if (targetItem) {
        e.preventDefault();
        startEditing(targetItem, focusedRowIdx);
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const targetItem = filteredShortcuts[focusedRowIdx];
      if (targetItem && getEffectiveShortcut(targetItem.id)) {
        e.preventDefault();
        if (targetItem.defaultKeys === '') {
          resetCustomKeybinding(targetItem.id);
        } else {
          unbindShortcut(targetItem.id);
        }
        setCustomBindings(getCustomKeybindings());
        toast.info(`Unbound "${targetItem.name}"`);
      }
    }
  };

  const container = (
    <div
      ref={dialogRef}
      role={standaloneWindow ? 'region' : 'dialog'}
      aria-modal={standaloneWindow ? undefined : true}
      aria-label="Keyboard Shortcuts"
      style={
        !standaloneWindow && modalSize
          ? { width: modalSize.width, height: modalSize.height }
          : undefined
      }
      className={
        standaloneWindow
          ? 'flex-1 min-h-0 flex flex-col bg-[var(--bg)] overflow-hidden'
          : `relative bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in ${
              modalSize ? '' : 'w-[92vw] max-w-5xl h-[84vh] min-w-[660px] min-h-[420px]'
            }`
      }
      onClick={(e) => {
        if (!standaloneWindow) e.stopPropagation();
      }}
      onKeyDown={(e) => {
        if (editingId || filterRecording) return;
        const target = e.target as HTMLElement | null;
        const isTyping =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.tagName === 'SELECT';
        if (
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') ||
          (!isTyping && e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey)
        ) {
          e.preventDefault();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
          return;
        }
        if (standaloneWindow && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Keyboard size={16} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-[var(--text)]">Keyboard Shortcuts</h2>
            <Badge variant="neutral">{DEFAULT_SHORTCUTS.length} actions</Badge>
            {unboundCount > 0 && <Badge variant="neutral">{unboundCount} unbound</Badge>}
            {customCount > 0 && <Badge variant="accent">{customCount} modified</Badge>}
            {conflicts.length > 0 && <Badge variant="warning">{conflicts.length} conflict</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasCustomLayout && (
            <button
              type="button"
              onClick={resetTableLayout}
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1.5"
              title="Reset column widths, sorting, and window size"
            >
              <RotateCcw size={11} /> Reset Layout
            </button>
          )}
          <button
            type="button"
            onClick={handleExportKeymap}
            aria-label="Export Keymap JSON"
            title="Export current keymap to quorix-keymap.json"
            className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1.5"
          >
            <Download size={12} /> Export JSON
          </button>
          <button
            type="button"
            onClick={() =>
              onRequestConfirm(
                'Reset All Shortcuts',
                'Restore all keyboard shortcuts back to defaults?',
                () => {
                  resetAllKeybindings();
                  setCustomBindings({});
                  setEditingId(null);
                },
              )
            }
            disabled={customCount === 0}
            className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1.5"
          >
            <RotateCcw size={12} /> Reset All
          </button>
          {!standaloneWindow && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Keyboard Shortcuts"
              title="Close (Esc)"
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div
            data-recording-shortcut={filterRecording ? 'true' : undefined}
            className="flex items-center gap-2 flex-1 min-w-[280px] max-w-2xl"
          >
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                readOnly={filterRecording}
                value={filter}
                onChange={(e) => !filterRecording && setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (!filterRecording) return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                    setFilterRecording(false);
                    return;
                  }
                  if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                    setFilter('');
                    return;
                  }
                  const combo = keyboardEventToCombo(e.nativeEvent);
                  if (combo) setFilter(combo);
                }}
                placeholder={
                  filterRecording
                    ? 'Press any keystroke to filter (Esc to exit)…'
                    : 'Search action, command ID, keystroke, @user, @unbound, or @conflict…'
                }
                autoFocus
                className={`w-full pl-8 pr-7 py-1.5 text-xs ${
                  filterRecording
                    ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/45 bg-[var(--accent-muted)]/15 font-mono'
                    : ''
                }`}
              />
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              aria-pressed={filterRecording}
              onClick={() => {
                const next = !filterRecording;
                setFilterRecording(next);
                if (next) {
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }
              }}
              className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 ${
                filterRecording
                  ? 'bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
              }`}
              title="Filter shortcuts by pressing desired key combination"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  filterRecording ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--text-muted)]'
                }`}
              />
              <Keyboard size={12} />
              <span>{filterRecording ? 'Recording…' : 'Record Key'}</span>
            </button>

            <select
              aria-label="Filter by Context"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as 'all' | ShortcutScope)}
              className="py-1.5 px-2.5 text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-md shrink-0"
            >
              <option value="all">All Contexts</option>
              <option value="global">Global</option>
              <option value="grid">Data Grid</option>
              <option value="editor">SQL Editor</option>
              <option value="explorer">Explorer</option>
              <option value="navigation">Navigation</option>
            </select>
          </div>

          <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0 tabular-nums">
            {filteredShortcuts.length} / {DEFAULT_SHORTCUTS.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleCategories.map((cat) => {
            const active = category === cat;
            return (
              <button
                type="button"
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/40'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text)]'
                }`}
              >
                {cat}
                {cat === 'Modified' && customCount > 0 && (
                  <span className="ml-1 opacity-80">({customCount})</span>
                )}
                {cat === 'Unbound' && unboundCount > 0 && (
                  <span className="ml-1 opacity-80">({unboundCount})</span>
                )}
              </button>
            );
          })}
        </div>

        {conflicts.length > 0 && (
          <div className="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11.5px] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={13} className="shrink-0" />
              <span className="truncate">
                <strong>Conflicts:</strong>{' '}
                {conflicts.map((c) => `${c.keys} (${c.actionIds.join(', ')})`).join(' · ')}
              </span>
            </div>
            {category !== 'Conflicts' && (
              <button
                type="button"
                onClick={() => setCategory('Conflicts')}
                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-[10.5px] font-semibold shrink-0 transition-colors"
              >
                Show Conflicts
              </button>
            )}
          </div>
        )}
      </div>

      <ShortcutsTable
        tableScrollRef={tableScrollRef}
        rowRefs={rowRefs}
        shortcuts={filteredShortcuts}
        customBindings={customBindings}
        conflictActionIds={conflictActionIds}
        filter={filter}
        focusedRowIdx={focusedRowIdx}
        hoveredRowId={hoveredRowId}
        editingId={editingId}
        filterRecording={filterRecording}
        sortBy={sortBy}
        colWidths={colWidths}
        actionColWidth={actionColWidth}
        minTableWidth={minTableWidth}
        onSetFocusedRowIdx={setFocusedRowIdx}
        onSetHoveredRowId={setHoveredRowId}
        onToggleSort={toggleSort}
        onStartColumnResize={startColumnResize}
        onResetActionWidth={() => setActionColWidth(null)}
        onResetColWidth={(col) => setColWidths((p) => ({ ...p, [col]: DEFAULT_COL_WIDTHS[col] }))}
        onStartEditing={startEditing}
        onUnbind={(id) => {
          unbindShortcut(id);
          setCustomBindings(getCustomKeybindings());
        }}
        onResetCustom={(id) => {
          resetCustomKeybinding(id);
          setCustomBindings(getCustomKeybindings());
        }}
        onClearFilters={() => {
          setFilter('');
          setCategory('All');
          setScopeFilter('all');
          setFilterRecording(false);
        }}
        onTableKeyDown={handleTableKeyDown}
      />

      {focusedShortcut && (
        <div className="px-6 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--accent)] shrink-0">
              {focusedShortcut.id}
            </span>
            <span className="text-[var(--text-secondary)] truncate">
              {focusedShortcut.description}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-[var(--text-muted)]">
            <span>Scope:</span>
            <span className="font-mono text-[10px] text-[var(--text)]">
              {focusedShortcut.scope}
            </span>
            <span>•</span>
            <span>Default:</span>
            <span className="font-mono text-[10px] text-[var(--text)]">
              {focusedShortcut.defaultKeys || 'Unassigned'}
            </span>
          </div>
        </div>
      )}

      <div className="relative px-6 py-2.5 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between text-[11px] text-[var(--text-muted)] shrink-0 select-none">
        <span>
          Drag column dividers to resize · Double-click divider to reset · Arrow keys + Enter to
          edit
        </span>
        <div className={`flex items-center gap-3 ${standaloneWindow ? '' : 'pr-4'}`}>
          <span>{standaloneWindow ? 'Ctrl+W to close window' : 'Esc to close'}</span>
        </div>

        {!standaloneWindow && (
          <div
            role="separator"
            aria-label="Resize shortcuts window"
            onMouseDown={startWindowResize}
            title="Drag to resize window"
            className="absolute right-1 bottom-1 p-1 cursor-nwse-resize text-[var(--text-muted)] hover:text-[var(--text)] opacity-60 hover:opacity-100"
          >
            <GripHorizontal size={12} className="-rotate-45" />
          </div>
        )}
      </div>

      {editingShortcut && (
        <ShortcutRecorderDialog
          shortcut={editingShortcut}
          customInput={customInput}
          recordingMode={recordingMode}
          candidateConflicts={candidateConflicts}
          onChangeInput={setCustomInput}
          onToggleRecordingMode={() => setRecordingMode((m) => !m)}
          onSave={handleSaveShortcut}
          onUnbind={(id) => {
            setCustomInput('');
            const def = DEFAULT_SHORTCUTS.find((item) => item.id === id);
            if (def && def.defaultKeys === '') {
              resetCustomKeybinding(id);
            } else {
              setCustomKeybinding(id, '');
            }
            setCustomBindings(getCustomKeybindings());
            setEditingId(null);
          }}
          onCancel={() => {
            setEditingId(null);
            setCustomInput('');
          }}
        />
      )}
    </div>
  );

  if (standaloneWindow) {
    return container;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      {container}
    </div>
  );
};
