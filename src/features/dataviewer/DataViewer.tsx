import type { ColumnOrderState, ColumnVisibilityState } from '@tanstack/react-table';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createIndex, dropIndex } from '../../services/tauri';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import type {
  ConnectionSummary,
  FilterRule,
  ForeignKeyInfo,
  QueryResponse,
  TableInfo,
  TableSubTab,
} from '../../types/database';
import { ColumnVisibilityPicker } from './ColumnVisibilityPicker';
import { DataViewerHeader } from './DataViewerHeader';
import { exportTableData, importFileToTable } from './exportImportHelpers';
import { FilterBuilder } from './FilterBuilder';
import { type CellCoord, RecordsGrid } from './grid/RecordsGrid';
import { InsertRowModal } from './InsertRowModal';
import { ConstraintsTab } from './tabs/ConstraintsTab';
import { DdlTab } from './tabs/DdlTab';
import { IndexesTab } from './tabs/IndexesTab';
import { RelationsTab } from './tabs/RelationsTab';
import { StatisticsTab } from './tabs/StatisticsTab';
import { StructureTab } from './tabs/StructureTab';
import { useDataViewerQueries } from './useDataViewerQueries';
import { useDataViewerShortcuts } from './useDataViewerShortcuts';
import { useTableMutations } from './useTableMutations';

interface DataViewerProps {
  tabId: string;
  table: TableInfo;
  activeSubTab: TableSubTab;
  initialFilters?: FilterRule[];
  currentConnection: ConnectionSummary;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRequestConfirm: (
    title: string,
    message: string,
    sql: string | undefined,
    onConfirm: () => Promise<void> | void,
  ) => void;
  onNavigateToTable: (table: string, schema?: string, initialFilters?: FilterRule[]) => void;
}

