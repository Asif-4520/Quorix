import { Info, Trash2 } from 'lucide-react';
import type React from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';
import type { ColumnInfo, ForeignKeyInfo, QueryResponse } from '../../../types/database';
import { formatCellDisplay, getTabTarget } from './cellFormatters';
import {
  type CellCoord,
  type CellMenuState,
  type CellRange,
  type DragState,
  type GridColumnHeaderSpec,
  type GridRowRecord,
  INDEX_GUTTER_WIDTH,
  type NormalizedRange,
} from './gridTypes';

interface GridRowProps {
  virtualIndex: number;
  virtualStart: number;
  rowHeight: number;
  rowId: string;
  orig: GridRowRecord;
  data: QueryResponse;
  headers: GridColumnHeaderSpec[];
  visibleColIds: string[];
  displayCols: string[];
  colMetaMap: Map<string, ColumnInfo>;
  outgoingFkMap?: Record<string, ForeignKeyInfo>;
  pinnedLeftOffsets: Map<string, number>;
  lastPinnedColId: string | null;
  stripedRows: boolean;
  showRowNumbers: boolean;
  canWrite: boolean;
  page: number;
  pageSize: number;
  totalRowsOnPage: number;
  nullDisplay: string;
  dateFormat: 'iso' | 'local' | 'relative';
  collapseRepeats: boolean;
  isRowSelected: boolean;
  isPendingDelete: boolean;
  selectedCell: CellCoord | null;
  editingCell: CellCoord | null;
  editValue: string;
  normalizedRange: NormalizedRange | null;
  cellRange: CellRange | null;
  pendingCellUpdates: Record<string, string | null>;
  dragRef: React.MutableRefObject<DragState | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSetIsDragging: (val: boolean) => void;
  onSetCellRange: (range: CellRange | null) => void;
  onSelectCell: (coord: CellCoord | null) => void;
  onMoveCell: (rowIdx: number, colName: string) => void;
  onToggleRowSelection: (rowKey: string, shiftKey: boolean, rowIdx: number) => void;
  onSelectRowRange?: (fromIdx: number, toIdx: number) => void;
  onInspectRow: (rowIdx: number, colName: string, options?: { startEdit?: boolean }) => void;
  onStageDeleteRow: (rowIdx: number) => void;
  onJumpForeignKey?: (rowIdx: number, colName: string) => void;
  onEditValueChange: (val: string) => void;
  onCommitEdit: (coord: CellCoord, val: string | null) => void;
  onCancelEdit: () => void;
  onSetCellMenu: (menu: CellMenuState) => void;
  onFocusGridContainer: () => void;
}

