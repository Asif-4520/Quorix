import type React from 'react';
import { getEffectiveShortcut, matchesKeyCombination } from '../../../services/shortcuts';
import type { QueryResponse } from '../../../types/database';
import { getTabTarget } from './cellFormatters';
import type {
  CellCoord,
  CellMenuState,
  CellRange,
  GridRowRecord,
  NormalizedRange,
} from './gridTypes';

interface UseGridKeyboardParams {
  data: QueryResponse | null;
  displayCols: string[];
  records: GridRowRecord[];
  visibleColIds: string[];
  canWrite: boolean;
  selectedCell: CellCoord | null;
  editingCell: CellCoord | null;
  editValue: string;
  cellRange: CellRange | null;
  normalizedRange: NormalizedRange | null;
  selectedRowKeys: Set<string>;
  showGoToCell: boolean;
  hasCellOrHeaderMenu: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  cellMenuRef: React.RefObject<HTMLDivElement | null>;
  selectionAnchorRef: React.MutableRefObject<number | null>;
  getRowKey: (rowIdx: number) => string;
  getCellDisplayValue: (rowIdx: number, colName: string) => string | null;
  focusGridContainer: () => void;
  moveCell: (rowIdx: number, colName: string) => void;
  copySelectedRangeTsv: () => void;
  openGoToCellBar: (toggle?: boolean) => void;
  onSetShowGoToCell: (val: boolean) => void;
  onSetCellMenu: (menu: CellMenuState | null) => void;
  onCloseMenus: () => void;
  onSetCellRange: (range: CellRange | null) => void;
  onSelectCell: (coord: CellCoord | null) => void;
  onToggleRowSelection: (rowKey: string, shiftKey: boolean, rowIdx: number) => void;
  onSelectRowRange?: (fromIdx: number, toIdx: number) => void;
  onClearRowSelection?: () => void;
  onStartEdit: (coord: CellCoord, initialVal: string) => void;
  onCommitEdit: (coord: CellCoord, val: string | null) => void;
  onCancelEdit: () => void;
  onInspectRow: (rowIdx: number, colName: string, options?: { startEdit?: boolean }) => void;
  onCopyToast: (msg: string) => void;
}

