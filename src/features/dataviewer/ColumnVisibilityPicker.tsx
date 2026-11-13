import { ArrowDown, ArrowUp, RotateCcw, Search, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Checkbox } from '../../components/ui/Checkbox';
import type { ColumnInfo } from '../../types/database';

interface ColumnVisibilityPickerProps {
  columns: ColumnInfo[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  onToggleColumn: (colName: string) => void;
  onSetAll: (visible: boolean) => void;
  onMoveColumn: (colName: string, direction: -1 | 1) => void;
  onResetOrder: () => void;
  onClose: () => void;
}

export const ColumnVisibilityPicker: React.FC<ColumnVisibilityPickerProps> = ({
  columns,
  columnOrder,
  columnVisibility,
  onToggleColumn,
  onSetAll,
  onMoveColumn,
  onResetOrder,
  onClose,
}) => {
  const [filter, setFilter] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  const orderedCols = [...columns].sort((a, b) => {
    const ia = columnOrder.indexOf(a.name);
    const ib = columnOrder.indexOf(b.name);
    if (ia === -1 && ib === -1) return a.ordinalPosition - b.ordinalPosition;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const filtered = orderedCols.filter((c) =>
    c.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div
      ref={panelRef}
      className="absolute right-4 top-20 z-40 w-72 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden text-xs animate-fade-in"
    >
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between">
        <span className="font-semibold text-[var(--text)]">Columns &amp; Order</span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-2 border-b border-[var(--border-subtle)] space-y-2">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter columns…"
            className="w-full pl-6 pr-2 py-1 text-[11px]"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between gap-1 text-[11px]">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onSetAll(true)}
              className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
            >
              Show All
            </button>
            <button
              type="button"
              onClick={() => onSetAll(false)}
              className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
            >
              Hide All
            </button>
          </div>
          <button
            type="button"
            onClick={onResetOrder}
            className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] inline-flex items-center gap-1"
            title="Reset column order"
          >
            <RotateCcw size={10} /> Reset
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.map((col, idx) => {
          const isVisible = columnVisibility[col.name] !== false;
          return (
            <div
              key={col.name}
              onClick={() => onToggleColumn(col.name)}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              <Checkbox
                checked={isVisible}
                onChange={() => onToggleColumn(col.name)}
                size="sm"
                label={<span className="font-mono text-[11px]">{col.name}</span>}
              />
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => onMoveColumn(col.name, -1)}
                  className="p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-muted)] disabled:opacity-30"
                  title="Move Left"
                >
                  <ArrowUp size={10} />
                </button>
                <button
                  type="button"
                  disabled={idx === filtered.length - 1}
                  onClick={() => onMoveColumn(col.name, 1)}
                  className="p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-muted)] disabled:opacity-30"
                  title="Move Right"
                >
                  <ArrowDown size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
