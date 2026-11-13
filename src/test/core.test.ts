import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  findConflictsForCandidate,
  getEffectiveShortcut,
  getShortcutConflicts,
  hasCustomKeybinding,
  keyboardEventToCombo,
  matchesKeyCombination,
  resetAllKeybindings,
  resetCustomKeybinding,
  setCustomKeybinding,
  shouldIgnoreShortcut,
  unbindShortcut,
} from '../services/shortcuts';
import { sanitizePgUrlForStorage } from '../services/storage';
import { useSettingsStore } from '../stores/settingsStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { resolveEffectiveThemeName } from '../theme/themes';

describe('Shortcut Registry', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAllKeybindings();
  });

  it('has zero conflicts across default shortcuts', () => {
    expect(getShortcutConflicts()).toEqual([]);
  });

  it('detects conflicts when two global or overlapping actions share a key', () => {
    const paletteDefault = DEFAULT_SHORTCUTS.find((s) => s.id === 'command-palette')?.defaultKeys;
    expect(paletteDefault).toBe('Ctrl+Shift+P');
    setCustomKeybinding('quick-open', 'Ctrl+Shift+P');
    const conflicts = getShortcutConflicts();
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].actionIds).toContain('command-palette');
    expect(conflicts[0].actionIds).toContain('quick-open');
  });

  it('matches keyboard events and respects text input guards', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const refreshEv = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true });
    Object.defineProperty(refreshEv, 'target', { value: input });
    expect(shouldIgnoreShortcut(refreshEv, 'refresh-schema')).toBe(true);
    expect(shouldIgnoreShortcut(refreshEv, 'command-palette')).toBe(false);

    const paletteEv = new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true });
    expect(matchesKeyCombination(paletteEv, getEffectiveShortcut('command-palette'))).toBe(true);
    input.remove();
  });

  it('records physical keystrokes into canonical combos and handles unbinding cleanly', () => {
    expect(
      keyboardEventToCombo(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true })),
    ).toBeNull();
    expect(
      keyboardEventToCombo(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, altKey: true })),
    ).toBe('Ctrl+Alt+K');
    expect(keyboardEventToCombo(new KeyboardEvent('keydown', { key: 'F11' }))).toBe('F11');
    expect(keyboardEventToCombo(new KeyboardEvent('keydown', { key: ' ', shiftKey: true }))).toBe(
      'Shift+Space',
    );

    const conflicts = findConflictsForCandidate('toggle-fullscreen', 'Ctrl+Shift+P');
    expect(conflicts.some((c) => c.id === 'command-palette')).toBe(true);

    unbindShortcut('toggle-fullscreen');
    expect(hasCustomKeybinding('toggle-fullscreen')).toBe(true);
    expect(getEffectiveShortcut('toggle-fullscreen')).toBe('');

    resetCustomKeybinding('toggle-fullscreen');
    expect(hasCustomKeybinding('toggle-fullscreen')).toBe(false);
    expect(getEffectiveShortcut('toggle-fullscreen')).toBe('F11');
  });

  it('includes useful unbound default shortcuts without causing false conflicts or matches', () => {
    const unbound = DEFAULT_SHORTCUTS.filter((s) => s.defaultKeys === '');
    expect(unbound.length).toBeGreaterThanOrEqual(15);
    expect(unbound.some((s) => s.id === 'open-appearance-settings')).toBe(true);
    expect(unbound.some((s) => s.id === 'sql-export-csv')).toBe(true);
    expect(unbound.some((s) => s.id === 'grid-last-page')).toBe(true);
    expect(unbound.some((s) => s.id === 'toggle-distraction-free')).toBe(true);

    expect(getShortcutConflicts()).toEqual([]);
    const ev = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
    expect(matchesKeyCombination(ev, getEffectiveShortcut('open-appearance-settings'))).toBe(false);

    setCustomKeybinding('open-appearance-settings', 'Ctrl+Alt+A');
    expect(getEffectiveShortcut('open-appearance-settings')).toBe('Ctrl+Alt+A');
    expect(getShortcutConflicts()).toEqual([]);
  });

  it('applies font, radius, and grid typography CSS variables via settingsStore', () => {
    useSettingsStore.getState().updateSettings({
      uiFontSize: 15,
      uiRadius: 'soft',
      gridFontSize: 14,
      gridFontFamily: 'sans',
      editorLineHeight: 1.8,
    });
    const rootStyle = document.documentElement.style;
    expect(rootStyle.fontSize).toBe('15px');
    expect(rootStyle.getPropertyValue('--quorix-radius')).toBe('12px');
    expect(rootStyle.getPropertyValue('--quorix-grid-font-size')).toBe('14px');
    expect(rootStyle.getPropertyValue('--quorix-editor-line-height')).toBe('1.8');
  });
});

