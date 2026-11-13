import { Crosshair, Minus, Plus, X } from 'lucide-react';
import type React from 'react';
import { Kbd } from '../../../components/ui/Kbd';
import {
  formatShortcutForDisplay,
  getEffectiveShortcut,
  matchesKeyCombination,
} from '../../../services/shortcuts';
import type { ColumnInfo } from '../../../types/database';

interface GoToCellPopoverProps {
  rowCount: number;
  goToRowInput: string;
  goToColInput: string;
  visibleColIds: string[];
  colMetaMap: Map<string, ColumnInfo>;
  nullDisplay: string;
  goToInputRef: React.RefObject<HTMLInputElement | null>;
  previewTarget: {
    targetRow: number;
    targetCol: string;
    isOutOfRange: boolean;
  };
  previewVal: string | null;
  hasSelectRowRange: boolean;
  onRowInputChange: (val: string) => void;
  onColInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSelectWholeRow: () => void;
  onClose: () => void;
}

export const GoToCellPopover: React.FC<GoToCellPopoverProps> = ({
  rowCount,
  goToRowInput,
  goToColInput,
  visibleColIds,
  colMetaMap,
  nullDisplay,
  goToInputRef,
  previewTarget,
  previewVal,
  hasSelectRowRange,
  onRowInputChange,
  onColInputChange,
  onSubmit,
  onSelectWholeRow,
  onClose,
}) => {
  const parsedRowNum = Number.parseInt(goToRowInput, 10);
  const safeRowNum = Number.isFinite(parsedRowNum)
    ? Math.min(rowCount, Math.max(1, parsedRowNum))
    : previewTarget.targetRow + 1;
  const middleRow = Math.max(1, Math.ceil(rowCount / 2));
  const goToShortcutLabel = formatShortcutForDisplay(getEffectiveShortcut('goto-grid-cell'));

  return (
    <form
      data-goto-cell-bar="true"
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        if (
          e.key === 'Escape' ||
          matchesKeyCombination(e.nativeEvent, getEffectiveShortcut('goto-grid-cell'))
        ) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      className="absolute left-1/2 -translate-x-1/2 top-3 z-40 w-[400px] max-w-[calc(100%-24px)] rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-[0_18px_46px_rgba(0,0,0,0.48)] overflow-hidden animate-fade-in text-xs"
    >
      <div className="px-3.5 py-2 bg-[var(--bg-surface)] border-b border-[var(--border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Crosshair size={13} className="text-[var(--accent)] shrink-0" />
          <span className="font-semibold text-[12px] text-[var(--text)]">Jump to Cell</span>
          <span className="text-[10.5px] font-mono text-[var(--text-muted)]">
            1–{rowCount} rows
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Kbd size="xs">{goToShortcutLabel}</Kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cell jumper"
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-[142px_minmax(0,1fr)] gap-2.5 items-end">
          <label className="block space-y-1">
            <span className="block text-[10.5px] font-medium text-[var(--text-secondary)]">
              Row number
            </span>
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] focus-within:border-[var(--accent)] overflow-hidden transition-colors">
              <button
                type="button"
                disabled={safeRowNum <= 1}
                onClick={() => onRowInputChange(String(Math.max(1, safeRowNum - 1)))}
                aria-label="Previous row number"
                className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Minus size={11} />
              </button>
              <input
                ref={goToInputRef}
                type="number"
                min={1}
                max={rowCount}
                value={goToRowInput}
                onChange={(e) => onRowInputChange(e.target.value)}
                aria-label="Jump to row number"
                className="w-full min-w-0 py-1 px-1 text-center font-mono text-xs bg-transparent border-none focus:ring-0 focus:shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                disabled={safeRowNum >= rowCount}
                onClick={() => onRowInputChange(String(Math.min(rowCount, safeRowNum + 1)))}
                aria-label="Next row number"
                className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={11} />
              </button>
            </div>
          </label>

          <label className="block space-y-1 min-w-0">
            <span className="block text-[10.5px] font-medium text-[var(--text-secondary)]">
              Column
            </span>
            <select
              value={goToColInput}
              onChange={(e) => onColInputChange(e.target.value)}
              aria-label="Jump to column"
              className="w-full py-1.5 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            >
              {visibleColIds.map((col) => {
                const isPk = colMetaMap.get(col)?.primaryKey;
                return (
                  <option key={col} value={col}>
                    {isPk ? `${col} (PK)` : col}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)] mr-1">Quick:</span>
            {[
              { label: 'First', row: 1 },
              { label: 'Mid', row: middleRow },
              { label: 'Last', row: rowCount },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onRowInputChange(String(preset.row));
                  goToInputRef.current?.focus();
                }}
                className={`px-2 py-0.5 rounded-md border text-[10.5px] font-medium transition-colors ${
                  safeRowNum === preset.row
                    ? 'border-[var(--accent)]/60 bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {preset.label} ({preset.row})
              </button>
            ))}
          </div>
          {previewTarget.isOutOfRange && (
            <span className="text-[10px] text-amber-400 font-medium">Clamped to 1–{rowCount}</span>
          )}
        </div>

        <div className="px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[11px]">
          <span className="text-[var(--text-muted)] shrink-0">
            Row{' '}
            <strong className="font-mono text-[var(--text)]">{previewTarget.targetRow + 1}</strong>{' '}
            ·{' '}
            <span className="font-mono text-[var(--text-secondary)]">
              {previewTarget.targetCol}
            </span>
          </span>
          <span
            className={`truncate font-mono text-[11px] ${
              previewVal === null ? 'italic text-[var(--text-muted)]' : 'text-[var(--text)]'
            }`}
          >
            {previewVal === null ? nullDisplay : previewVal || '""'}
          </span>
        </div>

        <div className="pt-0.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-muted)]">
            <Kbd size="xs">Esc</Kbd>
            <span>Cancel</span>
          </span>
          <div className="flex items-center gap-1.5">
            {hasSelectRowRange && (
              <button
                type="button"
                onClick={onSelectWholeRow}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
              >
                Select Row
              </button>
            )}
            <button
              type="submit"
              aria-label="Jump"
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] font-semibold text-[11px] hover:bg-[var(--accent-hover)] inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Jump</span>
              <span aria-hidden="true" className="opacity-90">
                <Kbd size="xs" className="!bg-black/20 !border-white/25 !text-[var(--accent-text)]">
                  Enter
                </Kbd>
              </span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
