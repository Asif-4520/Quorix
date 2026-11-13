import { Braces, Check, FileText, Info, Lock, Search, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { InspectorTarget } from '../../types/database';
import { InspectorFieldCard } from './InspectorFieldCard';
import { InspectorObjectDetails } from './InspectorObjectDetails';
import { matchesFieldQuery } from './inspectorUtils';

interface InspectorPanelProps {
  target: InspectorTarget | null;
  width: number;
  onResizeWidth: (width: number) => void;
  onClose: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  target,
  width,
  onResizeWidth,
  onClose,
  onShowToast,
}) => {
  const [fieldFilter, setFieldFilter] = useState('');
  const [activeCol, setActiveCol] = useState('');
  const [rawJsonCols, setRawJsonCols] = useState<Set<string>>(() => new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editAsNull, setEditAsNull] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const asideRef = useRef<HTMLElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastHandledTargetRef = useRef<InspectorTarget | null>(null);
  const initialNullOnEditRef = useRef(false);
  const fieldFilterRef = useRef(fieldFilter);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  fieldFilterRef.current = fieldFilter;

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const columnMetaMap = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<Extract<InspectorTarget, { kind: 'row' }>['columnMeta']>[number]
    >();
    if (target?.kind === 'row') {
      for (const meta of target.columnMeta) {
        map.set(meta.name, meta);
      }
    }
    return map;
  }, [target]);

  useEffect(() => {
    if (target === lastHandledTargetRef.current) {
      return;
    }
    lastHandledTargetRef.current = target;

    if (target?.kind === 'row') {
      const nextCol = target.selectedColName || target.columns[0] || '';
      const nextIdx = target.columns.indexOf(nextCol);
      const nextVal = nextIdx >= 0 ? (target.row[nextIdx] ?? null) : null;
      const nextMeta = target.columnMeta.find((c) => c.name === nextCol);
      const q = fieldFilterRef.current.trim().toLowerCase();

      setActiveCol(nextCol);
      if (target.autoStartEdit && !target.readOnly && target.onSaveField) {
        if (q && !matchesFieldQuery(q, nextCol, nextVal, nextMeta?.dataType)) {
          setFieldFilter('');
        }
        initialNullOnEditRef.current = nextVal === null;
        setEditAsNull(nextVal === null);
        setEditText(nextVal ?? '');
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
    }
  }, [target]);

  useEffect(() => {
    if (target?.kind !== 'row') return;
    const targetCol = activeCol || target.selectedColName || target.columns[0] || '';
    let raf2 = 0;
    const focusEditor = () => {
      const ta = editTextareaRef.current;
      if (!ta) return false;
      ta.focus();
      if (!initialNullOnEditRef.current) {
        ta.select();
      }
      return true;
    };
    const raf1 = requestAnimationFrame(() => {
      fieldRowRefs.current[targetCol]?.scrollIntoView?.({ block: 'nearest' });
      if (isEditing) {
        if (!focusEditor()) {
          raf2 = requestAnimationFrame(() => {
            focusEditor();
          });
        }
      } else if (target.editRequestId !== undefined) {
        asideRef.current?.focus();
      }
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [isEditing, target, activeCol]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      onResizeWidth(startW + (startX - ev.clientX));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onShowToast('Copied to clipboard', 'info');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedKey(null), 1500);
  };

  const startEditingField = (col: string, currentVal: string | null) => {
    if (target?.kind !== 'row' || target.readOnly || !target.onSaveField) return;
    setActiveCol(col);
    initialNullOnEditRef.current = currentVal === null;
    setEditAsNull(currentVal === null);
    setEditText(currentVal ?? '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (target?.kind !== 'row' || !target.onSaveField || !activeCol) return;
    await target.onSaveField(activeCol, editAsNull ? null : editText);
    setIsEditing(false);
  };

  const toggleJsonView = (col: string) => {
    setRawJsonCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const rowFields = useMemo(() => {
    if (target?.kind !== 'row')
      return {
        total: 0,
        items: [] as Array<{
          col: string;
          idx: number;
          val: string | null;
          meta: ReturnType<typeof columnMetaMap.get>;
        }>,
      };
    const q = fieldFilter.trim().toLowerCase();
    let total = 0;
    const items: Array<{
      col: string;
      idx: number;
      val: string | null;
      meta: ReturnType<typeof columnMetaMap.get>;
    }> = [];
    target.columns.forEach((col, idx) => {
      if (col === '__quorix_rowid__') return;
      total += 1;
      const val = target.row[idx] ?? null;
      const meta = columnMetaMap.get(col);
      if (matchesFieldQuery(q, col, val, meta?.dataType)) {
        items.push({ col, idx, val, meta });
      }
    });
    return { total, items };
  }, [target, fieldFilter, columnMetaMap]);

  return (
    <aside
      ref={asideRef}
      data-inspector-root="true"
      aria-label="Row Inspector"
      tabIndex={-1}
      style={{ width }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          if (isEditing) {
            setIsEditing(false);
          } else {
            onClose();
          }
        }
      }}
      className="absolute top-0 right-0 bottom-0 z-30 max-w-[calc(100%-24px)] bg-[var(--bg-sidebar)] border-l border-[var(--border)] shadow-[-10px_0_28px_rgba(0,0,0,0.3)] flex flex-col min-h-0 select-text outline-none"
    >
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]/60 transition-colors z-10"
        title="Drag to resize inspector"
      />

      <div className="h-10 shrink-0 px-3 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Info size={12} />
          </div>
          {target?.kind === 'row' ? (
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-mono font-semibold text-[var(--text)] shrink-0">
                Row #{target.rowIndex + 1}
              </span>
              <span className="text-xs font-semibold text-[var(--text)] truncate">
                {target.schema ? `${target.schema}.${target.tableName}` : target.tableName}
              </span>
              {target.readOnly && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[10px] text-[var(--text-muted)] shrink-0"
                  title="Table or connection is read-only"
                >
                  <Lock size={9} /> Read-only
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs font-semibold text-[var(--text)] truncate">
              {target?.kind === 'object' ? target.title : 'Row Inspector'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
          title="Close Inspector (Esc / F4)"
        >
          <X size={13} />
        </button>
      </div>

      {!target ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-[var(--text-muted)] gap-2">
          <FileText size={26} className="opacity-35" />
          <p className="font-medium text-[var(--text-secondary)]">Nothing Selected</p>
          <p className="leading-relaxed">
            Double-click any cell to edit it here, press Space on a cell to inspect the row, or
            select an object in the Explorer.
          </p>
        </div>
      ) : target.kind === 'object' ? (
        <InspectorObjectDetails
          target={target}
          copiedKey={copiedKey}
          onCopyText={(key, text) => void copyText(key, text)}
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-panel)]/70 flex items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="text"
                aria-label="Filter fields by column or value"
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.target.value)}
                placeholder="Filter columns or values…"
                className="w-full pl-7 pr-16 py-1 text-[11px]"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {fieldFilter && (
                  <>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] tabular-nums">
                      {rowFields.items.length}/{rowFields.total}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFieldFilter('')}
                      aria-label="Clear field filter"
                      title="Clear filter"
                      className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      <X size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const obj: Record<string, string | null> = {};
                target.columns.forEach((col, i) => {
                  if (col !== '__quorix_rowid__') {
                    obj[col] = target.row[i] ?? null;
                  }
                });
                void copyText('row-json', JSON.stringify(obj, null, 2));
              }}
              className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[10.5px] text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1 shrink-0 transition-colors"
              title="Copy entire row as JSON"
            >
              {copiedKey === 'row-json' ? (
                <Check size={11} className="text-[var(--success)]" />
              ) : (
                <Braces size={11} />
              )}
              <span>{copiedKey === 'row-json' ? 'Copied' : 'JSON'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {rowFields.items.length === 0 ? (
              <div className="px-4 py-10 text-center space-y-2">
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  No matching fields
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  No column name or value matches &ldquo;{fieldFilter}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => setFieldFilter('')}
                  className="px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text)]"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              rowFields.items.map(({ col, val, meta }) => {
                const isSelected = col === activeCol;
                const isFieldEditing = isEditing && isSelected;
                const canEditField = !target.readOnly && Boolean(target.onSaveField);
                return (
                  <InspectorFieldCard
                    key={col}
                    col={col}
                    val={val}
                    meta={meta}
                    isSelected={isSelected}
                    isFieldEditing={isFieldEditing}
                    canEditField={canEditField}
                    isRawJson={rawJsonCols.has(col)}
                    copiedKey={copiedKey}
                    editText={editText}
                    editAsNull={editAsNull}
                    editTextareaRef={editTextareaRef}
                    registerRowRef={(el) => {
                      fieldRowRefs.current[col] = el;
                    }}
                    onSelect={() => {
                      setActiveCol(col);
                      setIsEditing(false);
                    }}
                    onStartEdit={() => startEditingField(col, val)}
                    onSaveEdit={() => void handleSaveEdit()}
                    onCancelEdit={() => setIsEditing(false)}
                    onChangeEditText={(nextText) => {
                      setEditText(nextText);
                      if (editAsNull) setEditAsNull(false);
                    }}
                    onChangeEditAsNull={setEditAsNull}
                    onToggleJsonView={() => toggleJsonView(col)}
                    onCopyValue={() => void copyText(`val:${col}`, val ?? 'NULL')}
                  />
                );
              })
            )}
          </div>

          <div className="h-7 shrink-0 px-3 border-t border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between text-[10.5px] text-[var(--text-muted)]">
            <span className="truncate">
              {rowFields.total} field{rowFields.total === 1 ? '' : 's'}
              {activeCol ? ` · ${activeCol}` : ''}
            </span>
            <span className="truncate">
              {target.readOnly ? 'View mode' : 'Double-click cell to edit · Esc'}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
