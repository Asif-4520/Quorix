import type { TabItem, ThemeMode, ThemeName } from '../../types/database';
import { STORAGE_KEYS } from './storageKeys';

export interface AppSettings {
  themeMode: ThemeMode;
  theme: ThemeName;
  darkTheme: ThemeName;
  lightTheme: ThemeName;
  globalFontSize: number;
  syncFontSizes: boolean;
  uiFontSize: number;
  uiFontFamily: string;
  uiRadius: 'sharp' | 'balanced' | 'soft';
  toolRailVisible: boolean;
  statusBarVisible: boolean;
  editorFontFamily: string;
  editorFontSize: number;
  editorLineHeight: number;
  editorLineNumbers: boolean;
  editorTabSize: number;
  editorWordWrap: boolean;
  editorAutocomplete: boolean;
  connectionTimeout: number;
  queryTimeout: number;
  maxResultRows: number;
  pgbouncerDefault: boolean;
  defaultPageSize: number;
  gridFontSize: number;
  gridFontFamily: 'mono' | 'sans';
  gridStripedRows: boolean;
  gridShowRowNumbers: boolean;
  nullDisplay: 'NULL' | 'null' | '—';
  dateFormat: 'iso' | 'local' | 'relative';
  editMode: 'staged' | 'immediate';
  restoreWorkspace: boolean;
  reuseExistingTableTab: boolean;
  confirmDropTable: boolean;
  confirmTruncateTable: boolean;
  confirmDeleteRow: boolean;
  explainAnalyze: boolean;
  confirmUnfilteredWrites: boolean;
  recordFailedHistory: boolean;
  historyRetentionLimit: number;
  lazyLoadExplorer: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'dark',
  theme: 'obsidian-dark',
  darkTheme: 'obsidian-dark',
  lightTheme: 'pearl-light',
  globalFontSize: 13,
  syncFontSizes: true,
  uiFontSize: 13,
  uiFontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
  uiRadius: 'balanced',
  toolRailVisible: true,
  statusBarVisible: true,
  editorFontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  editorFontSize: 13,
  editorLineHeight: 1.6,
  editorLineNumbers: true,
  editorTabSize: 2,
  editorWordWrap: true,
  editorAutocomplete: true,
  connectionTimeout: 10,
  queryTimeout: 30,
  maxResultRows: 5000,
  pgbouncerDefault: false,
  defaultPageSize: 50,
  gridFontSize: 12.5,
  gridFontFamily: 'mono',
  gridStripedRows: true,
  gridShowRowNumbers: true,
  nullDisplay: 'NULL',
  dateFormat: 'iso',
  editMode: 'staged',
  restoreWorkspace: true,
  reuseExistingTableTab: true,
  confirmDropTable: true,
  confirmTruncateTable: true,
  confirmDeleteRow: true,
  explainAnalyze: true,
  confirmUnfilteredWrites: true,
  recordFailedHistory: true,
  historyRetentionLimit: 250,
  lazyLoadExplorer: true,
};

export interface WorkspaceSession {
  tabs: TabItem[];
  activeTabId: string;
  sidebarOpen: boolean;
  sidebarWidth: number;
  inspectorOpen: boolean;
  inspectorWidth: number;
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...patch };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  return updated;
}

export function getWorkspaceSession(): WorkspaceSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKSPACE_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveWorkspaceSession(session: WorkspaceSession): void {
  try {
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_SESSION, JSON.stringify(session));
  } catch {}
}

export function getErNodePositions(key: string): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ER_POSITIONS);
    const all: Record<string, Record<string, { x: number; y: number }>> = raw
      ? JSON.parse(raw)
      : {};
    return all[key] || {};
  } catch {
    return {};
  }
}

export function saveErNodePositions(
  key: string,
  positions: Record<string, { x: number; y: number }>,
): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ER_POSITIONS);
    const all: Record<string, Record<string, { x: number; y: number }>> = raw
      ? JSON.parse(raw)
      : {};
    all[key] = positions;
    localStorage.setItem(STORAGE_KEYS.ER_POSITIONS, JSON.stringify(all));
  } catch {}
}
