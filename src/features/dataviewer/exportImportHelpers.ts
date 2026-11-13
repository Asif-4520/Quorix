import { exportData, importData, isTauri, selectExportPathDialog } from '../../services/tauri';
import type { FilterRule } from '../../types/database';

export interface ExportTableParams {
  connectionId: string;
  tableName: string;
  schema?: string;
  format: 'csv' | 'json';
  searchQuery: string;
  appliedFilters: FilterRule[];
  filterLogic: 'and' | 'or';
  sortColumn: string | null;
  sortDesc: boolean;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export async function exportTableData({
  connectionId,
  tableName,
  schema,
  format,
  searchQuery,
  appliedFilters,
  filterLogic,
  sortColumn,
  sortDesc,
  onShowToast,
}: ExportTableParams): Promise<void> {
  try {
    const defaultName = `${tableName}.${format}`;
    let chosenPath: string | null = null;
    if (isTauri()) {
      chosenPath = await selectExportPathDialog(defaultName, format);
      if (!chosenPath) {
        return;
      }
    }

    const res = await exportData({
      connectionId,
      table: tableName,
      schema,
      format,
      outputPath: chosenPath || undefined,
      searchQuery: searchQuery || undefined,
      filters: appliedFilters.map(({ column, operator, value, value2 }) => ({
        column: column || undefined,
        operator,
        value,
        value2,
      })),
      filterLogic,
      sortColumn: sortColumn || undefined,
      sortDesc,
    });

    if (res.savedPath) {
      onShowToast(`Exported ${res.rowCount} rows to ${res.savedPath}`, 'success');
    } else {
      const blob = new Blob([res.content], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast(
        `Saved ${defaultName} (${res.rowCount} rows) to your browser Downloads folder`,
        'success',
      );
    }
  } catch (err) {
    onShowToast(`Export failed: ${err}`, 'error');
  }
}

export async function importFileToTable(params: {
  file: File;
  connectionId: string;
  tableName: string;
  schema?: string;
  format: 'csv' | 'json';
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onReload: () => Promise<void>;
}): Promise<void> {
  const { file, connectionId, tableName, schema, format, onShowToast, onReload } = params;
  try {
    const content = await file.text();
    const res = await importData({
      connectionId,
      table: tableName,
      schema,
      format,
      content,
    });
    onShowToast(`Imported ${res.importedRows} rows in ${res.durationMs} ms`, 'success');
    await onReload();
  } catch (err) {
    onShowToast(`Import failed: ${err}`, 'error');
  }
}

export function buildRowJsonClipboardText(columns: string[], row: Array<string | null>): string {
  const obj: Record<string, string | null> = {};
  columns.forEach((c, idx) => {
    if (c !== '__quorix_rowid__') {
      obj[c] = row[idx] ?? null;
    }
  });
  return JSON.stringify(obj, null, 2);
}

export function buildRowCsvClipboardText(columns: string[], row: Array<string | null>): string {
  return columns
    .filter((c) => c !== '__quorix_rowid__')
    .map((c) => {
      const idx = columns.indexOf(c);
      const v = idx >= 0 ? (row[idx] ?? null) : null;
      if (v === null) return '';
      return v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    })
    .join(',');
}