export const GridRow: React.FC<GridRowProps> = ({
  virtualIndex,
  virtualStart,
  rowHeight,
  rowId,
  orig,
  data,
  headers,
  visibleColIds,
  displayCols,
  colMetaMap,
  outgoingFkMap,
  pinnedLeftOffsets,
  lastPinnedColId,
  stripedRows,
  showRowNumbers,
  canWrite,
  page,
  pageSize,
  totalRowsOnPage,
  nullDisplay,
  dateFormat,
  collapseRepeats,
  isRowSelected,
  isPendingDelete,
  selectedCell,
  editingCell,
  editValue,
  normalizedRange,
  cellRange,
  pendingCellUpdates,
  dragRef,
  scrollContainerRef,
  onSetIsDragging,
  onSetCellRange,
  onSelectCell,
  onMoveCell,
  onToggleRowSelection,
  onSelectRowRange,
  onInspectRow,
  onStageDeleteRow,
  onJumpForeignKey,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  onSetCellMenu,
  onFocusGridContainer,
}) => {
  const rIdx = orig.__rowIndex;
  const rowKey = orig.__rowKey;

  const handleRowDragHover = (buttons: number | undefined) => {
    if (dragRef.current?.mode !== 'rows') return;
    if (buttons !== undefined && buttons > 0 && (buttons & 1) === 0) {
      dragRef.current = null;
      onSetIsDragging(false);
      return;
    }
    const firstCol = visibleColIds[0];
    const lastCol = visibleColIds[visibleColIds.length - 1];
    if (firstCol && lastCol) {
      onSetCellRange({
        start: { rowIdx: dragRef.current.anchorRow, colName: firstCol },
        end: { rowIdx: rIdx, colName: lastCol },
      });
    }
    onSelectRowRange?.(dragRef.current.anchorRow, rIdx);
  };

  return (
    <div
      data-index={virtualIndex}
      data-row-index={rIdx}
      aria-selected={isRowSelected}
      onMouseEnter={(e) => handleRowDragHover(e.buttons)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: rowHeight,
        transform: `translateY(${virtualStart}px)`,
      }}
      className={`group flex items-stretch border-b border-[var(--border-subtle)] text-xs transition-colors ${
        isPendingDelete
          ? 'bg-[var(--dirty-delete)] line-through opacity-75'
          : isRowSelected
            ? 'bg-[var(--selection)] ring-1 ring-inset ring-[var(--accent)]/45'
            : stripedRows && rIdx % 2 === 1
              ? 'bg-[var(--bg-panel)]/35 hover:bg-[var(--bg-hover)]/65'
              : 'hover:bg-[var(--bg-hover)]/65'
      }`}
    >
      <div
        data-row-gutter={rIdx}
        style={{ width: INDEX_GUTTER_WIDTH }}
        onMouseEnter={(e) => handleRowDragHover(e.buttons)}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const firstCol = visibleColIds[0];
          const lastCol = visibleColIds[visibleColIds.length - 1];
          if (!firstCol) return;

          if (e.shiftKey && selectedCell && onSelectRowRange) {
            onSelectRowRange(selectedCell.rowIdx, rIdx);
            onSetCellRange({
              start: { rowIdx: selectedCell.rowIdx, colName: firstCol },
              end: { rowIdx: rIdx, colName: lastCol || firstCol },
            });
            return;
          }

          dragRef.current = {
            mode: 'rows',
            anchorCell: { rowIdx: rIdx, colName: firstCol },
            anchorRow: rIdx,
            crossedRows: true,
          };
          onSetIsDragging(true);
          onSelectCell({ rowIdx: rIdx, colName: firstCol });
          onSetCellRange({
            start: { rowIdx: rIdx, colName: firstCol },
            end: { rowIdx: rIdx, colName: lastCol || firstCol },
          });
          onSelectRowRange?.(rIdx, rIdx);
          scrollContainerRef.current?.focus({ preventScroll: true });
        }}
        title="Click or drag top-to-bottom to select rows"
        className={`sticky left-0 z-10 shrink-0 px-2 border-r border-[var(--border-subtle)] flex items-center justify-between gap-1 cursor-ns-resize select-none ${
          isRowSelected ? 'bg-[var(--bg-active)]' : 'bg-[var(--bg-sidebar)]'
        }`}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleRowSelection(rowKey, e.shiftKey, rIdx);
          }}
        >
          <Checkbox
            checked={isRowSelected}
            onChange={() => onToggleRowSelection(rowKey, false, rIdx)}
            size="sm"
          />
        </div>
        {showRowNumbers && (
          <span className="font-mono text-[10.5px] text-[var(--text-muted)] group-hover:hidden">
            {page * pageSize + rIdx + 1}
          </span>
        )}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="hidden group-hover:flex items-center gap-0.5"
        >
          <button
            type="button"
            onClick={() => onInspectRow(rIdx, displayCols[0])}
            className="p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--text)]"
            title="Inspect Row (Space / F4)"
          >
            <Info size={11} />
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => onStageDeleteRow(rIdx)}
              className="p-0.5 rounded hover:bg-[var(--error)]/20 text-[var(--text-muted)] hover:text-[var(--error)]"
              title="Delete Row"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {headers.map((header, colIdxInView) => {
        const colName = header.colName;
        const pendingKey = `${rowKey}::${colName}`;
        const hasPendingUpdate = pendingKey in pendingCellUpdates;
        const rawVal = hasPendingUpdate
          ? pendingCellUpdates[pendingKey]
          : ((orig[colName] as string | null) ?? null);
        const meta = colMetaMap.get(colName);
        const colIdx = data.columns.indexOf(colName);
        const dtype = meta?.dataType || (colIdx >= 0 ? data.columnTypes?.[colIdx] : '') || '';

        const isSelected = selectedCell?.rowIdx === rIdx && selectedCell?.colName === colName;
        const isEditing = editingCell?.rowIdx === rIdx && editingCell?.colName === colName;

        const inRange =
          Boolean(normalizedRange?.isMultiCell) &&
          normalizedRange !== null &&
          rIdx >= normalizedRange.minRow &&
          rIdx <= normalizedRange.maxRow &&
          colIdxInView >= normalizedRange.minColIdx &&
          colIdxInView <= normalizedRange.maxColIdx;

        const rangeBorders: string[] = [];
        if (inRange && normalizedRange) {
          if (rIdx === normalizedRange.minRow) {
            rangeBorders.push('inset 0 1.5px 0 0 var(--accent)');
          }
          if (rIdx === normalizedRange.maxRow) {
            rangeBorders.push('inset 0 -1.5px 0 0 var(--accent)');
          }
          if (colIdxInView === normalizedRange.minColIdx) {
            rangeBorders.push('inset 1.5px 0 0 0 var(--accent)');
          }
          if (colIdxInView === normalizedRange.maxColIdx) {
            rangeBorders.push('inset -1.5px 0 0 0 var(--accent)');
          }
        }

        const prevRowRawVal =
          collapseRepeats && rIdx > 0 && colIdx >= 0 && !meta?.primaryKey
            ? (data.rows[rIdx - 1]?.[colIdx] ?? null)
            : undefined;
        const isAdjacentRepeat =
          collapseRepeats &&
          !isEditing &&
          !hasPendingUpdate &&
          rawVal !== null &&
          prevRowRawVal !== undefined &&
          prevRowRawVal === rawVal;

        const formatted = formatCellDisplay(rawVal, dtype, nullDisplay, dateFormat);
        const fkTarget = outgoingFkMap?.[colName];
        const isPinned = pinnedLeftOffsets.has(colName);
        const leftOffset = pinnedLeftOffsets.get(colName);
        const isLastPinned = colName === lastPinnedColId;

        return (
          <div
            key={`${rowId}_${colName}`}
            data-cell-coord={`${rIdx}:${colName}`}
            data-active-cell={isSelected ? 'true' : undefined}
            data-in-range={inRange ? 'true' : undefined}
            style={{
              width: header.size,
              fontFamily: 'var(--quorix-grid-font)',
              fontSize: 'var(--quorix-grid-font-size)',
              ...(isPinned ? { left: leftOffset } : {}),
              ...(rangeBorders.length > 0 ? { boxShadow: rangeBorders.join(', ') } : {}),
            }}
            title={
              fkTarget && rawVal !== null
                ? `Ctrl+Click or Ctrl+J → ${fkTarget.toTable}.${fkTarget.toColumn} = ${rawVal}`
                : (rawVal ?? undefined)
            }
            onMouseDown={(e) => {
              if (e.button !== 0 || isEditing) return;
              if ((e.ctrlKey || e.metaKey) && fkTarget && rawVal !== null) return;

              const coord = { rowIdx: rIdx, colName };
              if (e.shiftKey && selectedCell) {
                e.preventDefault();
                const anchor = cellRange?.start ?? selectedCell;
                onSetCellRange({ start: anchor, end: coord });
                onSelectCell(coord);
                if (anchor.rowIdx !== rIdx) {
                  onSelectRowRange?.(anchor.rowIdx, rIdx);
                }
                scrollContainerRef.current?.focus({ preventScroll: true });
                return;
              }

              dragRef.current = {
                mode: 'cells',
                anchorCell: coord,
                anchorRow: rIdx,
                crossedRows: false,
              };
              onSetIsDragging(true);
              onSetCellRange({ start: coord, end: coord });
              if (selectedCell?.rowIdx !== rIdx || selectedCell?.colName !== colName) {
                onSelectCell(coord);
              }
              scrollContainerRef.current?.focus({ preventScroll: true });
            }}
            onMouseEnter={(e) => {
              if (dragRef.current?.mode !== 'cells') return;
              if (e.buttons !== undefined && e.buttons > 0 && (e.buttons & 1) === 0) {
                dragRef.current = null;
                onSetIsDragging(false);
                return;
              }
              const coord = { rowIdx: rIdx, colName };
              onSetCellRange({ start: dragRef.current.anchorCell, end: coord });
              onSelectCell(coord);

              if (rIdx !== dragRef.current.anchorRow) {
                dragRef.current.crossedRows = true;
                onSelectRowRange?.(dragRef.current.anchorRow, rIdx);
              } else if (dragRef.current.crossedRows) {
                onSelectRowRange?.(rIdx, rIdx);
              }
            }}
            onClick={(e) => {
              if ((e.ctrlKey || e.metaKey) && fkTarget && rawVal !== null && onJumpForeignKey) {
                e.preventDefault();
                onJumpForeignKey(rIdx, colName);
              }
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragRef.current = null;
              onSetIsDragging(false);
              if (selectedCell?.rowIdx !== rIdx || selectedCell?.colName !== colName) {
                onSelectCell({ rowIdx: rIdx, colName });
              }
              onInspectRow(rIdx, colName, { startEdit: true });
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onSelectCell({ rowIdx: rIdx, colName });
              onSetCellMenu({
                x: e.clientX,
                y: e.clientY,
                rowIdx: rIdx,
                colName,
                value: rawVal,
              });
            }}
            className={`group/cell shrink-0 px-2.5 border-r border-[var(--border-subtle)] flex items-center overflow-hidden ${
              isEditing ? 'select-text' : 'select-none'
            } ${
              isPinned
                ? `sticky z-10 ${isRowSelected ? 'bg-[var(--bg-active)]' : 'bg-[var(--bg-panel)]'}`
                : 'relative'
            } ${isLastPinned ? 'shadow-[2px_0_6px_-2px_rgba(0,0,0,0.22)]' : ''} ${
              fkTarget && rawVal !== null
                ? 'underline decoration-dotted decoration-[var(--accent)]/60 underline-offset-2'
                : ''
            } ${
              isSelected
                ? 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-muted)]/60'
                : inRange
                  ? 'bg-[var(--accent-muted)]/30'
                  : hasPendingUpdate
                    ? 'bg-[var(--dirty-update)]'
                    : ''
            }`}
          >
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                autoFocus
                onChange={(e) => onEditValueChange(e.target.value)}
                onBlur={() => onCommitEdit({ rowIdx: rIdx, colName }, editValue)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    onCommitEdit({ rowIdx: rIdx, colName }, editValue);
                    onFocusGridContainer();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancelEdit();
                    onFocusGridContainer();
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    e.stopPropagation();
                    const curPos = Math.max(0, visibleColIds.indexOf(colName));
                    const nextCoord = getTabTarget(
                      rIdx,
                      curPos,
                      visibleColIds,
                      totalRowsOnPage,
                      e.shiftKey,
                    );
                    onCommitEdit({ rowIdx: rIdx, colName }, editValue);
                    onMoveCell(nextCoord.rowIdx, nextCoord.colName);
                    onFocusGridContainer();
                  }
                }}
                className="w-full h-6 px-1.5 py-0 bg-[var(--bg)] border border-[var(--border-focus)] rounded"
                style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
              />
            ) : isAdjacentRepeat ? (
              <span
                data-repeated-cell="true"
                className="inline-flex items-center gap-1.5 text-[var(--text-muted)] opacity-45 truncate italic"
              >
                <span aria-hidden="true">↳</span>
                <span className="truncate">{formatted.text}</span>
              </span>
            ) : formatted.isNull ? (
              <span className="px-1.5 py-0.2 rounded bg-[var(--null-badge-bg)] text-[var(--null-badge-text)] text-[0.85em] italic select-none">
                {formatted.text}
              </span>
            ) : formatted.kind === 'num' ? (
              <span className="w-full text-right tabular-nums text-[var(--text)] truncate">
                {formatted.text}
              </span>
            ) : (
              <span className="text-[var(--text)] truncate">{formatted.text}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