export const DataViewer: React.FC<DataViewerProps> = ({
  tabId,
  table,
  activeSubTab,
  initialFilters,
  currentConnection,
  onShowToast,
  onRequestConfirm,
  onNavigateToTable,
}) => {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const updateTab = useWorkspaceStore((s) => s.updateTab);
  const openSqlTab = useWorkspaceStore((s) => s.openSqlTab);
  const inspectorOpen = useWorkspaceStore((s) => s.inspectorOpen);
  const setInspectorOpen = useWorkspaceStore((s) => s.setInspectorOpen);
  const setInspectorTarget = useWorkspaceStore((s) => s.setInspectorTarget);
  const setStatusMetrics = useWorkspaceStore((s) => s.setStatusMetrics);

  const [showColPicker, setShowColPicker] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const lastSelectedIdxRef = useRef<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellCoord | null>(null);
  const [goToCellSignal, setGoToCellSignal] = useState(0);
  const inspectEditReqSeqRef = useRef(0);
  const lastInspectSyncRef = useRef<{
    rowIdx: number;
    colName: string;
    data: QueryResponse;
    pendingCellUpdates: Record<string, string | null>;
  } | null>(null);
  const [showInsertModal, setShowInsertModal] = useState(false);

  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportFormat, setPendingImportFormat] = useState<'csv' | 'json'>('csv');

  const clearSelectedRowsOnLoad = useCallback(() => setSelectedRowKeys(new Set()), []);

  const {
    details,
    data,
    loading,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortColumn,
    sortDesc,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    searchInputRef,
    showFilterBuilder,
    setShowFilterBuilder,
    draftFilters,
    setDraftFilters,
    appliedFilters,
    setAppliedFilters,
    filterLogic,
    setFilterLogic,
    columnsList,
    loadDetails,
    loadData,
    handleSort,
    clearFiltersAndSort,
  } = useDataViewerQueries({
    table,
    currentConnection,
    defaultPageSize: settings.defaultPageSize,
    initialFilters,
    onSetColumnOrder: setColumnOrder,
    onDataLoaded: clearSelectedRowsOnLoad,
    onShowToast,
  });

  const handleUpdateTabDirty = useCallback(
    (id: string, isDirty: boolean) => updateTab(id, { isDirty }),
    [updateTab],
  );

  const {
    editingCell,
    setEditingCell,
    editValue,
    setEditValue,
    pendingCellUpdates,
    pendingDeletes,
    committingChanges,
    pendingChangeCount,
    getRowKey,
    commitAllChanges,
    discardChanges,
    handleCommitCellEdit,
    requestRowDelete,
    deleteOrStageRowKeys,
    handleDeleteSelectedRows,
    handleInsertRowSubmit,
  } = useTableMutations({
    tabId,
    table,
    currentConnection,
    settings,
    data,
    details,
    page,
    selectedRowKeys,
    onSetSelectedRowKeys: setSelectedRowKeys,
    onUpdateTabDirty: handleUpdateTabDirty,
    onReloadData: loadData,
    onShowToast,
    onRequestConfirm,
  });

  useEffect(() => {
    if (!data) return;
    const total = data.totalRows ?? data.rows.length;
    const start = data.rows.length === 0 ? 0 : page * pageSize + 1;
    const end = page * pageSize + data.rows.length;
    setStatusMetrics({
      rowsInfo: `${start}–${end} / ${total.toLocaleString()} rows`,
      cellInfo: selectedCell
        ? `Row ${selectedCell.rowIdx + 1} · ${selectedCell.colName}`
        : undefined,
      durationMs: data.durationMs,
      txState:
        pendingChangeCount > 0
          ? 'Staged Changes'
          : settings.editMode === 'staged'
            ? 'Staged Edit'
            : 'Auto-Commit',
    });
  }, [data, page, pageSize, selectedCell, pendingChangeCount, settings.editMode, setStatusMetrics]);

  const handleInspectRow = useCallback(
    (rowIdx: number, colName: string, options?: { startEdit?: boolean }) => {
      if (!data) return;
      const baseRow = data.rows[rowIdx];
      if (!baseRow) return;
      const rowKey = getRowKey(rowIdx);
      const effectiveRow = data.columns.map((col, idx) => {
        const pendingKey = `${rowKey}::${col}`;
        return pendingKey in pendingCellUpdates
          ? pendingCellUpdates[pendingKey]
          : (baseRow[idx] ?? null);
      });
      const canEdit = Boolean(details?.editable && !currentConnection.readOnly);
      lastInspectSyncRef.current = {
        rowIdx,
        colName,
        data,
        pendingCellUpdates,
      };
      let editRequestId: number | undefined;
      if (options?.startEdit) {
        setEditingCell(null);
        inspectEditReqSeqRef.current += 1;
        editRequestId = inspectEditReqSeqRef.current;
      }
      setInspectorTarget(
        {
          kind: 'row',
          connectionId: currentConnection.id,
          tableName: table.name,
          schema: table.schema,
          rowIndex: page * pageSize + rowIdx,
          row: effectiveRow,
          columns: data.columns,
          columnMeta: details?.columns || [],
          selectedColName: colName,
          readOnly: !canEdit,
          autoStartEdit: Boolean(options?.startEdit && canEdit),
          editRequestId,
          onSaveField: (targetCol, newVal) =>
            handleCommitCellEdit({ rowIdx, colName: targetCol }, newVal),
        },
        true,
      );
    },
    [
      data,
      getRowKey,
      pendingCellUpdates,
      setEditingCell,
      setInspectorTarget,
      currentConnection.id,
      currentConnection.readOnly,
      table.name,
      table.schema,
      page,
      pageSize,
      details?.columns,
      details?.editable,
      handleCommitCellEdit,
    ],
  );

  useEffect(() => {
    if (!inspectorOpen) {
      lastInspectSyncRef.current = null;
      return;
    }
    if (selectedCell && data) {
      const prev = lastInspectSyncRef.current;
      if (
        prev &&
        prev.rowIdx === selectedCell.rowIdx &&
        prev.colName === selectedCell.colName &&
        prev.data === data &&
        prev.pendingCellUpdates === pendingCellUpdates
      ) {
        return;
      }
      handleInspectRow(selectedCell.rowIdx, selectedCell.colName);
    }
  }, [inspectorOpen, selectedCell, data, pendingCellUpdates, handleInspectRow]);

  const focusGrid = useCallback(() => {
    if (activeSubTab !== 'data') {
      updateTab(tabId, { activeSubTab: 'data' });
    }
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('[data-grid-focus-target="true"]');
      target?.focus();
    });
  }, [activeSubTab, tabId, updateTab]);

  const outgoingFkByCol = useMemo(() => {
    const map: Record<string, ForeignKeyInfo> = {};
    for (const fk of details?.foreignKeys || []) {
      if (fk.direction !== 'incoming' && fk.fromColumn && !map[fk.fromColumn]) {
        map[fk.fromColumn] = fk;
      }
    }
    return map;
  }, [details?.foreignKeys]);

  const navigateToForeignKey = useCallback(
    (rowIdx: number, colName: string) => {
      const fk = outgoingFkByCol[colName];
      if (!fk) {
        onShowToast(`Column "${colName}" is not a foreign key`, 'info');
        return;
      }
      if (!data) return;
      const colIdx = data.columns.indexOf(colName);
      if (colIdx < 0) return;
      const rowKey = getRowKey(rowIdx);
      const pendingKey = `${rowKey}::${colName}`;
      const val =
        pendingKey in pendingCellUpdates
          ? pendingCellUpdates[pendingKey]
          : (data.rows[rowIdx]?.[colIdx] ?? null);
      if (val === null || val === undefined) {
        onShowToast('Foreign-key cell is NULL', 'info');
        return;
      }
      onNavigateToTable(fk.toTable, fk.toSchema, [
        {
          id: `fk_${Date.now()}`,
          column: fk.toColumn,
          operator: 'equals',
          value: val,
        },
      ]);
    },
    [outgoingFkByCol, data, getRowKey, pendingCellUpdates, onNavigateToTable, onShowToast],
  );

  useEffect(() => {
    if (!data || data.rows.length === 0) {
      setSelectedCell(null);
      return;
    }
    setSelectedCell((prev) => {
      if (!prev) {
        const firstCol = data.columns.find((c) => c !== '__quorix_rowid__');
        return firstCol ? { rowIdx: 0, colName: firstCol } : null;
      }
      if (prev.rowIdx >= data.rows.length) {
        return { ...prev, rowIdx: data.rows.length - 1 };
      }
      return prev;
    });
    if (
      activeSubTab === 'data' &&
      (document.activeElement === document.body ||
        document.activeElement?.closest('[data-workspace-root]') !== null)
    ) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[data-grid-focus-target="true"]')?.focus();
      });
    }
  }, [data, activeSubTab]);

  const handleToggleRowSelection = (rowKey: string, shiftKey: boolean, rowIdx: number) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIdxRef.current !== null && data) {
        const start = Math.min(lastSelectedIdxRef.current, rowIdx);
        const end = Math.max(lastSelectedIdxRef.current, rowIdx);
        for (let i = start; i <= end; i++) {
          next.add(getRowKey(i));
        }
      } else if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      lastSelectedIdxRef.current = rowIdx;
      return next;
    });
  };

  const handleSelectRowRange = (fromIdx: number, toIdx: number) => {
    if (!data) return;
    const start = Math.max(0, Math.min(fromIdx, toIdx));
    const end = Math.min(data.rows.length - 1, Math.max(fromIdx, toIdx));
    const next = new Set<string>();
    for (let i = start; i <= end; i++) {
      next.add(getRowKey(i));
    }
    lastSelectedIdxRef.current = toIdx;
    setSelectedRowKeys(next);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    await exportTableData({
      connectionId: currentConnection.id,
      tableName: table.name,
      schema: table.schema,
      format,
      searchQuery: debouncedSearch,
      appliedFilters,
      filterLogic,
      sortColumn,
      sortDesc,
      onShowToast,
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await importFileToTable({
      file,
      connectionId: currentConnection.id,
      tableName: table.name,
      schema: table.schema,
      format: pendingImportFormat,
      onShowToast,
      onReload: loadData,
    });
  };

  useDataViewerShortcuts({
    tabId,
    table,
    activeSubTab,
    currentConnection,
    details,
    data,
    page,
    pageSize,
    selectedCell,
    selectedRowKeys,
    searchQuery,
    appliedFilters,
    sortColumn,
    pendingChangeCount,
    searchInputRef,
    getRowKey,
    focusGrid,
    updateTab,
    onTriggerGoToCell: () => setGoToCellSignal((n) => n + 1),
    onToggleFilterBuilder: () => setShowFilterBuilder((s) => !s),
    onToggleColPicker: () => setShowColPicker((s) => !s),
    onOpenInsertModal: () => setShowInsertModal(true),
    onNavigateToForeignKey: navigateToForeignKey,
    onCommitAllChanges: () => void commitAllChanges(),
    onDiscardChanges: discardChanges,
    onSetPage: setPage,
    onClearAllFiltersAndSort: clearFiltersAndSort,
    onOpenInSql: () => {
      const qualified = table.schema ? `"${table.schema}"."${table.name}"` : `"${table.name}"`;
      openSqlTab({
        title: `${table.name}.sql`,
        sql: `SELECT *\nFROM ${qualified}\nLIMIT 100;\n`,
        connectionId: currentConnection.id,
      });
    },
    onExportCsv: () => void handleExport('csv'),
    onExportJson: () => void handleExport('json'),
    onToggleEditMode: () => {
      const nextMode = settings.editMode === 'staged' ? 'immediate' : 'staged';
      updateSettings({ editMode: nextMode });
      onShowToast(
        `Edit mode: ${nextMode === 'staged' ? 'Staged (Ctrl+S to save)' : 'Auto-Commit'}`,
        'info',
      );
    },
    onSetSelectedRowKeys: setSelectedRowKeys,
    onSort: handleSort,
    onToggleRowSelection: handleToggleRowSelection,
    onRequestRowDelete: requestRowDelete,
    onShowToast,
  });

  const visibleCount = useMemo(() => {
    return columnsList.filter((c) => columnVisibility[c.name] !== false).length;
  }, [columnsList, columnVisibility]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)] relative">
      <DataViewerHeader
        tableName={table.name}
        schema={table.schema}
        tableKind={details?.table.kind || table.kind}
        activeTab={activeSubTab}
        onSelectTab={(sub) => updateTab(tabId, { activeSubTab: sub })}
        totalRows={data?.totalRows}
        loading={loading}
        editable={Boolean(details?.editable)}
        readonlyReason={details?.readonlyReason}
        currentConnection={currentConnection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        showFilterBuilder={showFilterBuilder}
        onToggleFilterBuilder={() => setShowFilterBuilder((s) => !s)}
        activeFilterCount={appliedFilters.length}
        showColPicker={showColPicker}
        onToggleColPicker={() => setShowColPicker((s) => !s)}
        visibleColCount={visibleCount}
        totalColCount={columnsList.length}
        pendingChangeCount={pendingChangeCount}
        committingChanges={committingChanges}
        onCommitChanges={() => void commitAllChanges()}
        onDiscardChanges={discardChanges}
        selectedRowCount={selectedRowKeys.size}
        onInsertRow={() => setShowInsertModal(true)}
        onDeleteSelectedRows={handleDeleteSelectedRows}
        onRefresh={() => {
          void loadDetails();
          void loadData();
        }}
        onToggleInspector={() => {
          if (!inspectorOpen && selectedCell) {
            handleInspectRow(selectedCell.rowIdx, selectedCell.colName);
          } else {
            setInspectorOpen((s) => !s);
          }
        }}
        inspectorOpen={inspectorOpen}
        onExport={(fmt) => void handleExport(fmt)}
        onImport={(fmt) => {
          setPendingImportFormat(fmt);
          importFileInputRef.current?.click();
        }}
      />

      <input
        ref={importFileInputRef}
        type="file"
        accept={pendingImportFormat === 'json' ? '.json' : '.csv'}
        onChange={(e) => void handleImportFile(e)}
        className="hidden"
      />

      {showFilterBuilder && activeSubTab === 'data' && (
        <FilterBuilder
          columns={columnsList}
          rules={draftFilters}
          filterLogic={filterLogic}
          onChangeLogic={setFilterLogic}
          onAddRule={() =>
            setDraftFilters((p) => [
              ...p,
              {
                id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                column: columnsList[0]?.name || '',
                operator: 'contains',
                value: '',
              },
            ])
          }
          onUpdateRule={(id, patch) =>
            setDraftFilters((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)))
          }
          onRemoveRule={(id) => setDraftFilters((p) => p.filter((r) => r.id !== id))}
          onApply={() => {
            setAppliedFilters(draftFilters);
            setPage(0);
          }}
          onClearAll={() => {
            setDraftFilters([]);
            setAppliedFilters([]);
            setPage(0);
          }}
          onClose={() => setShowFilterBuilder(false)}
        />
      )}

      {showColPicker && activeSubTab === 'data' && (
        <ColumnVisibilityPicker
          columns={columnsList}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onToggleColumn={(col) =>
            setColumnVisibility((prev) => ({
              ...prev,
              [col]: prev[col] === false,
            }))
          }
          onSetAll={(visible) => {
            const next: ColumnVisibilityState = {};
            for (const c of columnsList) next[c.name] = visible;
            setColumnVisibility(next);
          }}
          onMoveColumn={(col, dir) => {
            setColumnOrder((prev) => {
              const base = prev.length > 0 ? [...prev] : columnsList.map((c) => c.name);
              const idx = base.indexOf(col);
              if (idx < 0) return base;
              const target = idx + dir;
              if (target < 0 || target >= base.length) return base;
              [base[idx], base[target]] = [base[target], base[idx]];
              return base;
            });
          }}
          onResetOrder={() => setColumnOrder(columnsList.map((c) => c.name))}
          onClose={() => setShowColPicker(false)}
        />
      )}

      {activeSubTab === 'data' && (
        <RecordsGrid
          data={data}
          columnMeta={columnsList}
          loading={loading}
          stripedRows={settings.gridStripedRows}
          showRowNumbers={settings.gridShowRowNumbers}
          nullDisplay={settings.nullDisplay}
          dateFormat={settings.dateFormat}
          editable={Boolean(details?.editable)}
          readOnlyConnection={currentConnection.readOnly}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(0);
          }}
          sortColumn={sortColumn}
          sortDesc={sortDesc}
          onSort={handleSort}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          selectedRowKeys={selectedRowKeys}
          onToggleRowSelection={handleToggleRowSelection}
          onSelectRowRange={handleSelectRowRange}
          onClearRowSelection={() => setSelectedRowKeys(new Set())}
          onToggleAllPageRows={(checked) => {
            if (!checked || !data) {
              setSelectedRowKeys(new Set());
            } else {
              setSelectedRowKeys(new Set(data.rows.map((_, i) => getRowKey(i))));
            }
          }}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
          openGoToCellSignal={goToCellSignal}
          outgoingFkMap={outgoingFkByCol}
          onJumpForeignKey={navigateToForeignKey}
          editingCell={editingCell}
          editValue={editValue}
          onStartEdit={(coord, val) => {
            setEditingCell(coord);
            setEditValue(val);
          }}
          onEditValueChange={setEditValue}
          onCommitEdit={handleCommitCellEdit}
          onCancelEdit={() => setEditingCell(null)}
          pendingCellUpdates={pendingCellUpdates}
          pendingDeletes={pendingDeletes}
          onInspectRow={handleInspectRow}
          onQuickFilter={(colName, operator, value) => {
            const rule: FilterRule = {
              id: `qf_${Date.now()}`,
              column: colName,
              operator,
              value,
            };
            setDraftFilters([rule]);
            setAppliedFilters([rule]);
            setShowFilterBuilder(true);
            setPage(0);
          }}
          onStageDeleteRow={(rowIdx) => {
            deleteOrStageRowKeys(new Set([getRowKey(rowIdx)]), true);
          }}
          onCopyToast={(msg) => onShowToast(msg, 'info')}
          getRowKey={getRowKey}
        />
      )}

      {activeSubTab === 'structure' && <StructureTab columns={columnsList} />}
      {activeSubTab === 'relations' && (
        <RelationsTab
          foreignKeys={details?.foreignKeys || []}
          onNavigateToTable={onNavigateToTable}
        />
      )}
      {activeSubTab === 'indexes' && (
        <IndexesTab
          tableName={table.name}
          schema={table.schema}
          engineKind={currentConnection.engineKind}
          indexes={details?.indexes || []}
          columns={columnsList}
          readOnly={
            currentConnection.readOnly ||
            (details?.table.kind !== 'table' && details?.table.kind !== 'partitioned_table')
          }
          onCreateIndex={async (payload) => {
            await createIndex({
              connectionId: currentConnection.id,
              table: table.name,
              schema: table.schema,
              ...payload,
            });
            onShowToast(`Index "${payload.indexName}" created`, 'success');
            await loadDetails();
          }}
          onDropIndex={(idxName) => {
            onRequestConfirm(
              'Drop Index',
              `Drop index "${idxName}"?`,
              `DROP INDEX "${idxName}";`,
              async () => {
                await dropIndex({
                  connectionId: currentConnection.id,
                  indexName: idxName,
                  schema: table.schema,
                });
                onShowToast(`Index "${idxName}" dropped`, 'success');
                await loadDetails();
              },
            );
          }}
        />
      )}
      {activeSubTab === 'constraints' && (
        <ConstraintsTab constraints={details?.constraints || []} />
      )}
      {activeSubTab === 'statistics' && details && (
        <StatisticsTab table={details.table} statistics={details.statistics} />
      )}
      {activeSubTab === 'ddl' && (
        <DdlTab
          tableName={table.name}
          schema={table.schema}
          ddl={details?.ddl || ''}
          onShowToast={onShowToast}
        />
      )}

      <InsertRowModal
        isOpen={showInsertModal}
        tableName={table.name}
        columns={columnsList}
        onClose={() => setShowInsertModal(false)}
        onSubmit={handleInsertRowSubmit}
      />
    </div>
  );
};
