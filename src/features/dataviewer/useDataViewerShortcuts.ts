import type React from 'react';
import { useEffect, useRef } from 'react';
import {
  getEffectiveShortcut,
  matchesKeyCombination,
  shouldIgnoreShortcut,
} from '../../services/shortcuts';
import type {
  ConnectionSummary,
  FilterRule,
  QueryResponse,
  TableDetailsResponse,
  TableInfo,
  TableSubTab,
} from '../../types/database';
import { buildRowCsvClipboardText, buildRowJsonClipboardText } from './exportImportHelpers';
import type { CellCoord } from './grid/RecordsGrid';

interface UseDataViewerShortcutsParams {
  tabId: string;
  table: TableInfo;
  activeSubTab: TableSubTab;
  currentConnection: ConnectionSummary;
  details: TableDetailsResponse | null;
  data: QueryResponse | null;
  page: number;
  pageSize: number;
  selectedCell: CellCoord | null;
  selectedRowKeys: Set<string>;
  searchQuery: string;
  appliedFilters: FilterRule[];
  sortColumn: string | null;
  pendingChangeCount: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  getRowKey: (rowIdx: number) => string;
  focusGrid: () => void;
  updateTab: (tabId: string, patch: { activeSubTab?: TableSubTab }) => void;
  onTriggerGoToCell: () => void;
  onToggleFilterBuilder: () => void;
  onToggleColPicker: () => void;
  onOpenInsertModal: () => void;
  onNavigateToForeignKey: (rowIdx: number, colName: string) => void;
  onCommitAllChanges: () => void;
  onDiscardChanges: () => void;
  onSetPage: (page: number) => void;
  onClearAllFiltersAndSort: () => void;
  onOpenInSql: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onToggleEditMode: () => void;
  onSetSelectedRowKeys: (keys: Set<string>) => void;
  onSort: (colName: string) => void;
  onToggleRowSelection: (rowKey: string, shiftKey: boolean, rowIdx: number) => void;
  onRequestRowDelete: (rowKeys: Set<string>, options: { skipConfirm: boolean }) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function useDataViewerShortcuts(params: UseDataViewerShortcutsParams) {
  const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  handlerRef.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const matchGrid = (id: string) =>
      !shouldIgnoreShortcut(e, id) && matchesKeyCombination(e, getEffectiveShortcut(id));

    if (matchGrid('focus-data-grid')) {
      e.preventDefault();
      params.focusGrid();
      return;
    }
    if (matchGrid('goto-grid-cell')) {
      e.preventDefault();
      if (params.activeSubTab !== 'data') {
        params.updateTab(params.tabId, { activeSubTab: 'data' });
        requestAnimationFrame(() => params.onTriggerGoToCell());
      } else {
        params.onTriggerGoToCell();
      }
      return;
    }
    if (matchGrid('find-in-table')) {
      e.preventDefault();
      params.searchInputRef.current?.focus();
      params.searchInputRef.current?.select();
      return;
    }
    if (matchGrid('toggle-filter-builder')) {
      e.preventDefault();
      params.onToggleFilterBuilder();
      return;
    }
    if (matchGrid('column-visibility')) {
      e.preventDefault();
      params.onToggleColPicker();
      return;
    }
    if (matchGrid('insert-row')) {
      if (params.details?.editable && !params.currentConnection.readOnly) {
        e.preventDefault();
        params.onOpenInsertModal();
      }
      return;
    }
    if (matchGrid('jump-foreign-key')) {
      if (params.selectedCell) {
        e.preventDefault();
        params.onNavigateToForeignKey(params.selectedCell.rowIdx, params.selectedCell.colName);
      }
      return;
    }
    if (matchGrid('save-action')) {
      if (params.pendingChangeCount > 0) {
        e.preventDefault();
        params.onCommitAllChanges();
      }
      return;
    }
    if (matchGrid('discard-grid-changes')) {
      if (params.pendingChangeCount > 0) {
        e.preventDefault();
        params.onDiscardChanges();
        params.onShowToast('Discarded staged changes', 'info');
      }
      return;
    }
    if (matchGrid('grid-next-page')) {
      const totalRowsCount = params.data?.totalRows ?? params.data?.rows.length ?? 0;
      const maxPage = Math.max(0, Math.ceil(totalRowsCount / params.pageSize) - 1);
      if (params.page < maxPage) {
        e.preventDefault();
        params.onSetPage(params.page + 1);
      }
      return;
    }
    if (matchGrid('grid-prev-page')) {
      if (params.page > 0) {
        e.preventDefault();
        params.onSetPage(params.page - 1);
      }
      return;
    }
    if (matchGrid('grid-first-page')) {
      if (params.page > 0) {
        e.preventDefault();
        params.onSetPage(0);
      }
      return;
    }
    if (matchGrid('grid-last-page')) {
      const totalRows = params.data?.totalRows ?? 0;
      const lastPage = Math.max(0, Math.ceil(totalRows / Math.max(1, params.pageSize)) - 1);
      if (params.page < lastPage) {
        e.preventDefault();
        params.onSetPage(lastPage);
      }
      return;
    }
    if (matchGrid('grid-clear-filters')) {
      if (params.searchQuery || params.appliedFilters.length > 0 || params.sortColumn) {
        e.preventDefault();
        params.onClearAllFiltersAndSort();
      }
      return;
    }
    if (matchGrid('grid-open-in-sql')) {
      e.preventDefault();
      params.onOpenInSql();
      return;
    }
    if (matchGrid('copy-row-json')) {
      if (params.selectedCell && params.data) {
        e.preventDefault();
        const row = params.data.rows[params.selectedCell.rowIdx];
        if (row) {
          void navigator.clipboard.writeText(buildRowJsonClipboardText(params.data.columns, row));
          params.onShowToast('Row copied as JSON', 'info');
        }
      }
      return;
    }
    if (matchGrid('copy-row-csv')) {
      if (params.selectedCell && params.data) {
        e.preventDefault();
        const row = params.data.rows[params.selectedCell.rowIdx];
        if (row) {
          void navigator.clipboard.writeText(buildRowCsvClipboardText(params.data.columns, row));
          params.onShowToast('Row copied as CSV', 'info');
        }
      }
      return;
    }
    if (matchGrid('export-data')) {
      e.preventDefault();
      params.onExportCsv();
      return;
    }
    if (matchGrid('grid-export-json')) {
      e.preventDefault();
      params.onExportJson();
      return;
    }
    if (matchGrid('grid-toggle-edit-mode')) {
      e.preventDefault();
      params.onToggleEditMode();
      return;
    }
    if (matchGrid('select-all-rows')) {
      if (params.activeSubTab === 'data' && params.data && params.data.rows.length > 0) {
        e.preventDefault();
        const allKeys = params.data.rows.map((_, i) => params.getRowKey(i));
        const allSelected = allKeys.every((k) => params.selectedRowKeys.has(k));
        params.onSetSelectedRowKeys(allSelected ? new Set() : new Set(allKeys));
      }
      return;
    }
    if (matchGrid('sort-focused-column')) {
      if (params.activeSubTab === 'data' && params.selectedCell) {
        e.preventDefault();
        params.onSort(params.selectedCell.colName);
      }
      return;
    }
    if (matchGrid('toggle-row-select')) {
      if (params.selectedCell && params.data) {
        e.preventDefault();
        params.onToggleRowSelection(
          params.getRowKey(params.selectedCell.rowIdx),
          false,
          params.selectedCell.rowIdx,
        );
      }
      return;
    }
    if (matchGrid('stage-delete-row')) {
      if (
        params.activeSubTab === 'data' &&
        params.details?.editable &&
        !params.currentConnection.readOnly &&
        params.data
      ) {
        const targetKeys = new Set(
          params.selectedRowKeys.size > 0
            ? Array.from(params.selectedRowKeys)
            : params.selectedCell
              ? [params.getRowKey(params.selectedCell.rowIdx)]
              : [],
        );
        if (targetKeys.size > 0) {
          e.preventDefault();
          params.onRequestRowDelete(targetKeys, { skipConfirm: true });
        }
      }
      return;
    }
    if (matchGrid('delete-row')) {
      if (
        params.activeSubTab === 'data' &&
        params.details?.editable &&
        !params.currentConnection.readOnly &&
        params.data
      ) {
        const targetKeys = new Set(
          params.selectedRowKeys.size > 0
            ? Array.from(params.selectedRowKeys)
            : params.selectedCell
              ? [params.getRowKey(params.selectedCell.rowIdx)]
              : [],
        );
        if (targetKeys.size > 0) {
          e.preventDefault();
          params.onRequestRowDelete(targetKeys, { skipConfirm: false });
        }
      }
      return;
    }

    const tabMap: Array<[string, TableSubTab]> = [
      ['view-data', 'data'],
      ['view-structure', 'structure'],
      ['view-relations', 'relations'],
      ['view-indexes', 'indexes'],
      ['view-constraints', 'constraints'],
      ['view-statistics', 'statistics'],
      ['view-ddl', 'ddl'],
    ];
    for (const [id, sub] of tabMap) {
      if (matchGrid(id)) {
        e.preventDefault();
        if (sub === 'data') {
          params.focusGrid();
        } else {
          params.updateTab(params.tabId, { activeSubTab: sub });
        }
        return;
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handlerRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
