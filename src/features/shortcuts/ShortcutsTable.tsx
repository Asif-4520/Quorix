import { AlertTriangle, ArrowDown, ArrowUp, Ban, Edit2, RotateCcw } from 'lucide-react';
import type React from 'react';
import { Badge } from '../../components/ui/Badge';
import type { ShortcutItem } from '../../services/shortcuts';
import {
  DEFAULT_COL_WIDTHS,
  type ResizableColKey,
  renderComboCaps,
  type SortKey,
} from './shortcutRenderUtils';

interface ShortcutsTableProps {
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  shortcuts: ShortcutItem[];
  customBindings: Record<string, string>;
  conflictActionIds: Set<string>;
  filter: string;
  focusedRowIdx: number;
  hoveredRowId: string | null;
  editingId: string | null;
  filterRecording: boolean;
  sortBy: { key: SortKey; desc: boolean } | null;
  colWidths: Record<ResizableColKey, number>;
  actionColWidth: number | null;
  minTableWidth: number;
  onSetFocusedRowIdx: (idx: number) => void;
  onSetHoveredRowId: (id: string | null | ((cur: string | null) => string | null)) => void;
  onToggleSort: (key: SortKey) => void;
  onStartColumnResize: (col: ResizableColKey | 'action', e: React.MouseEvent) => void;
  onResetActionWidth: () => void;
  onResetColWidth: (col: ResizableColKey) => void;
  onStartEditing: (s: ShortcutItem, idx: number) => void;
  onUnbind: (id: string) => void;
  onResetCustom: (id: string) => void;
  onClearFilters?: () => void;
  onTableKeyDown: (e: React.KeyboardEvent) => void;
}

