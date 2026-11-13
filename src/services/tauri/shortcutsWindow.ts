import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauri } from './client';

export const SHORTCUTS_WINDOW_LABEL = 'shortcuts';
export const SETTINGS_WINDOW_LABEL = 'settings';

export const SHORTCUTS_UPDATED_TAURI_EVENT = 'quorix://shortcuts-updated';
export const SETTINGS_UPDATED_TAURI_EVENT = 'quorix://settings-updated';
export const SETTINGS_NAVIGATE_TAURI_EVENT = 'quorix://settings-navigate';
export const CLEAR_HISTORY_TAURI_EVENT = 'quorix://clear-history';
export const OPEN_SETTINGS_TAURI_EVENT = 'quorix://open-settings';

export type StudioWindowKind = 'main' | 'shortcuts' | 'settings';

export function getStudioWindowKind(): StudioWindowKind {
  if (typeof window === 'undefined') return 'main';
  try {
    const winParam = new URLSearchParams(window.location.search).get('window');
    if (winParam === SHORTCUTS_WINDOW_LABEL) return 'shortcuts';
    if (winParam === SETTINGS_WINDOW_LABEL) return 'settings';
    return 'main';
  } catch {
    return 'main';
  }
}

export function getStudioInitialTab(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return new URLSearchParams(window.location.search).get('tab') || undefined;
  } catch {
    return undefined;
  }
}

export function isShortcutsStandaloneWindow(): boolean {
  return getStudioWindowKind() === 'shortcuts';
}

export function isSettingsStandaloneWindow(): boolean {
  return getStudioWindowKind() === 'settings';
}

interface DesktopWindowSpec {
  label: string;
  title: string;
  url: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

async function openOrFocusDesktopWindow(
  spec: DesktopWindowSpec,
  onAlreadyOpen?: () => Promise<void> | void,
): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const existing = await WebviewWindow.getByLabel(spec.label);
    if (existing) {
      await existing.unminimize().catch(() => {});
      await existing.show().catch(() => {});
      await existing.setFocus().catch(() => {});
      if (onAlreadyOpen) {
        await onAlreadyOpen();
      }
      return true;
    }

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };

      const win = new WebviewWindow(spec.label, {
        title: spec.title,
        url: spec.url,
        width: spec.width,
        height: spec.height,
        minWidth: spec.minWidth,
        minHeight: spec.minHeight,
        center: true,
        decorations: false,
        focus: true,
      });

      void win.once('tauri://created', () => {
        finish(true);
      });
      void win.once('tauri://error', (err) => {
        console.error(`Failed to open ${spec.label} window:`, err);
        finish(false);
      });
    });
  } catch (err) {
    console.error(`Unable to open ${spec.label} desktop window:`, err);
    return false;
  }
}

export async function openShortcutsDesktopWindow(): Promise<boolean> {
  return openOrFocusDesktopWindow({
    label: SHORTCUTS_WINDOW_LABEL,
    title: 'Keyboard Shortcuts — Quorix',
    url: `/?window=${SHORTCUTS_WINDOW_LABEL}`,
    width: 1080,
    height: 740,
    minWidth: 780,
    minHeight: 540,
  });
}

export async function openSettingsDesktopWindow(tab = 'appearance'): Promise<boolean> {
  const safeTab = tab || 'appearance';
  const query = new URLSearchParams({
    window: SETTINGS_WINDOW_LABEL,
    tab: safeTab,
  }).toString();

  return openOrFocusDesktopWindow(
    {
      label: SETTINGS_WINDOW_LABEL,
      title: 'Settings — Quorix',
      url: `/?${query}`,
      width: 1020,
      height: 740,
      minWidth: 760,
      minHeight: 540,
    },
    async () => {
      await emit(SETTINGS_NAVIGATE_TAURI_EVENT, { tab: safeTab });
    },
  );
}

async function emitSafeEvent<T>(eventName: string, payload: T): Promise<void> {
  if (!isTauri()) return;
  try {
    await emit(eventName, payload);
  } catch {}
}

async function subscribeSafeEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn | null> {
  if (!isTauri()) return null;
  try {
    return await listen<T>(eventName, (event) => {
      handler(event.payload);
    });
  } catch {
    return null;
  }
}

export async function emitCrossWindowShortcutsUpdated(): Promise<void> {
  await emitSafeEvent(SHORTCUTS_UPDATED_TAURI_EVENT, { timestamp: Date.now() });
}

export async function subscribeCrossWindowShortcutsUpdated(
  onUpdate: () => void,
): Promise<UnlistenFn | null> {
  return subscribeSafeEvent(SHORTCUTS_UPDATED_TAURI_EVENT, () => onUpdate());
}

export async function emitCrossWindowSettingsUpdated(): Promise<void> {
  await emitSafeEvent(SETTINGS_UPDATED_TAURI_EVENT, { timestamp: Date.now() });
}

export async function subscribeCrossWindowSettingsUpdated(
  onUpdate: () => void,
): Promise<UnlistenFn | null> {
  return subscribeSafeEvent(SETTINGS_UPDATED_TAURI_EVENT, () => onUpdate());
}

export async function subscribeCrossWindowSettingsNavigate(
  onNavigate: (tab: string) => void,
): Promise<UnlistenFn | null> {
  return subscribeSafeEvent<{ tab?: string }>(SETTINGS_NAVIGATE_TAURI_EVENT, (payload) => {
    if (payload?.tab) onNavigate(payload.tab);
  });
}

export async function emitCrossWindowClearHistory(): Promise<void> {
  await emitSafeEvent(CLEAR_HISTORY_TAURI_EVENT, { timestamp: Date.now() });
}

export async function subscribeCrossWindowClearHistory(
  onClearHistory: () => void,
): Promise<UnlistenFn | null> {
  return subscribeSafeEvent(CLEAR_HISTORY_TAURI_EVENT, () => onClearHistory());
}

export async function emitCrossWindowOpenSettings(tab = 'appearance'): Promise<boolean> {
  if (!isTauri()) return false;
  const openedStandalone = await openSettingsDesktopWindow(tab);
  if (openedStandalone) return true;

  try {
    const mainWin = await WebviewWindow.getByLabel('main');
    if (mainWin) {
      await mainWin.unminimize().catch(() => {});
      await mainWin.show().catch(() => {});
      await mainWin.setFocus().catch(() => {});
    }
    await emit(OPEN_SETTINGS_TAURI_EVENT, { tab });
    return true;
  } catch {
    return false;
  }
}

export async function subscribeCrossWindowOpenSettings(
  onOpenSettings: (tab: string) => void,
): Promise<UnlistenFn | null> {
  return subscribeSafeEvent<{ tab?: string }>(OPEN_SETTINGS_TAURI_EVENT, (payload) => {
    onOpenSettings(payload?.tab || 'appearance');
  });
}
