import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Crosshair,
  Layers,
  RotateCcw,
} from 'lucide-react';
import type React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../../services/shortcuts';
import type { QueryResponse } from '../../../types/database';
import type { NormalizedRange } from './gridTypes';

interface GridFooterProps {
  data: QueryResponse | null;
  recordCount: number;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  normalizedRange: NormalizedRange | null;
  selectedRowCount: number;
  collapseRepeats: boolean;
  hasCustomLayout: boolean;
  hasClearRowSelection: boolean;
  onClearSelection: () => void;
  onOpenGoToCell: () => void;
  onToggleCollapseRepeats: () => void;
  onResetGridLayout: () => void;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
}

export const GridFooter: React.FC<GridFooterProps> = ({
  data,
  recordCount,
  page,
  pageSize,
  totalRows,
  totalPages,
  normalizedRange,
  selectedRowCount,
  collapseRepeats,
  hasCustomLayout,
  hasClearRowSelection,
  onClearSelection,
  onOpenGoToCell,
  onToggleCollapseRepeats,
  onResetGridLayout,
  onPageSizeChange,
  onPageChange,
}) => {
  const goToShortcutLabel = formatShortcutForDisplay(getEffectiveShortcut('goto-grid-cell'));

  return (
    <div className="h-8 shrink-0 px-3 border-t border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="truncate">
          Showing{' '}
          <strong className="text-[var(--text)] font-mono">
            {recordCount === 0 ? 0 : page * pageSize + 1}–{page * pageSize + recordCount}
          </strong>{' '}
          of <strong className="text-[var(--text)] font-mono">{totalRows.toLocaleString()}</strong>
        </span>
        {data && <span className="font-mono text-[10.5px]">({data.durationMs} ms)</span>}
        {normalizedRange?.isMultiCell && (
          <Badge variant="info">
            {`${normalizedRange.maxRow - normalizedRange.minRow + 1}×${normalizedRange.maxColIdx - normalizedRange.minColIdx + 1} cells`}
          </Badge>
        )}
        {selectedRowCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Badge variant="accent">{selectedRowCount} rows</Badge>
            {hasClearRowSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-[10.5px] text-[var(--text-muted)] hover:text-[var(--text)] underline"
              >
                Clear
              </button>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          data-goto-toggle="true"
          onClick={onOpenGoToCell}
          className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[10.5px] text-[var(--text-muted)] hover:text-[var(--text)] inline-flex items-center gap-1"
          title={`Jump to Row / Cell (${goToShortcutLabel}) · Focus grid (${formatShortcutForDisplay(getEffectiveShortcut('focus-data-grid'))})`}
        >
          <Crosshair size={10} />
          <span className="hidden md:inline">Go to Cell</span>
        </button>

        <button
          type="button"
          aria-pressed={collapseRepeats}
          onClick={onToggleCollapseRepeats}
          className={`px-2 py-0.5 rounded border text-[10.5px] font-medium inline-flex items-center gap-1 transition-colors ${
            collapseRepeats
              ? 'bg-[var(--accent-muted)] border-[var(--accent)]/40 text-[var(--accent)]'
              : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
          title="Dim repeated consecutive values down columns"
        >
          <Layers size={10} />
          <span>Dim Repeats</span>
        </button>

        {hasCustomLayout && (
          <button
            type="button"
            onClick={onResetGridLayout}
            className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[10.5px] text-[var(--text-secondary)] inline-flex items-center gap-1"
            title="Reset column widths, pinned columns, visibility, and order"
          >
            <RotateCcw size={10} />
            <span>Reset Columns</span>
          </button>
        )}

        <label className="inline-flex items-center gap-1.5">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="py-0.5 px-1.5 text-[11px] font-mono bg-[var(--bg-surface)]"
          >
            {[25, 50, 100, 250, 500, 1000].map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => onPageChange(0)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-35"
            title="First Page"
          >
            <ChevronsLeft size={13} />
          </button>
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-35"
            title="Previous Page"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="px-2 font-mono text-[var(--text-secondary)]">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-35"
            title="Next Page"
          >
            <ChevronRight size={13} />
          </button>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => onPageChange(totalPages - 1)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-35"
            title="Last Page"
          >
            <ChevronsRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
