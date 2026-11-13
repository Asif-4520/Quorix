import type React from 'react';
import type {
  SavedConnection,
  SavedQuery,
  SchemaIntrospection,
  TableInfo,
  ThemeMode,
  ThemeName,
} from '../../types/database';

export type PaletteScope = 'all' | 'commands' | 'objects' | 'fields' | 'saved';

export type ItemScope = Exclude<PaletteScope, 'all'>;

export interface PaletteItem {
  id: string;
  scope: ItemScope;
  category: string;
  title: string;
  subtitle: string;
  keywords?: string;
  shortcutId?: string;
  priority: number;
  actionLabel: string;
  icon: React.ReactNode;
  disabled?: boolean;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  isSqlActive: boolean;
  schema: SchemaIntrospection | null;
  savedQueries?: SavedQuery[];
  savedConnections?: SavedConnection[];
  initialScope?: PaletteScope;
  onOpenConnections: () => void;
  onDisconnect: () => void;
  onNewSqlTab: () => void;
  onOpenTable: (table: TableInfo) => void;
  onOpenSchema?: (schemaName: string) => void;
  onOpenSavedQuery?: (query: SavedQuery) => void;
  onSelectSavedConnection?: (conn: SavedConnection) => void;
  onOpenErDiagram: () => void;
  onOpenSchemaDiff?: () => void;
  onRefreshSchema: () => void;
  onExecuteQuery: () => void;
  onExecuteAll?: () => void;
  onExplainQuery?: () => void;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onOpenCreateTable: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenShortcuts?: () => void;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSetThemePreset: (theme: ThemeName) => void;
  onReopenClosedTab: () => void;
  onCloseActiveTab: () => void;
}

export const SCOPE_TABS: Array<{ id: PaletteScope; label: string; prefix?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'commands', label: 'Commands', prefix: '>' },
  { id: 'objects', label: 'Tables & Views', prefix: '#' },
  { id: 'fields', label: 'Columns & Functions', prefix: '@' },
  { id: 'saved', label: 'Queries & DBs', prefix: '$' },
];

const PREFIX_TO_SCOPE: Record<string, ItemScope> = {
  '>': 'commands',
  '#': 'objects',
  '@': 'fields',
  $: 'saved',
};

export function parsePaletteQuery(raw: string): { prefixScope: ItemScope | null; term: string } {
  const trimmedLeft = raw.trimStart();
  const first = trimmedLeft[0];
  if (first && first in PREFIX_TO_SCOPE) {
    return {
      prefixScope: PREFIX_TO_SCOPE[first],
      term: trimmedLeft.slice(1).trim().toLowerCase(),
    };
  }
  return {
    prefixScope: null,
    term: trimmedLeft.trim().toLowerCase(),
  };
}

export function scorePaletteItem(item: PaletteItem, tokens: string[]): number {
  const titleLower = item.title.toLowerCase();
  const haystack = `${titleLower} ${item.category.toLowerCase()} ${item.subtitle.toLowerCase()} ${
    item.keywords ? item.keywords.toLowerCase() : ''
  }`;

  for (const token of tokens) {
    if (!haystack.includes(token)) return -1;
  }

  let score = item.priority * 5;
  const fullQuery = tokens.join(' ');
  if (titleLower === fullQuery) score += 140;
  else if (titleLower.startsWith(fullQuery)) score += 90;
  else if (tokens.every((t) => titleLower.includes(t))) score += 45;

  for (const t of tokens) {
    if (titleLower.startsWith(t)) score += 25;
    else if (
      titleLower.includes(` ${t}`) ||
      titleLower.includes(`_${t}`) ||
      titleLower.includes(`.${t}`)
    ) {
      score += 18;
    }
  }
  return score;
}
