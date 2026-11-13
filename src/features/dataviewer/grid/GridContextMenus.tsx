import type { ColumnVisibilityState } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Copy,
  EyeOff,
  Filter,
  Info,
  Layers,
  Maximize2,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import type { FilterOperator, ForeignKeyInfo, QueryResponse } from '../../../types/database';
import type { CellCoord, CellMenuState, HeaderMenuState, NormalizedRange } from './gridTypes';

interface GridContextMenusProps {
  data: QueryResponse | null;
  displayCols: string[];
  canWrite: boolean;
  sortColumn: string | null;
  sortDesc: boolean;
  pinnedCols: string[];
  outgoingFkMap?: Record<string, ForeignKeyInfo>;
  normalizedRange: NormalizedRange | null;
  headerMenu: HeaderMenuState | null;
  cellMenu: CellMenuState | null;
  headerMenuRef: React.RefObject<HTMLDivElement | null>;
  cellMenuRef: React.RefObject<HTMLDivElement | null>;
  onCloseHeaderMenu: () => void;
  onCloseCellMenu: () => void;
  onFocusGridContainer: () => void;
  onSort: (colName: string) => void;
  onQuickFilter: (colName: string, operator: FilterOperator, value?: string) => void;
  onTogglePinColumn: (colName: string) => void;
  onAutoFitColumn: (colName: string) => void;
  onMoveColumnBy: (colName: string, dir: -1 | 1) => void;
  onColumnVisibilityChange: (
    updater: ColumnVisibilityState | ((old: ColumnVisibilityState) => ColumnVisibilityState),
  ) => void;
  onCopyRangeTsv: () => void;
  onSelectRowRange?: (fromIdx: number, toIdx: number) => void;
  onInspectRow: (rowIdx: number, colName: string, options?: { startEdit?: boolean }) => void;
  onJumpForeignKey?: (rowIdx: number, colName: string) => void;
  onCommitEdit: (coord: CellCoord, val: string | null) => void;
  onStageDeleteRow: (rowIdx: number) => void;
  onCopyToast: (msg: string) => void;
}

