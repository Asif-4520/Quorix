import { type AppSettings, DEFAULT_SETTINGS } from '../../services/storage';
import type { SettingsTabId } from './settingsConfig';

export const TAB_METADATA: Record<
  SettingsTabId,
  {
    description: string;
    keys: ReadonlyArray<keyof AppSettings>;
  }
> = {
  appearance: {
    description: 'Themes, light/dark polarity, global typography, and interface chrome',
    keys: [
      'themeMode',
      'theme',
      'darkTheme',
      'lightTheme',
      'globalFontSize',
      'syncFontSizes',
      'uiFontSize',
      'uiFontFamily',
      'uiRadius',
      'toolRailVisible',
      'statusBarVisible',
    ],
  },
  editor: {
    description: 'SQL query typography, spacing, indentation, wrap, and autocomplete',
    keys: [
      'editorFontFamily',
      'editorFontSize',
      'editorLineHeight',
      'editorTabSize',
      'editorLineNumbers',
      'editorWordWrap',
      'editorAutocomplete',
    ],
  },
  grid: {
    description: 'Table page size, cell formatting, NULL display, and row edit behavior',
    keys: [
      'defaultPageSize',
      'gridFontSize',
      'gridFontFamily',
      'gridStripedRows',
      'gridShowRowNumbers',
      'nullDisplay',
      'dateFormat',
      'editMode',
    ],
  },
  database: {
    description: 'Connection timeouts, query timeouts, and PostgreSQL pooling defaults',
    keys: ['connectionTimeout', 'queryTimeout', 'pgbouncerDefault'],
  },
  workspace: {
    description: 'Session restoration and tab navigation behavior on startup',
    keys: ['restoreWorkspace', 'reuseExistingTableTab'],
  },
  performance: {
    description: 'Query row caps, lazy explorer loading, and history retention',
    keys: ['maxResultRows', 'historyRetentionLimit', 'lazyLoadExplorer'],
  },
  security: {
    description: 'Encrypted credential vault status and destructive SQL safety guards',
    keys: ['confirmDropTable', 'confirmTruncateTable', 'confirmDeleteRow'],
  },
  advanced: {
    description: 'Query execution, EXPLAIN behavior, workspace cache, and factory reset',
    keys: ['explainAnalyze', 'confirmUnfilteredWrites', 'recordFailedHistory'],
  },
  about: {
    description: 'Quorix desktop version, creator profile, supported engines, and project links',
    keys: [],
  },
};

export const ALL_SETTING_KEYS: ReadonlyArray<keyof AppSettings> = Object.values(
  TAB_METADATA,
).flatMap((meta) => meta.keys);

export function hasAnyModifiedKey(
  settings: AppSettings,
  keys: ReadonlyArray<keyof AppSettings>,
): boolean {
  return keys.some((key) => settings[key] !== DEFAULT_SETTINGS[key]);
}

export function getModifiedSettingsCount(settings: AppSettings): number {
  return ALL_SETTING_KEYS.filter((key) => settings[key] !== DEFAULT_SETTINGS[key]).length;
}

export function getModifiedPatchForTab(tab: SettingsTabId): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {};
  for (const key of TAB_METADATA[tab].keys) {
    (patch as Record<string, unknown>)[key] = DEFAULT_SETTINGS[key];
  }
  return patch;
}