describe('Security & Sanitization', () => {
  it('strips plaintext passwords from PostgreSQL URLs before local storage', () => {
    expect(
      sanitizePgUrlForStorage(
        'postgresql://alice:s3cr3t@db.prod.local:5432/analytics?sslmode=require',
      ),
    ).toBe('postgresql://alice@db.prod.local:5432/analytics?sslmode=require');
    expect(sanitizePgUrlForStorage('postgres://alice@localhost:5432/app')).toBe(
      'postgres://alice@localhost:5432/app',
    );
  });
});

describe('Theme Resolution', () => {
  it('resolves dark, light, and system modes properly', () => {
    expect(resolveEffectiveThemeName('dark', 'pearl-light', 'obsidian-dark', 'pearl-light')).toBe(
      'obsidian-dark',
    );
    expect(
      resolveEffectiveThemeName('light', 'obsidian-dark', 'obsidian-dark', 'pearl-light'),
    ).toBe('pearl-light');

    const matchSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) =>
        ({
          matches: false,
          media: q,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    expect(
      resolveEffectiveThemeName('system', 'obsidian-dark', 'obsidian-dark', 'snow-light'),
    ).toBe('snow-light');
    matchSpy.mockRestore();
  });

  it('updates body classes when switching themes via settingsStore', () => {
    useSettingsStore.getState().setThemePreset('pearl-light');
    expect(document.body.classList.contains('light')).toBe(true);
    useSettingsStore.getState().setThemePreset('obsidian-dark');
    expect(document.body.classList.contains('dark')).toBe(true);
  });
});

describe('Workspace Store & Tab Management', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState({
      tabs: [],
      activeTabId: '',
      closedTabs: [],
      savedQueries: [],
    });
  });

  it('deduplicates table tabs, pins tabs, closes, and reopens closed tabs', () => {
    const store = useWorkspaceStore.getState();
    const tbl = {
      name: 'users',
      schema: 'public',
      kind: 'table',
      hasPrimaryKey: true,
      isStrict: false,
      withoutRowid: false,
    };

    store.openTableTab(tbl, 'pg1', 'Prod PG');
    store.openTableTab(tbl, 'pg1', 'Prod PG');
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1);

    const sqlId = store.openSqlTab({ title: 'Audit', sql: 'SELECT 1;', connectionId: 'pg1' });
    expect(useWorkspaceStore.getState().tabs).toHaveLength(2);
    expect(useWorkspaceStore.getState().activeTabId).toBe(sqlId);

    const firstId = useWorkspaceStore.getState().tabs[0].id;
    store.togglePinTab(firstId);
    store.closeAllUnpinnedTabs();
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1);
    expect(useWorkspaceStore.getState().tabs[0].id).toBe(firstId);

    store.reopenClosedTab();
    expect(useWorkspaceStore.getState().tabs).toHaveLength(2);
  });

  it('persists saved query creation and deletion', () => {
    const store = useWorkspaceStore.getState();
    const item = store.saveQuery({ title: 'Monthly Revenue', sql: 'SELECT 42;' });
    expect(useWorkspaceStore.getState().savedQueries).toHaveLength(1);
    store.removeSavedQuery(item.id);
    expect(useWorkspaceStore.getState().savedQueries).toHaveLength(0);
  });
});