export const GridContextMenus: React.FC<GridContextMenusProps> = ({
  data,
  displayCols,
  canWrite,
  sortColumn,
  sortDesc,
  pinnedCols,
  outgoingFkMap,
  normalizedRange,
  headerMenu,
  cellMenu,
  headerMenuRef,
  cellMenuRef,
  onCloseHeaderMenu,
  onCloseCellMenu,
  onFocusGridContainer,
  onSort,
  onQuickFilter,
  onTogglePinColumn,
  onAutoFitColumn,
  onMoveColumnBy,
  onColumnVisibilityChange,
  onCopyRangeTsv,
  onSelectRowRange,
  onInspectRow,
  onJumpForeignKey,
  onCommitEdit,
  onStageDeleteRow,
  onCopyToast,
}) => {
  const clampedCellLeft = cellMenu ? Math.max(8, Math.min(cellMenu.x, window.innerWidth - 220)) : 0;
  const clampedCellTop = cellMenu ? Math.max(8, Math.min(cellMenu.y, window.innerHeight - 280)) : 0;

  return (
    <>
      {headerMenu && (
        <div
          ref={headerMenuRef}
          role="menu"
          className="fixed z-50 min-w-[195px] bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-xl p-1 text-xs animate-fade-in"
          style={{ left: headerMenu.x, top: headerMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10.5px] font-mono font-semibold text-[var(--text-muted)] border-b border-[var(--border-subtle)] mb-1 truncate">
            {headerMenu.colName}
          </div>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              if (sortColumn !== headerMenu.colName || sortDesc) {
                onSort(headerMenu.colName);
              }
              onCloseHeaderMenu();
            }}
          >
            <ArrowUp size={12} /> <span>Sort Ascending</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              if (sortColumn !== headerMenu.colName || !sortDesc) {
                onSort(headerMenu.colName);
              }
              onCloseHeaderMenu();
            }}
          >
            <ArrowDown size={12} /> <span>Sort Descending</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onQuickFilter(headerMenu.colName, 'contains', '');
              onCloseHeaderMenu();
            }}
          >
            <Filter size={12} /> <span>Filter Column…</span>
          </button>
          <div className="menubar-separator" />
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onTogglePinColumn(headerMenu.colName);
              onCloseHeaderMenu();
            }}
          >
            {pinnedCols.includes(headerMenu.colName) ? (
              <>
                <PinOff size={12} /> <span>Unpin Column</span>
              </>
            ) : (
              <>
                <Pin size={12} /> <span>Pin Column Left</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onAutoFitColumn(headerMenu.colName);
              onCloseHeaderMenu();
            }}
          >
            <Maximize2 size={12} /> <span>Auto-Fit Width</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onMoveColumnBy(headerMenu.colName, -1);
              onCloseHeaderMenu();
            }}
          >
            <ArrowLeft size={12} /> <span>Move Left</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onMoveColumnBy(headerMenu.colName, 1);
              onCloseHeaderMenu();
            }}
          >
            <ArrowRight size={12} /> <span>Move Right</span>
          </button>
          <div className="menubar-separator" />
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              void navigator.clipboard.writeText(headerMenu.colName);
              onCopyToast(`Copied "${headerMenu.colName}"`);
              onCloseHeaderMenu();
            }}
          >
            <Copy size={12} /> <span>Copy Column Name</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item text-[var(--text-muted)]"
            onClick={() => {
              onColumnVisibilityChange((prev) => ({
                ...prev,
                [headerMenu.colName]: false,
              }));
              onCloseHeaderMenu();
            }}
          >
            <EyeOff size={12} /> <span>Hide Column</span>
          </button>
        </div>
      )}

      {cellMenu && (
        <div
          ref={cellMenuRef}
          role="menu"
          className="fixed z-50 min-w-[205px] bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-xl p-1 text-xs animate-fade-in"
          style={{ left: clampedCellLeft, top: clampedCellTop }}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            const items = Array.from(
              cellMenuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ??
                [],
            );
            if (items.length === 0) return;
            const idx = items.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              items[(idx + 1) % items.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              items[(idx - 1 + items.length) % items.length]?.focus();
            } else if (e.key === 'Home') {
              e.preventDefault();
              items[0]?.focus();
            } else if (e.key === 'End') {
              e.preventDefault();
              items[items.length - 1]?.focus();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCloseCellMenu();
              onFocusGridContainer();
            }
          }}
        >
          {normalizedRange?.isMultiCell && (
            <>
              <button
                type="button"
                className="menubar-dropdown-item text-[var(--accent)]"
                onClick={() => {
                  onCopyRangeTsv();
                  onCloseCellMenu();
                }}
              >
                <Copy size={12} />{' '}
                <span>
                  Copy Range ({normalizedRange.maxRow - normalizedRange.minRow + 1}×
                  {normalizedRange.maxColIdx - normalizedRange.minColIdx + 1} TSV)
                </span>
              </button>
              <button
                type="button"
                className="menubar-dropdown-item"
                onClick={() => {
                  onSelectRowRange?.(normalizedRange.minRow, normalizedRange.maxRow);
                  onCloseCellMenu();
                }}
              >
                <Layers size={12} />{' '}
                <span>
                  Select Rows {normalizedRange.minRow + 1}–{normalizedRange.maxRow + 1}
                </span>
              </button>
              <div className="menubar-separator" />
            </>
          )}
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              void navigator.clipboard.writeText(cellMenu.value ?? 'NULL');
              onCopyToast('Cell copied');
              onCloseCellMenu();
            }}
          >
            <Copy size={12} /> <span>Copy Cell Value</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              const rowObj: Record<string, string | null> = {};
              displayCols.forEach((c) => {
                const idx = data?.columns.indexOf(c) ?? -1;
                rowObj[c] = idx >= 0 ? (data?.rows[cellMenu.rowIdx]?.[idx] ?? null) : null;
              });
              void navigator.clipboard.writeText(JSON.stringify(rowObj, null, 2));
              onCopyToast('Row copied as JSON');
              onCloseCellMenu();
            }}
          >
            <Copy size={12} /> <span>Copy Row as JSON</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              const csvVals = displayCols.map((c) => {
                const idx = data?.columns.indexOf(c) ?? -1;
                const v = idx >= 0 ? (data?.rows[cellMenu.rowIdx]?.[idx] ?? null) : null;
                if (v === null) return '';
                return v.includes(',') || v.includes('"') || v.includes('\n')
                  ? `"${v.replace(/"/g, '""')}"`
                  : v;
              });
              void navigator.clipboard.writeText(csvVals.join(','));
              onCopyToast('Row copied as CSV');
              onCloseCellMenu();
            }}
          >
            <Copy size={12} /> <span>Copy Row as CSV</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onInspectRow(cellMenu.rowIdx, cellMenu.colName);
              onCloseCellMenu();
            }}
          >
            <Info size={12} /> <span>Inspect Row (F4)</span>
          </button>
          {outgoingFkMap?.[cellMenu.colName] && cellMenu.value !== null && onJumpForeignKey && (
            <button
              type="button"
              className="menubar-dropdown-item text-[var(--accent)]"
              onClick={() => {
                onJumpForeignKey(cellMenu.rowIdx, cellMenu.colName);
                onCloseCellMenu();
              }}
            >
              <ArrowUpRight size={12} />{' '}
              <span>Open Referenced ({outgoingFkMap[cellMenu.colName].toTable})</span>
            </button>
          )}
          <div className="menubar-separator" />
          {cellMenu.value === null ? (
            <button
              type="button"
              className="menubar-dropdown-item"
              onClick={() => {
                onQuickFilter(cellMenu.colName, 'is_null');
                onCloseCellMenu();
              }}
            >
              <Filter size={12} /> <span>Filter IS NULL</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="menubar-dropdown-item"
                onClick={() => {
                  onQuickFilter(cellMenu.colName, 'equals', cellMenu.value ?? '');
                  onCloseCellMenu();
                }}
              >
                <Filter size={12} /> <span>Filter = Value</span>
              </button>
              <button
                type="button"
                className="menubar-dropdown-item"
                onClick={() => {
                  onQuickFilter(cellMenu.colName, 'not_equals', cellMenu.value ?? '');
                  onCloseCellMenu();
                }}
              >
                <Filter size={12} /> <span>Filter != Value</span>
              </button>
            </>
          )}
          {canWrite && (
            <>
              <div className="menubar-separator" />
              <button
                type="button"
                className="menubar-dropdown-item"
                onClick={() => {
                  onCommitEdit({ rowIdx: cellMenu.rowIdx, colName: cellMenu.colName }, null);
                  onCloseCellMenu();
                }}
              >
                <span>Set Cell to NULL</span>
              </button>
              <button
                type="button"
                className="menubar-dropdown-item text-[var(--error)]"
                onClick={() => {
                  onStageDeleteRow(cellMenu.rowIdx);
                  onCloseCellMenu();
                }}
              >
                <Trash2 size={12} /> <span>Delete Row</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};