export const ShortcutsTable: React.FC<ShortcutsTableProps> = ({
  tableScrollRef,
  rowRefs,
  shortcuts,
  customBindings,
  conflictActionIds,
  filter,
  focusedRowIdx,
  hoveredRowId,
  editingId,
  sortBy,
  colWidths,
  actionColWidth,
  minTableWidth,
  onSetFocusedRowIdx,
  onSetHoveredRowId,
  onToggleSort,
  onStartColumnResize,
  onResetActionWidth,
  onResetColWidth,
  onStartEditing,
  onUnbind,
  onResetCustom,
  onClearFilters,
  onTableKeyDown,
}) => {
  const renderSortIcon = (key: SortKey) => {
    if (sortBy?.key !== key) return null;
    return sortBy.desc ? (
      <ArrowDown size={10} className="text-[var(--accent)] shrink-0" />
    ) : (
      <ArrowUp size={10} className="text-[var(--accent)] shrink-0" />
    );
  };

  return (
    <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">
      <div
        ref={tableScrollRef}
        tabIndex={0}
        aria-label="Keybindings Table"
        onKeyDown={onTableKeyDown}
        className="flex-1 min-h-0 overflow-auto border border-[var(--border)] rounded-xl bg-[var(--bg-sidebar)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-focus)]"
      >
        <div style={{ minWidth: minTableWidth }} className="relative">
          <div className="sticky top-0 z-10 flex items-stretch bg-[var(--bg-surface)] border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] select-none">
            <div
              data-shortcut-col="action"
              style={
                actionColWidth
                  ? { width: actionColWidth, flexShrink: 0 }
                  : { flex: '1 1 240px', minWidth: 220 }
              }
              className="relative flex items-center justify-between px-4 py-2.5 border-r border-[var(--border-subtle)]"
            >
              <button
                type="button"
                onClick={() => onToggleSort('name')}
                className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors"
              >
                <span>Action</span>
                {renderSortIcon('name')}
              </button>
              <div
                role="separator"
                aria-orientation="vertical"
                title="Drag to resize · Double-click to reset"
                onMouseDown={(e) => onStartColumnResize('action', e)}
                onDoubleClick={onResetActionWidth}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]/60 transition-colors"
              />
            </div>

            <div
              data-shortcut-col="category"
              style={{ width: colWidths.category }}
              className="relative shrink-0 flex items-center px-3 py-2.5 border-r border-[var(--border-subtle)]"
            >
              <button
                type="button"
                onClick={() => onToggleSort('category')}
                className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors truncate"
              >
                <span>Category</span>
                {renderSortIcon('category')}
              </button>
              <div
                role="separator"
                aria-orientation="vertical"
                title="Drag to resize · Double-click to reset"
                onMouseDown={(e) => onStartColumnResize('category', e)}
                onDoubleClick={() => onResetColWidth('category')}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]/60 transition-colors"
              />
            </div>

            <div
              data-shortcut-col="context"
              style={{ width: colWidths.context }}
              className="relative shrink-0 flex items-center px-3 py-2.5 border-r border-[var(--border-subtle)]"
            >
              <button
                type="button"
                onClick={() => onToggleSort('scope')}
                className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors truncate"
              >
                <span>Context</span>
                {renderSortIcon('scope')}
              </button>
              <div
                role="separator"
                aria-orientation="vertical"
                title="Drag to resize · Double-click to reset"
                onMouseDown={(e) => onStartColumnResize('context', e)}
                onDoubleClick={() => onResetColWidth('context')}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]/60 transition-colors"
              />
            </div>

            <div
              data-shortcut-col="keybinding"
              style={{ width: colWidths.keybinding }}
              className="relative shrink-0 flex items-center justify-end px-3 py-2.5 border-r border-[var(--border-subtle)]"
            >
              <button
                type="button"
                onClick={() => onToggleSort('keys')}
                className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors truncate"
              >
                <span>Keybinding</span>
                {renderSortIcon('keys')}
              </button>
              <div
                role="separator"
                aria-orientation="vertical"
                title="Drag to resize · Double-click to reset"
                onMouseDown={(e) => onStartColumnResize('keybinding', e)}
                onDoubleClick={() => onResetColWidth('keybinding')}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]/60 transition-colors"
              />
            </div>

            <div
              data-shortcut-col="source"
              style={{ width: colWidths.source }}
              className="relative shrink-0 flex items-center justify-center px-2.5 py-2.5 border-r border-[var(--border-subtle)]"
            >
              <button
                type="button"
                onClick={() => onToggleSort('source')}
                className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors truncate"
              >
                <span>Source</span>
                {renderSortIcon('source')}
              </button>
              <div
                role="separator"
                aria-orientation="vertical"
                title="Drag to resize · Double-click to reset"
                onMouseDown={(e) => onStartColumnResize('source', e)}
                onDoubleClick={() => onResetColWidth('source')}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]/60 transition-colors"
              />
            </div>

            <div
              data-shortcut-col="actions"
              style={{ width: colWidths.actions }}
              className="shrink-0 flex items-center justify-end px-3 py-2.5"
            >
              <span>Actions</span>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {shortcuts.length === 0 ? (
              <div className="py-14 text-center text-xs text-[var(--text-muted)] space-y-2.5">
                <div>
                  {filter
                    ? `No keybindings match “${filter}”`
                    : 'No keybindings match the active filters'}
                </div>
                {onClearFilters && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              shortcuts.map((s, idx) => {
                const isCustom = s.id in customBindings && typeof customBindings[s.id] === 'string';
                const effective = isCustom ? customBindings[s.id] : s.defaultKeys;
                const hasConflict = conflictActionIds.has(s.id);
                const isEditing = editingId === s.id;
                const isFocused = focusedRowIdx === idx;
                const showRowActions = isFocused || hoveredRowId === s.id || isEditing;

                return (
                  <div
                    key={s.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(s.id, el);
                      else rowRefs.current.delete(s.id);
                    }}
                    data-shortcut-row={s.id}
                    aria-selected={isFocused}
                    title={`${s.name} (${s.id}) — ${s.description}`}
                    onMouseEnter={() => onSetHoveredRowId(s.id)}
                    onMouseLeave={() => onSetHoveredRowId((cur) => (cur === s.id ? null : cur))}
                    onClick={() => onSetFocusedRowIdx(idx)}
                    onDoubleClick={() => onStartEditing(s, idx)}
                    className={`group flex items-center transition-colors min-h-[48px] ${
                      isEditing
                        ? 'bg-[var(--accent-muted)]/25'
                        : isFocused
                          ? 'bg-[var(--bg-hover)]/75 ring-1 ring-inset ring-[var(--accent)]/35'
                          : idx % 2 === 1
                            ? 'bg-[var(--bg-panel)]/25 hover:bg-[var(--bg-hover)]/55'
                            : 'hover:bg-[var(--bg-hover)]/55'
                    }`}
                  >
                    <div
                      style={
                        actionColWidth
                          ? { width: actionColWidth, flexShrink: 0 }
                          : { flex: '1 1 240px', minWidth: 220 }
                      }
                      className="px-4 py-2 flex items-center gap-2 min-w-0 border-r border-[var(--border-subtle)]/60"
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[12.5px] font-medium text-[var(--text)] truncate">
                            {s.name}
                          </span>
                          {hasConflict && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 shrink-0"
                              title="Conflicts with another binding"
                            >
                              <AlertTriangle size={9} /> Conflict
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10.5px] text-[var(--text-muted)] truncate">
                            {s.description}
                          </span>
                          <span className="hidden xl:inline-block shrink-0 font-mono text-[9.5px] px-1 py-px rounded bg-[var(--bg-surface)] text-[var(--text-muted)]/85 border border-[var(--border-subtle)]">
                            {s.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{ width: colWidths.category }}
                      className="shrink-0 px-3 py-2 flex items-center border-r border-[var(--border-subtle)]/60 overflow-hidden"
                    >
                      <span className="text-[10.5px] px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] truncate">
                        {s.category}
                      </span>
                    </div>

                    <div
                      style={{ width: colWidths.context }}
                      className="shrink-0 px-3 py-2 flex items-center border-r border-[var(--border-subtle)]/60 overflow-hidden"
                    >
                      <Badge variant="type">{s.scope}</Badge>
                    </div>

                    <div
                      style={{ width: colWidths.keybinding }}
                      className="shrink-0 px-3 py-2 flex items-center justify-end border-r border-[var(--border-subtle)]/60 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartEditing(s, idx);
                        }}
                        aria-label={
                          effective ? `Edit keybinding ${effective}` : 'Assign keybinding'
                        }
                        className="px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors inline-flex items-center justify-end max-w-full"
                      >
                        {effective ? (
                          renderComboCaps(effective, 'xs', 'right')
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/45 group-hover:border-[var(--accent)]/60 group-hover:text-[var(--accent)] text-[10.5px] font-medium text-[var(--text-muted)] transition-colors">
                            + Assign Key
                          </span>
                        )}
                      </button>
                    </div>

                    <div
                      style={{ width: colWidths.source }}
                      className="shrink-0 px-2.5 py-2 flex items-center justify-center border-r border-[var(--border-subtle)]/60"
                    >
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                          !effective
                            ? 'text-[var(--text-muted)] bg-[var(--bg-surface)]/50'
                            : isCustom
                              ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                              : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {!effective ? 'Unbound' : isCustom ? 'User' : 'Default'}
                      </span>
                    </div>

                    <div
                      style={{ width: colWidths.actions }}
                      className="shrink-0 px-2.5 py-2 flex items-center justify-end gap-1"
                    >
                      {showRowActions && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartEditing(s, idx);
                            }}
                            className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                            title="Record / edit keybinding"
                          >
                            <Edit2 size={11} />
                          </button>
                          {effective && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnbind(s.id);
                              }}
                              className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                              title="Unbind"
                            >
                              <Ban size={11} />
                            </button>
                          )}
                        </>
                      )}
                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onResetCustom(s.id);
                          }}
                          className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--accent)] transition-colors"
                          title={`Reset (${s.defaultKeys})`}
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { DEFAULT_COL_WIDTHS };
