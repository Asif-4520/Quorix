import { useCallback, useEffect, useState } from 'react';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import type { AppSettings } from '../../services/storage';
import { applyTableChanges } from '../../services/tauri';
import type {
  ConnectionSummary,
  QueryResponse,
  TableDetailsResponse,
  TableInfo,
  TableMutationItem,
} from '../../types/database';
import type { CellCoord } from './grid/RecordsGrid';

interface UseTableMutationsParams {
  tabId: string;
  table: TableInfo;
  currentConnection: ConnectionSummary;
  settings: AppSettings;
  data: QueryResponse | null;
  details: TableDetailsResponse | null;
  page: number;
  selectedRowKeys: Set<string>;
  onSetSelectedRowKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  onUpdateTabDirty: (tabId: string, isDirty: boolean) => void;
  onReloadData: () => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRequestConfirm: (
    title: string,
    message: string,
    sql: string | undefined,
    onConfirm: () => Promise<void> | void,
  ) => void;
}

export function useTableMutations({
  tabId,
  table,
  currentConnection,
  settings,
  data,
  details,
  page,
  selectedRowKeys,
  onSetSelectedRowKeys,
  onUpdateTabDirty,
  onReloadData,
  onShowToast,
  onRequestConfirm,
}: UseTableMutationsParams) {
  const [editingCell, setEditingCell] = useState<CellCoord | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingCellUpdates, setPendingCellUpdates] = useState<Record<string, string | null>>({});
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [pendingInserts, setPendingInserts] = useState<Array<Record<string, string | null>>>([]);
  const [committingChanges, setCommittingChanges] = useState(false);

  const getRowKey = useCallback(
    (rowIdx: number): string => {
      if (!data) return String(rowIdx);
      if (data.usesRowid) {
        const ridIdx = data.columns.indexOf('__quorix_rowid__');
        if (ridIdx >= 0) return `rowid:${data.rows[rowIdx]?.[ridIdx]}`;
      }
      const pks = details?.primaryKeyColumns || [];
      if (pks.length > 0) {
        return pks
          .map((pk) => {
            const cIdx = data.columns.indexOf(pk);
            return `${pk}=${data.rows[rowIdx]?.[cIdx] ?? 'NULL'}`;
          })
          .join('|');
      }
      return `idx:${page}:${rowIdx}`;
    },
    [data, details?.primaryKeyColumns, page],
  );

  const buildPkOrRowidForRow = useCallback(
    (
      rowIdx: number,
    ): {
      primaryKey?: Record<string, string | null>;
      rowid?: number;
    } => {
      if (!data) return {};
      if (data.usesRowid) {
        const ridIdx = data.columns.indexOf('__quorix_rowid__');
        const raw = ridIdx >= 0 ? data.rows[rowIdx]?.[ridIdx] : null;
        return raw ? { rowid: Number(raw) } : {};
      }
      const pks = details?.primaryKeyColumns || [];
      const pkObj: Record<string, string | null> = {};
      for (const pk of pks) {
        const idx = data.columns.indexOf(pk);
        if (idx >= 0) {
          pkObj[pk] = data.rows[rowIdx]?.[idx] ?? null;
        }
      }
      return { primaryKey: pkObj };
    },
    [data, details?.primaryKeyColumns],
  );

  const pendingChangeCount =
    Object.keys(pendingCellUpdates).length + pendingDeletes.size + pendingInserts.length;

  useEffect(() => {
    onUpdateTabDirty(tabId, pendingChangeCount > 0);
  }, [tabId, pendingChangeCount, onUpdateTabDirty]);

  const discardChanges = useCallback(() => {
    setPendingCellUpdates({});
    setPendingDeletes(new Set());
    setPendingInserts([]);
  }, []);

  const buildDeletePreviewSql = useCallback(
    (rowKeysToDelete: Set<string>): string | undefined => {
      if (!data || rowKeysToDelete.size === 0) return undefined;
      const qual = table.schema ? `"${table.schema}"."${table.name}"` : `"${table.name}"`;
      const statements: string[] = [];
      for (const rk of rowKeysToDelete) {
        if (statements.length >= 5) break;
        const rIdx = data.rows.findIndex((_, i) => getRowKey(i) === rk);
        if (rIdx < 0) continue;
        const idPart = buildPkOrRowidForRow(rIdx);
        if (idPart.rowid !== undefined) {
          statements.push(`DELETE FROM ${qual} WHERE rowid = ${idPart.rowid};`);
        } else if (idPart.primaryKey && Object.keys(idPart.primaryKey).length > 0) {
          const cond = Object.entries(idPart.primaryKey)
            .map(([col, val]) =>
              val === null ? `"${col}" IS NULL` : `"${col}" = '${val.replace(/'/g, "''")}'`,
            )
            .join(' AND ');
          statements.push(`DELETE FROM ${qual} WHERE ${cond};`);
        }
      }
      if (rowKeysToDelete.size > 5) {
        statements.push(`-- ... and ${rowKeysToDelete.size - 5} more row(s)`);
      }
      return statements.length > 0 ? statements.join('\n') : undefined;
    },
    [buildPkOrRowidForRow, data, getRowKey, table.name, table.schema],
  );

  const commitAllChanges = useCallback(async () => {
    if (!data || pendingChangeCount === 0) return;

    const runCommit = async () => {
      setCommittingChanges(true);
      try {
        const mutations: TableMutationItem[] = [];

        for (const [key, newVal] of Object.entries(pendingCellUpdates)) {
          const sep = key.lastIndexOf('::');
          const rowKey = key.slice(0, sep);
          const colName = key.slice(sep + 2);
          if (pendingDeletes.has(rowKey)) continue;
          const rowIdx = data.rows.findIndex((_, i) => getRowKey(i) === rowKey);
          if (rowIdx < 0) continue;
          const idPart = buildPkOrRowidForRow(rowIdx);
          mutations.push({
            operation: 'update',
            ...idPart,
            column: colName,
            value: newVal,
          });
        }

        for (const rowKey of pendingDeletes) {
          const rowIdx = data.rows.findIndex((_, i) => getRowKey(i) === rowKey);
          if (rowIdx < 0) continue;
          const idPart = buildPkOrRowidForRow(rowIdx);
          mutations.push({
            operation: 'delete',
            ...idPart,
          });
        }

        for (const row of pendingInserts) {
          mutations.push({
            operation: 'insert',
            row,
          });
        }

        if (mutations.length === 0) return;

        const affected = await applyTableChanges({
          connectionId: currentConnection.id,
          table: table.name,
          schema: table.schema,
          mutations,
        });

        setPendingCellUpdates({});
        setPendingDeletes(new Set());
        setPendingInserts([]);
        onShowToast(`Committed ${affected} change(s) in transaction`, 'success');
        await onReloadData();
      } catch (err) {
        onShowToast(`Commit failed (rolled back): ${err}`, 'error');
      } finally {
        setCommittingChanges(false);
      }
    };

    if (pendingDeletes.size > 0 && settings.confirmDeleteRow) {
      const prefix =
        currentConnection.environment === 'production'
          ? `[PRODUCTION: ${currentConnection.name}] `
          : '';
      onRequestConfirm(
        'Commit Staged Deletions',
        `${prefix}Commit ${pendingDeletes.size} staged deletion(s) (along with ${pendingCellUpdates ? Object.keys(pendingCellUpdates).length : 0} update(s) and ${pendingInserts.length} insert(s)) to "${table.name}"?`,
        buildDeletePreviewSql(pendingDeletes),
        runCommit,
      );
      return;
    }

    await runCommit();
  }, [
    data,
    pendingChangeCount,
    pendingCellUpdates,
    pendingDeletes,
    pendingInserts,
    getRowKey,
    buildPkOrRowidForRow,
    buildDeletePreviewSql,
    currentConnection.id,
    currentConnection.name,
    currentConnection.environment,
    settings.confirmDeleteRow,
    table.name,
    table.schema,
    onRequestConfirm,
    onShowToast,
    onReloadData,
  ]);

  const handleCommitCellEdit = useCallback(
    async (coord: CellCoord, newValue: string | null) => {
      setEditingCell(null);
      if (!data) return;
      const colIdx = data.columns.indexOf(coord.colName);
      if (colIdx < 0) return;
      const currentVal = data.rows[coord.rowIdx]?.[colIdx] ?? null;
      const rowKey = getRowKey(coord.rowIdx);
      const pendingKey = `${rowKey}::${coord.colName}`;
      const existingPending =
        pendingKey in pendingCellUpdates ? pendingCellUpdates[pendingKey] : currentVal;
      if (existingPending === newValue) return;

      if (settings.editMode === 'immediate') {
        try {
          const idPart = buildPkOrRowidForRow(coord.rowIdx);
          await applyTableChanges({
            connectionId: currentConnection.id,
            table: table.name,
            schema: table.schema,
            mutations: [
              {
                operation: 'update',
                ...idPart,
                column: coord.colName,
                value: newValue,
              },
            ],
          });
          onShowToast(`Updated "${coord.colName}"`, 'success');
          await onReloadData();
        } catch (err) {
          onShowToast(`Update failed: ${err}`, 'error');
        }
      } else {
        setPendingCellUpdates((prev) => ({
          ...prev,
          [pendingKey]: newValue,
        }));
      }
    },
    [
      data,
      getRowKey,
      pendingCellUpdates,
      settings.editMode,
      buildPkOrRowidForRow,
      currentConnection.id,
      table.name,
      table.schema,
      onShowToast,
      onReloadData,
    ],
  );

  const executeImmediateDeletes = async (rowKeysToDelete: Set<string>) => {
    if (rowKeysToDelete.size === 0 || !data) return;
    const mutations: TableMutationItem[] = [];
    for (const rk of rowKeysToDelete) {
      const rIdx = data.rows.findIndex((_, i) => getRowKey(i) === rk);
      if (rIdx >= 0) {
        mutations.push({ operation: 'delete', ...buildPkOrRowidForRow(rIdx) });
      }
    }
    if (mutations.length === 0) return;
    try {
      await applyTableChanges({
        connectionId: currentConnection.id,
        table: table.name,
        schema: table.schema,
        mutations,
      });
      onSetSelectedRowKeys((prev) => {
        const next = new Set(prev);
        for (const rk of rowKeysToDelete) next.delete(rk);
        return next;
      });
      setPendingDeletes((prev) => {
        const next = new Set(prev);
        for (const rk of rowKeysToDelete) next.delete(rk);
        return next;
      });
      setPendingCellUpdates((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          const rk = key.split('::')[0];
          if (rowKeysToDelete.has(rk)) delete next[key];
        }
        return next;
      });
      onShowToast(`Deleted ${mutations.length} row(s) from "${table.name}"`, 'success');
      await onReloadData();
    } catch (err) {
      onShowToast(`Delete failed: ${err}`, 'error');
    }
  };

  const requestRowDelete = (rowKeysToDelete: Set<string>, options: { skipConfirm: boolean }) => {
    if (rowKeysToDelete.size === 0 || !data) return;
    const isProd = currentConnection.environment === 'production';
    const bypassAllowed = options.skipConfirm && !isProd;
    if (bypassAllowed || !settings.confirmDeleteRow) {
      void executeImmediateDeletes(rowKeysToDelete);
      return;
    }

    const prefix = isProd ? `[PRODUCTION: ${currentConnection.name}] ` : '';
    onRequestConfirm(
      rowKeysToDelete.size === 1 ? 'Delete Row' : 'Delete Selected Rows',
      rowKeysToDelete.size === 1
        ? `${prefix}Permanently delete this selected row from "${table.name}"?`
        : `${prefix}Permanently delete ${rowKeysToDelete.size} selected rows from "${table.name}"?`,
      buildDeletePreviewSql(rowKeysToDelete),
      () => executeImmediateDeletes(rowKeysToDelete),
    );
  };

  const deleteOrStageRowKeys = (rowKeys: Set<string>, toggleSingleInStaged = false) => {
    if (rowKeys.size === 0 || !data) return;
    if (settings.editMode === 'staged') {
      setPendingDeletes((prev) => {
        const next = new Set(prev);
        for (const k of rowKeys) {
          if (toggleSingleInStaged && rowKeys.size === 1 && next.has(k)) {
            next.delete(k);
          } else {
            next.add(k);
          }
        }
        return next;
      });
      onShowToast(
        `Staged ${rowKeys.size} row(s) for deletion (${formatShortcutForDisplay(getEffectiveShortcut('save-action'))} to commit)`,
        'info',
      );
      return;
    }

    requestRowDelete(rowKeys, { skipConfirm: false });
  };

  const handleDeleteSelectedRows = () => {
    requestRowDelete(selectedRowKeys, { skipConfirm: false });
  };

  const handleInsertRowSubmit = async (row: Record<string, string | null>) => {
    if (settings.editMode === 'staged') {
      setPendingInserts((p) => [...p, row]);
      onShowToast('Staged new row (Commit to save)', 'info');
    } else {
      await applyTableChanges({
        connectionId: currentConnection.id,
        table: table.name,
        schema: table.schema,
        mutations: [{ operation: 'insert', row }],
      });
      onShowToast('Row inserted', 'success');
      await onReloadData();
    }
  };

  return {
    editingCell,
    setEditingCell,
    editValue,
    setEditValue,
    pendingCellUpdates,
    pendingDeletes,
    pendingInserts,
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
  };
}
