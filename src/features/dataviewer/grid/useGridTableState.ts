import {
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatColumnTypeMeta } from '../../../services/columnTypeFormat';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { ColumnInfo, QueryResponse } from '../../../types/database';
import {
  type CellRange,
  type GridColumnHeaderSpec,
  type GridRowRecord,
  INDEX_GUTTER_WIDTH,
} from './gridTypes';

const GRID_FEATURES = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
});

const columnHelper = createColumnHelper<typeof GRID_FEATURES, GridRowRecord>();

interface UseGridTableStateParams {
  data: QueryResponse | null;
  columnMeta: ColumnInfo[];
  columnOrder: ColumnOrderState;
  columnVisibility: ColumnVisibilityState;
  pendingCellUpdates: Record<string, string | null>;
  getRowKey: (rowIdx: number) => string;
  onColumnOrderChange: (
    updater: ColumnOrderState | ((old: ColumnOrderState) => ColumnOrderState),
  ) => void;
  onColumnVisibilityChange: (
    updater: ColumnVisibilityState | ((old: ColumnVisibilityState) => ColumnVisibilityState),
  ) => void;
  onCopyToast: (msg: string) => void;
}

export function useGridTableState({
  data,
  columnMeta,
  columnOrder,
  columnVisibility,
  pendingCellUpdates,
  getRowKey,
  onColumnOrderChange,
  onColumnVisibilityChange,
  onCopyToast,
}: UseGridTableStateParams) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [pinnedCols, setPinnedCols] = useState<string[]>([]);
  const [collapseRepeats, setCollapseRepeats] = useState(false);
  const [cellRange, setCellRange] = useState<CellRange | null>(null);

  useEffect(() => {
    void data?.queryId;
    void data?.rows;
    setCellRange(null);
  }, [data?.queryId, data?.rows]);

  const displayCols = useMemo(() => {
    if (!data) return [];
    return data.columns.filter((c) => c !== '__quorix_rowid__');
  }, [data]);

  const colMetaMap = useMemo(() => {
    const map = new Map<string, ColumnInfo>();
    for (const c of columnMeta) map.set(c.name, c);
    return map;
  }, [columnMeta]);

  const colDistinctCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!data) return counts;
    displayCols.forEach((colName) => {
      const idx = data.columns.indexOf(colName);
      if (idx < 0) return;
      const distinct = new Set<string>();
      for (const row of data.rows) {
        const val = row[idx];
        if (val !== null) distinct.add(val);
      }
      counts.set(colName, distinct.size);
    });
    return counts;
  }, [data, displayCols]);

  const records = useMemo<GridRowRecord[]>(() => {
    if (!data) return [];
    const rowidIdx = data.columns.indexOf('__quorix_rowid__');
    return data.rows.map((row, rIdx) => {
      const rec: GridRowRecord = {
        __rowIndex: rIdx,
        __rowKey: getRowKey(rIdx),
        __rowid: rowidIdx >= 0 && row[rowidIdx] !== null ? Number(row[rowidIdx]) : undefined,
      };
      data.columns.forEach((col, cIdx) => {
        if (col !== '__quorix_rowid__') {
          rec[col] = row[cIdx] ?? null;
        }
      });
      return rec;
    });
  }, [data, getRowKey]);

  const columns = useMemo<ColumnDef<typeof GRID_FEATURES, GridRowRecord, unknown>[]>(() => {
    return displayCols.map((colName) => {
      const meta = colMetaMap.get(colName);
      const colIdx = data?.columns.indexOf(colName) ?? -1;
      const inferredType =
        meta?.dataType || (colIdx >= 0 ? data?.columnTypes?.[colIdx] : undefined) || 'text';
      const typeMeta = formatColumnTypeMeta(inferredType);

      let maxLen = Math.max(
        colName.length + (meta?.primaryKey ? 3 : 0),
        typeMeta.shortLabel.length + 4,
      );
      const sampleCount = Math.min(data?.rows.length ?? 0, 25);
      for (let r = 0; r < sampleCount; r++) {
        const v = colIdx >= 0 ? data?.rows[r]?.[colIdx] : null;
        if (v) maxLen = Math.max(maxLen, Math.min(34, v.length));
      }

      return columnHelper.accessor((row) => row[colName], {
        id: colName,
        header: colName,
        size: Math.min(320, Math.max(115, Math.round(maxLen * 7.6 + 38))),
        minSize: 80,
        maxSize: 640,
        meta: {
          primaryKey: meta?.primaryKey ?? false,
          dataType: inferredType,
        },
      });
    });
  }, [displayCols, colMetaMap, data]);

  const table = useTable({
    features: GRID_FEATURES,
    data: records,
    columns,
    state: {
      columnSizing,
      columnOrder,
      columnVisibility,
    },
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange,
    onColumnVisibilityChange,
    columnResizeMode: 'onChange',
  });

  const gridFontSize = useSettingsStore((s) => s.settings.gridFontSize);
  const tableRows = table.getRowModel().rows;
  const rowHeight = Math.max(32, Math.ceil((gridFontSize || 12.5) * 2.15));
  const rawVisibleHeaders = table.getHeaderGroups()[0]?.headers ?? [];

  const { orderedHeaderSpecs, pinnedLeftOffsets, lastPinnedColId } = useMemo(() => {
    const pinnedSet = new Set(pinnedCols);
    const pinned = rawVisibleHeaders.filter((h) => pinnedSet.has(h.column.id));
    const unpinned = rawVisibleHeaders.filter((h) => !pinnedSet.has(h.column.id));
    const ordered = [...pinned, ...unpinned];
    const offsets = new Map<string, number>();
    let acc = INDEX_GUTTER_WIDTH;
    for (const h of pinned) {
      offsets.set(h.column.id, acc);
      acc += h.getSize();
    }
    const specs: GridColumnHeaderSpec[] = ordered.map((h) => ({
      id: h.id,
      colName: h.column.id,
      size: h.getSize(),
      resizeHandler: (
        h as unknown as {
          getResizeHandler?: () => (event: unknown) => void;
        }
      ).getResizeHandler?.(),
    }));
    return {
      orderedHeaderSpecs: specs,
      pinnedLeftOffsets: offsets,
      lastPinnedColId: pinned[pinned.length - 1]?.column.id ?? null,
    };
  }, [rawVisibleHeaders, pinnedCols]);

  const visibleColIds = useMemo(
    () => orderedHeaderSpecs.map((h) => h.colName),
    [orderedHeaderSpecs],
  );
  const visibleColIndexMap = useMemo(
    () => new Map(visibleColIds.map((id, idx) => [id, idx])),
    [visibleColIds],
  );

  const normalizedRange = useMemo(() => {
    if (!cellRange) return null;
    const c1 = visibleColIndexMap.get(cellRange.start.colName);
    const c2 = visibleColIndexMap.get(cellRange.end.colName);
    if (c1 === undefined || c2 === undefined) return null;
    const minRow = Math.max(0, Math.min(cellRange.start.rowIdx, cellRange.end.rowIdx));
    const maxRow = Math.min(
      records.length - 1,
      Math.max(cellRange.start.rowIdx, cellRange.end.rowIdx),
    );
    const minColIdx = Math.min(c1, c2);
    const maxColIdx = Math.max(c1, c2);
    const isMultiCell = maxRow > minRow || maxColIdx > minColIdx;
    return { minRow, maxRow, minColIdx, maxColIdx, isMultiCell };
  }, [cellRange, visibleColIndexMap, records.length]);

  const totalColsWidth = orderedHeaderSpecs.reduce((acc, h) => acc + h.size, 0);

  const getCellDisplayValue = useCallback(
    (rowIdx: number, colName: string): string | null => {
      if (!data) return null;
      const rowKey = getRowKey(rowIdx);
      const pendingKey = `${rowKey}::${colName}`;
      if (pendingKey in pendingCellUpdates) return pendingCellUpdates[pendingKey];
      const colIdx = data.columns.indexOf(colName);
      return colIdx >= 0 ? (data.rows[rowIdx]?.[colIdx] ?? null) : null;
    },
    [data, getRowKey, pendingCellUpdates],
  );

  const copySelectedRangeTsv = () => {
    if (!normalizedRange || !data) return;
    const lines: string[] = [];
    for (let r = normalizedRange.minRow; r <= normalizedRange.maxRow; r++) {
      const cells: string[] = [];
      for (let c = normalizedRange.minColIdx; c <= normalizedRange.maxColIdx; c++) {
        const colName = visibleColIds[c];
        const v = colName ? getCellDisplayValue(r, colName) : null;
        cells.push(v ?? '');
      }
      lines.push(cells.join('\t'));
    }
    const rowSpan = normalizedRange.maxRow - normalizedRange.minRow + 1;
    const colSpan = normalizedRange.maxColIdx - normalizedRange.minColIdx + 1;
    void navigator.clipboard.writeText(lines.join('\n'));
    onCopyToast(`Copied ${rowSpan}×${colSpan} cells`);
  };

  const autoFitColumn = (colName: string) => {
    const meta = colMetaMap.get(colName);
    const colIdx = data?.columns.indexOf(colName) ?? -1;
    const rawType =
      meta?.dataType || (colIdx >= 0 ? data?.columnTypes?.[colIdx] : undefined) || 'text';
    const typeMeta = formatColumnTypeMeta(rawType);
    let maxLen = Math.max(colName.length + 5, typeMeta.shortLabel.length + 6);
    if (data && colIdx >= 0) {
      for (const row of data.rows) {
        const val = row[colIdx];
        if (val) maxLen = Math.max(maxLen, Math.min(62, val.length));
      }
    }
    const targetWidth = Math.min(520, Math.max(104, Math.round(maxLen * 7.8 + 40)));
    setColumnSizing((prev) => ({ ...prev, [colName]: targetWidth }));
  };

  const togglePinColumn = (colName: string) => {
    setPinnedCols((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName],
    );
  };

  const moveColumnBy = (colName: string, dir: -1 | 1) => {
    onColumnOrderChange((prev) => {
      const base = prev.length > 0 ? [...prev] : [...displayCols];
      const idx = base.indexOf(colName);
      if (idx < 0) return base;
      const target = idx + dir;
      if (target < 0 || target >= base.length) return base;
      [base[idx], base[target]] = [base[target], base[idx]];
      return base;
    });
  };

  const resetGridLayout = () => {
    setColumnSizing({});
    setPinnedCols([]);
    setCollapseRepeats(false);
    const allVisible: ColumnVisibilityState = {};
    for (const col of displayCols) allVisible[col] = true;
    onColumnVisibilityChange(allVisible);
    onColumnOrderChange([...displayCols]);
  };

  const hasCustomLayout =
    Object.keys(columnSizing).length > 0 ||
    pinnedCols.length > 0 ||
    Object.values(columnVisibility).some((v) => v === false) ||
    collapseRepeats;

  return {
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
  };
}
