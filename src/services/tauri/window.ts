import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './client';

export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().minimize();
  } catch (error) {
    console.error('Window minimize error:', error);
  }
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().toggleMaximize();
  } catch (error) {
    console.error('Window toggleMaximize error:', error);
  }
}

export async function closeWindow(): Promise<void> {
  if (!isTauri()) {
    window.close();
    return;
  }
  try {
    await getCurrentWindow().close();
  } catch (error) {
    console.error('Window close error:', error);
  }
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await getCurrentWindow().isMaximized();
  } catch {
    return false;
  }
}

export async function isWindowFullscreen(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await getCurrentWindow().isFullscreen();
  } catch {
    return false;
  }
}

export async function toggleFullscreenWindow(): Promise<boolean> {
  if (!isTauri()) {
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.().catch(() => {});
        return true;
      }
      await document.exitFullscreen?.().catch(() => {});
      return false;
    }
    return false;
  }
  try {
    const win = getCurrentWindow();
    const current = await win.isFullscreen();
    const next = !current;
    await win.setFullscreen(next);
    return next;
  } catch (error) {
    console.error('Window fullscreen error:', error);
    return false;
  }
}

export async function subscribeWindowResized(callback: () => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    return await getCurrentWindow().onResized(callback);
  } catch {
    return () => {};
  }
}
