import { DEFAULT_SHORTCUTS, type ShortcutItem, type ShortcutScope } from './defaultShortcuts';
import { getEffectiveShortcut } from './shortcutStorage';

export function keyboardEventToCombo(e: KeyboardEvent): string | null {
  const key = e.key;
  if (
    key === 'Control' ||
    key === 'Shift' ||
    key === 'Alt' ||
    key === 'Meta' ||
    key === 'CapsLock' ||
    key === 'NumLock' ||
    key === 'ScrollLock'
  ) {
    return null;
  }

  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
  if (e.shiftKey) mods.push('Shift');
  if (e.altKey) mods.push('Alt');

  let mainKey = key;
  if (key === ' ') mainKey = 'Space';
  else if (key === 'ArrowLeft') mainKey = 'Left';
  else if (key === 'ArrowRight') mainKey = 'Right';
  else if (key === 'ArrowUp') mainKey = 'Up';
  else if (key === 'ArrowDown') mainKey = 'Down';
  else if (e.code === 'Equal') mainKey = '=';
  else if (e.code === 'Minus') mainKey = '-';
  else if (key.length === 1) mainKey = key.toUpperCase();
  else mainKey = key.charAt(0).toUpperCase() + key.slice(1);

  return mods.length > 0 ? `${mods.join('+')}+${mainKey}` : mainKey;
}

export function findConflictsForCandidate(actionId: string, candidateKeys: string): ShortcutItem[] {
  const candidateAlts = candidateKeys
    .split(' / ')
    .map((s) => normalizeCombo(s))
    .filter(Boolean);
  if (candidateAlts.length === 0) return [];
  const targetDef = DEFAULT_SHORTCUTS.find((s) => s.id === actionId);
  const targetScope = targetDef?.scope ?? 'global';

  const matches: ShortcutItem[] = [];
  for (const s of DEFAULT_SHORTCUTS) {
    if (s.id === actionId) continue;
    const effective = getEffectiveShortcut(s.id);
    if (!effective) continue;
    const alts = effective
      .split(' / ')
      .map((k) => normalizeCombo(k))
      .filter(Boolean);
    const overlapsCombo = alts.some((a) => candidateAlts.includes(a));
    if (!overlapsCombo) continue;
    if (targetScope === 'global' || s.scope === 'global' || targetScope === s.scope) {
      matches.push(s);
    }
  }
  return matches;
}

export function formatShortcutForDisplay(keyString: string): string {
  if (!keyString) return '';
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
  const first = keyString.split(' / ')[0].trim();
  return isMac
    ? first
        .replace(/Ctrl\+/gi, '⌘')
        .replace(/Alt\+/gi, '⌥')
        .replace(/Shift\+/gi, '⇧')
    : first;
}

export interface ShortcutConflict {
  keys: string;
  scope: string;
  actionIds: string[];
}

export function getShortcutConflicts(): ShortcutConflict[] {
  const byCombo = new Map<string, { scope: ShortcutScope; ids: string[] }>();

  for (const shortcut of DEFAULT_SHORTCUTS) {
    const raw = getEffectiveShortcut(shortcut.id);
    if (!raw) continue;
    const alts = raw
      .split(' / ')
      .map((s) => normalizeCombo(s))
      .filter(Boolean);

    for (const combo of alts) {
      const existing = byCombo.get(combo) ?? { scope: shortcut.scope, ids: [] };
      existing.ids.push(shortcut.id);
      byCombo.set(combo, existing);
    }
  }

  const conflicts: ShortcutConflict[] = [];
  for (const [combo, entry] of byCombo.entries()) {
    if (entry.ids.length < 2) continue;
    const scopes = entry.ids.map(
      (id) => DEFAULT_SHORTCUTS.find((s) => s.id === id)?.scope ?? 'global',
    );
    const hasGlobal = scopes.includes('global');
    const uniqueNonGlobal = new Set(scopes);
    if (hasGlobal || uniqueNonGlobal.size < scopes.length) {
      conflicts.push({
        keys: combo,
        scope: hasGlobal ? 'global' : scopes[0],
        actionIds: entry.ids,
      });
    }
  }
  return conflicts;
}

function normalizeCombo(combo: string): string {
  return combo
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .join('+');
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable === true ||
    target.closest('.cm-editor') !== null
  );
}

export function shouldIgnoreShortcut(e: KeyboardEvent, shortcutId: string): boolean {
  const def = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId);
  if (!def) return false;
  if (def.allowInInput) return false;
  return isTextEditingTarget(e.target);
}

export function matchesKeyCombination(e: KeyboardEvent, keyString: string): boolean {
  if (!keyString) return false;
  const alternatives = keyString.split(' / ').map((s) => s.trim());
  for (const alt of alternatives) {
    if (matchesSingleCombination(e, alt)) {
      return true;
    }
  }
  return false;
}

function matchesSingleCombination(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+').map((p) => p.trim().toLowerCase());
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
  const ctrlOrMeta = isMac ? e.metaKey : e.ctrlKey;

  const requiresCtrl = parts.includes('ctrl') || parts.includes('mod') || parts.includes('cmd');
  const requiresShift = parts.includes('shift');
  const requiresAlt = parts.includes('alt');

  if (requiresCtrl !== ctrlOrMeta) return false;
  if (requiresShift !== e.shiftKey) return false;
  if (requiresAlt !== e.altKey) return false;

  const mainKey = parts.find((p) => !['ctrl', 'mod', 'cmd', 'shift', 'alt', 'meta'].includes(p));
  if (!mainKey) return false;

  const eventKey = e.key.toLowerCase();
  const code = e.code.toLowerCase();

  if (mainKey === 'enter' && eventKey === 'enter') return true;
  if (mainKey === 'escape' && eventKey === 'escape') return true;
  if (mainKey === 'tab' && eventKey === 'tab') return true;
  if (mainKey === 'space' && (e.key === ' ' || code === 'space')) return true;
  if (
    mainKey === 'delete' &&
    (isMac ? e.key === 'Delete' || e.key === 'Backspace' : e.key === 'Delete')
  ) {
    return true;
  }
  if (mainKey === 'pageup' && e.key === 'PageUp') return true;
  if (mainKey === 'pagedown' && e.key === 'PageDown') return true;
  if (mainKey === 'home' && e.key === 'Home') return true;
  if (mainKey === 'end' && e.key === 'End') return true;
  if ((mainKey === 'left' || mainKey === 'arrowleft') && e.key === 'ArrowLeft') return true;
  if ((mainKey === 'right' || mainKey === 'arrowright') && e.key === 'ArrowRight') return true;
  if ((mainKey === 'up' || mainKey === 'arrowup') && e.key === 'ArrowUp') return true;
  if ((mainKey === 'down' || mainKey === 'arrowdown') && e.key === 'ArrowDown') return true;
  if (mainKey === 'insert' && e.key === 'Insert') return true;
  if (/^f\d{1,2}$/.test(mainKey) && eventKey === mainKey) return true;
  if (mainKey === ',' && eventKey === ',') return true;
  if (mainKey === '=' && (eventKey === '=' || eventKey === '+' || code === 'equal')) return true;
  if (mainKey === '-' && (eventKey === '-' || eventKey === '_' || code === 'minus')) return true;
  if (mainKey === '/' && (eventKey === '/' || eventKey === '?')) return true;
  if (/^[0-9]$/.test(mainKey) && (eventKey === mainKey || code === `digit${mainKey}`)) {
    return true;
  }

  return mainKey === eventKey;
}