export function createGridKeyDownHandler(params: UseGridKeyboardParams) {
  return (e: React.KeyboardEvent) => {
    const {
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
      hasCellOrHeaderMenu,
      scrollContainerRef,
      cellMenuRef,
      selectionAnchorRef,
      getRowKey,
      getCellDisplayValue,
      focusGridContainer,
      moveCell,
      copySelectedRangeTsv,
      openGoToCellBar,
      onSetShowGoToCell,
      onSetCellMenu,
      onCloseMenus,
      onSetCellRange,
      onSelectCell,
      onToggleRowSelection,
      onSelectRowRange,
      onClearRowSelection,
      onStartEdit,
      onCommitEdit,
      onCancelEdit,
      onInspectRow,
      onCopyToast,
    } = params;

    if (!data || displayCols.length === 0 || records.length === 0) return;
    if (cellMenuRef.current?.contains(e.target as Node)) return;
    if (showGoToCell && (e.target as HTMLElement)?.closest('[data-goto-cell-bar="true"]')) {
      return;
    }
    if (visibleColIds.length === 0) return;

    if (editingCell) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelEdit();
        focusGridContainer();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onCommitEdit(editingCell, editValue);
        focusGridContainer();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const editColPos = Math.max(0, visibleColIds.indexOf(editingCell.colName));
        const nextCoord = getTabTarget(
          editingCell.rowIdx,
          editColPos,
          visibleColIds,
          records.length,
          e.shiftKey,
        );
        onCommitEdit(editingCell, editValue);
        moveCell(nextCoord.rowIdx, nextCoord.colName);
        focusGridContainer();
      }
      return;
    }

    const active = selectedCell ?? {
      rowIdx: 0,
      colName: visibleColIds[0],
    };
    const colPos = Math.max(0, visibleColIds.indexOf(active.colName));

    if (matchesKeyCombination(e.nativeEvent, getEffectiveShortcut('goto-grid-cell'))) {
      e.preventDefault();
      e.stopPropagation();
      openGoToCellBar(true);
      return;
    }

    if (matchesKeyCombination(e.nativeEvent, getEffectiveShortcut('select-column-cells'))) {
      e.preventDefault();
      e.stopPropagation();
      onSetCellRange({
        start: { rowIdx: 0, colName: active.colName },
        end: { rowIdx: records.length - 1, colName: active.colName },
      });
      onCopyToast(`Selected all ${records.length} cells in "${active.colName}"`);
      return;
    }

    const extendCellRangeTo = (target: CellCoord) => {
      const anchor = cellRange?.start ?? active;
      onSetCellRange({ start: anchor, end: target });
    };

    const applyVerticalMove = (nextRow: number, colIdxTarget: number) => {
      const target = { rowIdx: nextRow, colName: visibleColIds[colIdxTarget] };
      if (e.shiftKey) {
        extendCellRangeTo(target);
        if (onSelectRowRange) {
          if (selectionAnchorRef.current === null) {
            selectionAnchorRef.current = active.rowIdx;
          }
          onSelectRowRange(selectionAnchorRef.current, nextRow);
        }
      } else {
        selectionAnchorRef.current = null;
        onSetCellRange(null);
      }
      moveCell(target.rowIdx, target.colName);
    };

    if ((e.ctrlKey || e.metaKey) && e.key === 'Home') {
      e.preventDefault();
      applyVerticalMove(0, 0);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'End') {
      e.preventDefault();
      applyVerticalMove(records.length - 1, visibleColIds.length - 1);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
      e.preventDefault();
      applyVerticalMove(0, colPos);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
      e.preventDefault();
      applyVerticalMove(records.length - 1, colPos);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
      e.preventDefault();
      const target = { rowIdx: active.rowIdx, colName: visibleColIds[0] };
      if (e.shiftKey) extendCellRangeTo(target);
      else onSetCellRange(null);
      moveCell(target.rowIdx, target.colName);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
      e.preventDefault();
      const target = {
        rowIdx: active.rowIdx,
        colName: visibleColIds[visibleColIds.length - 1],
      };
      if (e.shiftKey) extendCellRangeTo(target);
      else onSetCellRange(null);
      moveCell(target.rowIdx, target.colName);
    } else if (e.key === 'PageDown' && !e.altKey) {
      e.preventDefault();
      applyVerticalMove(Math.min(records.length - 1, active.rowIdx + 10), colPos);
    } else if (e.key === 'PageUp' && !e.altKey) {
      e.preventDefault();
      applyVerticalMove(Math.max(0, active.rowIdx - 10), colPos);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      applyVerticalMove(Math.min(records.length - 1, active.rowIdx + 1), colPos);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      applyVerticalMove(Math.max(0, active.rowIdx - 1), colPos);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onSetCellRange(null);
      const nextCoord = getTabTarget(
        active.rowIdx,
        colPos,
        visibleColIds,
        records.length,
        e.shiftKey,
      );
      moveCell(nextCoord.rowIdx, nextCoord.colName);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = Math.min(visibleColIds.length - 1, colPos + 1);
      const target = { rowIdx: active.rowIdx, colName: visibleColIds[nextCol] };
      if (e.shiftKey) extendCellRangeTo(target);
      else onSetCellRange(null);
      onSelectCell(target);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextCol = Math.max(0, colPos - 1);
      const target = { rowIdx: active.rowIdx, colName: visibleColIds[nextCol] };
      if (e.shiftKey) extendCellRangeTo(target);
      else onSetCellRange(null);
      onSelectCell(target);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const target = { rowIdx: active.rowIdx, colName: visibleColIds[0] };
      if (e.shiftKey) extendCellRangeTo(target);
      else onSetCellRange(null);
      onSelectCell(target);
    } else if (e.key === 'End') {
      e.preventDefault();
      const target = {
        rowIdx: active.rowIdx,
        colName: visibleColIds[visibleColIds.length - 1],
      };
      if (e.shiftKey) extendCellRangeTo(target);
      else onSetCellRange(null);
      onSelectCell(target);
    } else if (e.key === 'Escape') {
      if (showGoToCell) {
        e.preventDefault();
        e.stopPropagation();
        onSetShowGoToCell(false);
        focusGridContainer();
      } else if (hasCellOrHeaderMenu) {
        e.preventDefault();
        e.stopPropagation();
        onCloseMenus();
        focusGridContainer();
      } else if (normalizedRange?.isMultiCell || selectedRowKeys.size > 0) {
        e.preventDefault();
        e.stopPropagation();
        selectionAnchorRef.current = null;
        onSetCellRange(null);
        onClearRowSelection?.();
      }
    } else if (e.key === ' ' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      selectionAnchorRef.current = active.rowIdx;
      onToggleRowSelection(getRowKey(active.rowIdx), false, active.rowIdx);
    } else if (e.key === ' ') {
      e.preventDefault();
      onInspectRow(active.rowIdx, active.colName);
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const cellEl = scrollContainerRef.current?.querySelector<HTMLElement>(
        '[data-active-cell="true"]',
      );
      const rect =
        cellEl?.getBoundingClientRect() ?? scrollContainerRef.current?.getBoundingClientRect();
      const rawVal = getCellDisplayValue(active.rowIdx, active.colName);
      if (rect) {
        onSetCellMenu({
          x: Math.min(rect.left + 12, window.innerWidth - 220),
          y: Math.min(rect.bottom + 2, window.innerHeight - 280),
          rowIdx: active.rowIdx,
          colName: active.colName,
          value: rawVal,
        });
        requestAnimationFrame(() => {
          cellMenuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
        });
      }
    } else if ((e.key === 'Enter' || e.key === 'F2') && canWrite) {
      e.preventDefault();
      const val = getCellDisplayValue(active.rowIdx, active.colName);
      onStartEdit(active, val ?? '');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const winSel = window.getSelection()?.toString();
      if (winSel) return;
      if (normalizedRange?.isMultiCell) {
        copySelectedRangeTsv();
      } else {
        const val = getCellDisplayValue(active.rowIdx, active.colName);
        void navigator.clipboard.writeText(val ?? 'NULL');
        onCopyToast('Cell copied');
      }
    } else if (e.key === 'Backspace' && canWrite) {
      e.preventDefault();
      onCommitEdit(active, null);
    }
  };
}
