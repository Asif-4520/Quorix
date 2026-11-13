import { emitCrossWindowShortcutsUpdated } from '../tauri/shortcutsWindow';
import { DEFAULT_SHORTCUTS } from './defaultShortcuts';

const STORAGE_KEY = 'quorix_custom_keybindings';

export function getCustomKeybindings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setCustomKeybinding(id: string, keys: string): void {
  const current = getCustomKeybindings();
  current[id] = keys.trim();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  window.dispatchEvent(new Event('quorix-shortcuts-updated'));
  void emitCrossWindowShortcutsUpdated();
}

export function unbindShortcut(id: string): void {
  setCustomKeybinding(id, '');
}

export function resetCustomKeybinding(id: string): void {
  const current = getCustomKeybindings();
  delete current[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  window.dispatchEvent(new Event('quorix-shortcuts-updated'));
  void emitCrossWindowShortcutsUpdated();
}

export function resetAllKeybindings(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('quorix-shortcuts-updated'));
  void emitCrossWindowShortcutsUpdated();
}

export function getEffectiveShortcut(id: string): string {
  const custom = getCustomKeybindings();
  if (id in custom && typeof custom[id] === 'string') {
    return custom[id];
  }
  const def = DEFAULT_SHORTCUTS.find((s) => s.id === id);
  return def ? def.defaultKeys : '';
}

export function hasCustomKeybinding(id: string): boolean {
  const custom = getCustomKeybindings();
  return id in custom && typeof custom[id] === 'string';
}
