import { GRID_AND_TABLE_SHORTCUTS } from './editorGridShortcuts';
import { NAVIGATION_AND_GLOBAL_SHORTCUTS } from './navigationShortcuts';
import type { ShortcutItem } from './shortcutTypes';

export type { ShortcutItem, ShortcutScope } from './shortcutTypes';

export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  ...NAVIGATION_AND_GLOBAL_SHORTCUTS,
  ...GRID_AND_TABLE_SHORTCUTS,
];
