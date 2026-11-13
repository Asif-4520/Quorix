import type { ColumnOrderState, ColumnVisibilityState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type {
  ColumnInfo,
  FilterOperator,
  ForeignKeyInfo,
  QueryResponse,
} from '../../../types/database';
import { GoToCellPopover } from './GoToCellPopover';
import { GridContextMenus } from './GridContextMenus';
import { GridFooter } from './GridFooter';
import { GridHeaderRow } from './GridHeaderRow';
import { GridRow } from './GridRow';
import {
  type CellCoord,
  type CellMenuState,
  type DragState,
  type HeaderMenuState,
  INDEX_GUTTER_WIDTH,
} from './gridTypes';
import { createGridKeyDownHandler } from './useGridKeyboardNavigation';
import { useGridTableState } from './useGridTableState';

export type { CellCoord };

interface RecordsGridProps {
  data: QueryResponse | null;
  columnMeta: ColumnInfo[];
  loading: boolean;
  stripedRows?: boolean;
  showRowNumbers?: boolean;
  nullDisplay: 'NULL' | 'null' | '—';
  dateFormat: 'iso' | 'local' | 'relative';
  editable: boolean;
  readOnlyConnection: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortColumn: string | null;
  sortDesc: boolean;
  onSort: (colName: string) => void;
  columnOrder: string[];
  onColumnOrderChange: (
    updater: ColumnOrderState | ((old: ColumnOrderState) => ColumnOrderState),
  ) => void;
  columnVisibility: ColumnVisibilityState;
  onColumnVisibilityChange: (
    updater: ColumnVisibilityState | ((old: ColumnVisibilityState) => ColumnVisibilityState),
  ) => void;
  selectedRowKeys: Set<string>;
  onToggleRowSelection: (rowKey: string, shiftKey: boolean, rowIdx: number) => void;
  onSelectRowRange?: (fromIdx: number, toIdx: number) => void;
  onClearRowSelection?: () => void;
  onToggleAllPageRows: (checked: boolean) => void;
  selectedCell: CellCoord | null;
  onSelectCell: (coord: CellCoord | null) => void;
  openGoToCellSignal?: number;
  outgoingFkMap?: Record<string, ForeignKeyInfo>;
  onJumpForeignKey?: (rowIdx: number, colName: string) => void;
  editingCell: CellCoord | null;
  editValue: string;
  onStartEdit: (coord: CellCoord, initialVal: string) => void;
  onEditValueChange: (val: string) => void;
  onCommitEdit: (coord: CellCoord, val: string | null) => void;
  onCancelEdit: () => void;
  pendingCellUpdates: Record<string, string | null>;
  pendingDeletes: Set<string>;
  onInspectRow: (rowIdx: number, colName: string, options?: { startEdit?: boolean }) => void;
  onQuickFilter: (colName: string, operator: FilterOperator, value?: string) => void;
  onStageDeleteRow: (rowIdx: number) => void;
  onCopyToast: (msg: string) => void;
  getRowKey: (rowIdx: number) => string;
}

export const RecordsGrid: React.FC<RecordsGridProps> = ({
  data,
  columnMeta,
  loading,
  stripedRows = true,
  showRowNumbers = true,
  nullDisplay,
  dateFormat,
  editable,
  readOnlyConnection,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortColumn,
  sortDesc,
  onSort,
  columnOrder,
  onColumnOrderChange,
  columnVisibility,
  onColumnVisibilityChange,
  selectedRowKeys,
  onToggleRowSelection,
  onSelectRowRange,
  onClearRowSelection,
  onToggleAllPageRows,
  selectedCell,
  onSelectCell,
  openGoToCellSignal = 0,
  editingCell,
  editValue,
  onStartEdit,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  pendingCellUpdates,
  pendingDeletes,
  onInspectRow,
  onQuickFilter,
  outgoingFkMap,
  onJumpForeignKey,
  onStageDeleteRow,
  onCopyToast,
  getRowKey,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cellMenuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const goToInputRef = useRef<HTMLInputElement>(null);
  const prevGoToSignalRef = useRef<number>(openGoToCellSignal);
  const selectionAnchorRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [showGoToCell, setShowGoToCell] = useState(false);
  const [goToRowInput, setGoToRowInput] = useState('1');
  const [goToColInput, setGoToColInput] = useState('');
  const [cellMenu, setCellMenu] = useState<CellMenuState | null>(null);
  const [headerMenu, setHeaderMenu] = useState<HeaderMenuState | null>(null);

  const {
    pinnedCols,
    collapseRepeats,
    setCollapseRepeats,
    cellRange,
    setCellRange,
    displayCols,
    colMetaMap,
    colDistinctCounts,
    records,
    tableRows,
    rowHeight,
    orderedHeaderSpecs,
    pinnedLeftOffsets,
    lastPinnedColId,
    visibleColIds,
    normalizedRange,
    totalColsWidth,
    hasCustomLayout,
    getCellDisplayValue,
    copySelectedRangeTsv,
    autoFitColumn,
    togglePinColumn,
    moveColumnBy,
    resetGridLayout,
  } = useGridTableState({
    data,
    columnMeta,
    columnOrder,
    columnVisibility,
    pendingCellUpdates,
    getRowKey,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onCopyToast,
  });

  useEffect(() => {
    const closeMenus = (e: MouseEvent) => {
      setCellMenu(null);
      setHeaderMenu(null);
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-goto-cell-bar="true"], [data-goto-toggle="true"]')) {
        setShowGoToCell(false);
      }
    };
    const endDrag = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setIsDragging(false);
      }
    };
    window.addEventListener('mousedown', closeMenus);
    window.addEventListener('mouseup', endDrag);
    return () => {
      window.removeEventListener('mousedown', closeMenus);
      window.removeEventListener('mouseup', endDrag);
    };
  }, []);

  useEffect(() => {
    if (!selectedCell || !scrollContainerRef.current) return;
    const cellEl = scrollContainerRef.current.querySelector<HTMLElement>(
      '[data-active-cell="true"]',
    );
    cellEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedCell]);

  const focusGridContainer = () => {
    requestAnimationFrame(() => {
      scrollContainerRef.current?.focus({ preventScroll: true });
    });
  };

  const canWrite = editable && !readOnlyConnection;

  const openGoToCellBar = (toggle = false) => {
    setShowGoToCell((prev) => {
      const next = toggle ? !prev : true;
      if (next) {
        setGoToRowInput(String((selectedCell?.rowIdx ?? 0) + 1));
        setGoToColInput(selectedCell?.colName || visibleColIds[0] || displayCols[0] || '');
        requestAnimationFrame(() => {
          goToInputRef.current?.focus();
          goToInputRef.current?.select();
        });
      }
      return next;
    });
  };

  const openGoToCellBarRef = useRef(openGoToCellBar);
  openGoToCellBarRef.current = openGoToCellBar;

  useEffect(() => {
    if (openGoToCellSignal <= prevGoToSignalRef.current) {
      prevGoToSignalRef.current = openGoToCellSignal;
      return;
    }
    prevGoToSignalRef.current = openGoToCellSignal;
    openGoToCellBarRef.current(true);
  }, [openGoToCellSignal]);

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    initialRect: { width: 800, height: 600 },
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const moveCell = (rowIdx: number, colName: string) => {
    onSelectCell({ rowIdx, colName });
    rowVirtualizer.scrollToIndex(rowIdx, { align: 'auto' });
  };

  const resolveGoToTarget = () => {
    const rawNum = Number.parseInt(goToRowInput, 10);
    const hasNum = Number.isFinite(rawNum);
    const isOutOfRange = hasNum && (rawNum < 1 || rawNum > records.length);
    const targetRow = hasNum
      ? Math.min(Math.max(0, records.length - 1), Math.max(0, rawNum - 1))
      : (selectedCell?.rowIdx ?? 0);
    const colQuery = goToColInput.trim().toLowerCase();
    const targetCol =
      visibleColIds.find((c) => c.toLowerCase() === colQuery) ||
      visibleColIds.find((c) => c.toLowerCase().includes(colQuery)) ||
      selectedCell?.colName ||
      visibleColIds[0];
    return { targetRow, targetCol, isOutOfRange };
  };

  const executeGoToCell = (selectWholeRow = false) => {
    if (records.length === 0 || visibleColIds.length === 0) return;
    const { targetRow, targetCol } = resolveGoToTarget();
    const firstCol = visibleColIds[0];
    const lastCol = visibleColIds[visibleColIds.length - 1];
    const coord = { rowIdx: targetRow, colName: targetCol };
    if (selectWholeRow && firstCol && lastCol) {
      setCellRange({
        start: { rowIdx: targetRow, colName: firstCol },
        end: { rowIdx: targetRow, colName: lastCol },
      });
      onSelectRowRange?.(targetRow, targetRow);
    } else {
      setCellRange({ start: coord, end: coord });
    }
    moveCell(targetRow, targetCol);
    setShowGoToCell(false);
    focusGridContainer();
  };

  const handleGridKeyDown = createGridKeyDownHandler({
    data,
    displayCols,
    records,
    visibleColIds,
    canWrite,
    selectedCell,
    editingCell,
    editValue,
    cellRange,
    normalizedRange,
    selectedRowKeys,
    showGoToCell,
    hasCellOrHeaderMenu: Boolean(cellMenu || headerMenu),
    scrollContainerRef,
    cellMenuRef,
    selectionAnchorRef,
    getRowKey,
    getCellDisplayValue,
    focusGridContainer,
    moveCell,
    copySelectedRangeTsv,
    openGoToCellBar,
    onSetShowGoToCell: setShowGoToCell,
    onSetCellMenu: setCellMenu,
    onCloseMenus: () => {
      setCellMenu(null);
      setHeaderMenu(null);
    },
    onSetCellRange: setCellRange,
    onSelectCell,
    onToggleRowSelection,
    onSelectRowRange,
    onClearRowSelection,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onInspectRow,
    onCopyToast,
  });

  const totalRows = data?.totalRows ?? records.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const allPageSelected =
    records.length > 0 && records.every((r) => selectedRowKeys.has(r.__rowKey));
  const somePageSelected = !allPageSelected && records.some((r) => selectedRowKeys.has(r.__rowKey));

  const previewTarget = showGoToCell ? resolveGoToTarget() : null;
  const previewVal = previewTarget?.targetCol
    ? getCellDisplayValue(previewTarget.targetRow, previewTarget.targetCol)
    : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)] relative">
      {showGoToCell && records.length > 0 && previewTarget && (
        <GoToCellPopover
          rowCount={records.length}
          goToRowInput={goToRowInput}
          goToColInput={goToColInput}
          visibleColIds={visibleColIds}
          colMetaMap={colMetaMap}
          nullDisplay={nullDisplay}
          goToInputRef={goToInputRef}
          previewTarget={previewTarget}
          previewVal={previewVal}
          hasSelectRowRange={Boolean(onSelectRowRange)}
          onRowInputChange={setGoToRowInput}
          onColInputChange={setGoToColInput}
          onSubmit={(e) => {
            e.preventDefault();
            executeGoToCell(false);
          }}
          onSelectWholeRow={() => executeGoToCell(true)}
          onClose={() => {
            setShowGoToCell(false);
            focusGridContainer();
          }}
        />
      )}

      <div
        ref={scrollContainerRef}
        data-grid-focus-target="true"
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        onFocus={() => {
          if (!selectedCell && records.length > 0 && orderedHeaderSpecs[0]) {
            onSelectCell({ rowIdx: 0, colName: orderedHeaderSpecs[0].colName });
          }
        }}
        className={`flex-1 overflow-auto focus:outline-none relative ${
          isDragging ? 'select-none' : ''
        }`}
      >
        {loading && (
          <div className="absolute inset-0 z-40 bg-[var(--bg)]/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="px-3 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] shadow-lg inline-flex items-center gap-2 text-xs">
              <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
              <span>Loading records…</span>
            </div>
          </div>
        )}

        {!data || displayCols.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] p-8">
            {loading ? 'Fetching table data…' : 'No columns available'}
          </div>
        ) : (
          <div style={{ minWidth: totalColsWidth + INDEX_GUTTER_WIDTH }} className="relative">
            <GridHeaderRow
              data={data}
              headers={orderedHeaderSpecs}
              colMetaMap={colMetaMap}
              colDistinctCounts={colDistinctCounts}
              outgoingFkMap={outgoingFkMap}
              sortColumn={sortColumn}
              sortDesc={sortDesc}
              pinnedLeftOffsets={pinnedLeftOffsets}
              lastPinnedColId={lastPinnedColId}
              allPageSelected={allPageSelected}
              somePageSelected={somePageSelected}
              onToggleAllPageRows={onToggleAllPageRows}
              onSort={onSort}
              onAutoFitColumn={autoFitColumn}
              onSetHeaderMenu={setHeaderMenu}
            />

            {records.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                No matching records found.
              </div>
            ) : (
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  position: 'relative',
                }}
              >
                {virtualRows.map((vRow) => {
                  const row = tableRows[vRow.index];
                  const orig = row.original;
                  const rowKey = orig.__rowKey;

                  return (
                    <GridRow
                      key={row.id}
                      virtualIndex={vRow.index}
                      virtualStart={vRow.start}
                      rowHeight={rowHeight}
                      rowId={row.id}
                      orig={orig}
                      data={data}
                      headers={orderedHeaderSpecs}
                      visibleColIds={visibleColIds}
                      displayCols={displayCols}
                      colMetaMap={colMetaMap}
                      outgoingFkMap={outgoingFkMap}
                      pinnedLeftOffsets={pinnedLeftOffsets}
                      lastPinnedColId={lastPinnedColId}
                      stripedRows={stripedRows}
                      showRowNumbers={showRowNumbers}
                      canWrite={canWrite}
                      page={page}
                      pageSize={pageSize}
                      totalRowsOnPage={records.length}
                      nullDisplay={nullDisplay}
                      dateFormat={dateFormat}
                      collapseRepeats={collapseRepeats}
                      isRowSelected={selectedRowKeys.has(rowKey)}
                      isPendingDelete={pendingDeletes.has(rowKey)}
                      selectedCell={selectedCell}
                      editingCell={editingCell}
                      editValue={editValue}
                      normalizedRange={normalizedRange}
                      cellRange={cellRange}
                      pendingCellUpdates={pendingCellUpdates}
                      dragRef={dragRef}
                      scrollContainerRef={scrollContainerRef}
                      onSetIsDragging={setIsDragging}
                      onSetCellRange={setCellRange}
                      onSelectCell={onSelectCell}
                      onMoveCell={moveCell}
                      onToggleRowSelection={onToggleRowSelection}
                      onSelectRowRange={onSelectRowRange}
                      onInspectRow={onInspectRow}
                      onStageDeleteRow={onStageDeleteRow}
                      onJumpForeignKey={onJumpForeignKey}
                      onEditValueChange={onEditValueChange}
                      onCommitEdit={onCommitEdit}
                      onCancelEdit={onCancelEdit}
                      onSetCellMenu={setCellMenu}
                      onFocusGridContainer={focusGridContainer}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <GridFooter
        data={data}
        recordCount={records.length}
        page={page}
        pageSize={pageSize}
        totalRows={totalRows}
        totalPages={totalPages}
        normalizedRange={normalizedRange}
        selectedRowCount={selectedRowKeys.size}
        collapseRepeats={collapseRepeats}
        hasCustomLayout={hasCustomLayout}
        hasClearRowSelection={Boolean(onClearRowSelection)}
        onClearSelection={() => {
          setCellRange(null);
          onClearRowSelection?.();
        }}
        onOpenGoToCell={() => openGoToCellBar(true)}
        onToggleCollapseRepeats={() => setCollapseRepeats((v) => !v)}
        onResetGridLayout={resetGridLayout}
        onPageSizeChange={onPageSizeChange}
        onPageChange={onPageChange}
      />

      <GridContextMenus
        data={data}
        displayCols={displayCols}
        canWrite={canWrite}
        sortColumn={sortColumn}
        sortDesc={sortDesc}
        pinnedCols={pinnedCols}
        outgoingFkMap={outgoingFkMap}
        normalizedRange={normalizedRange}
        headerMenu={headerMenu}
        cellMenu={cellMenu}
        headerMenuRef={headerMenuRef}
        cellMenuRef={cellMenuRef}
        onCloseHeaderMenu={() => setHeaderMenu(null)}
        onCloseCellMenu={() => setCellMenu(null)}
        onFocusGridContainer={focusGridContainer}
        onSort={onSort}
        onQuickFilter={onQuickFilter}
        onTogglePinColumn={togglePinColumn}
        onAutoFitColumn={autoFitColumn}
        onMoveColumnBy={moveColumnBy}
        onColumnVisibilityChange={onColumnVisibilityChange}
        onCopyRangeTsv={copySelectedRangeTsv}
        onSelectRowRange={onSelectRowRange}
        onInspectRow={onInspectRow}
        onJumpForeignKey={onJumpForeignKey}
        onCommitEdit={onCommitEdit}
        onStageDeleteRow={onStageDeleteRow}
        onCopyToast={onCopyToast}
      />
    </div>
  );
};
