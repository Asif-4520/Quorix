import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke, isTauri } from './client';

export interface SaveExportResult {
  saved: boolean;
  cancelled?: boolean;
  path?: string;
  inBrowserDownloads?: boolean;
}

export async function selectSqliteFile(): Promise<string | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'SQLite Database',
          extensions: ['db', 'sqlite', 'sqlite3', 'db3'],
        },
        {
          name: 'All Files',
          extensions: ['*'],
        },
      ],
    });
    return typeof selected === 'string' ? selected : null;
  } catch (error) {
    console.error('File dialog error:', error);
    return null;
  }
}

export async function createSqliteFileDialog(): Promise<string | null> {
  try {
    const selected = await save({
      filters: [
        {
          name: 'SQLite Database',
          extensions: ['db', 'sqlite', 'sqlite3', 'db3'],
        },
      ],
      defaultPath: 'database.sqlite',
    });
    return selected;
  } catch (error) {
    console.error('Save dialog error:', error);
    return null;
  }
}

export async function selectExportPathDialog(
  defaultFileName: string,
  format: 'csv' | 'json' | 'svg' | 'png' | 'sql',
): Promise<string | null> {
  try {
    const selected = await save({
      defaultPath: defaultFileName,
      filters: [
        {
          name: format.toUpperCase(),
          extensions: [format],
        },
      ],
    });
    return selected;
  } catch {
    return null;
  }
}

export async function promptSaveTextFile(
  defaultFileName: string,
  format: 'csv' | 'json' | 'svg' | 'sql',
  content: string,
): Promise<SaveExportResult> {
  if (isTauri()) {
    const chosenPath = await selectExportPathDialog(defaultFileName, format);
    if (!chosenPath) {
      return { saved: false, cancelled: true };
    }
    await invoke<string>('save_text_file', { path: chosenPath, content });
    return { saved: true, path: chosenPath };
  }

  const mimeMap: Record<string, string> = {
    csv: 'text/csv',
    json: 'application/json',
    svg: 'image/svg+xml;charset=utf-8',
    sql: 'text/plain;charset=utf-8',
  };
  const blob = new Blob([content], { type: mimeMap[format] || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFileName;
  a.click();
  URL.revokeObjectURL(url);
  return { saved: true, path: defaultFileName, inBrowserDownloads: true };
}

export async function promptSaveBinaryFile(
  defaultFileName: string,
  format: 'png',
  bytes: Uint8Array,
): Promise<SaveExportResult> {
  if (isTauri()) {
    const chosenPath = await selectExportPathDialog(defaultFileName, format);
    if (!chosenPath) {
      return { saved: false, cancelled: true };
    }
    await invoke<string>('save_binary_file', {
      path: chosenPath,
      bytes: Array.from(bytes),
    });
    return { saved: true, path: chosenPath };
  }

  const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFileName;
  a.click();
  URL.revokeObjectURL(url);
  return { saved: true, path: defaultFileName, inBrowserDownloads: true };
}
