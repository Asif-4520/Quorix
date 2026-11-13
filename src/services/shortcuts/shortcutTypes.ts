export type ShortcutScope = 'global' | 'explorer' | 'grid' | 'editor' | 'navigation';

export interface ShortcutItem {
  id: string;
  name: string;
  description: string;
  category:
    | 'General'
    | 'Settings'
    | 'Navigation'
    | 'Window'
    | 'Database'
    | 'SQL Editor'
    | 'Data Grid'
    | 'Tabs';
  defaultKeys: string;
  scope: ShortcutScope;
  allowInInput?: boolean;
  isReserved?: boolean;
}
