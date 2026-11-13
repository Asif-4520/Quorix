import { create } from 'zustand';
import { type AppSettings, getSettings, saveSettings } from '../services/storage';
import { emitCrossWindowSettingsUpdated } from '../services/tauri';
import { applyTheme, resolveEffectiveThemeName, THEMES } from '../theme/themes';
import type { ThemeMode, ThemeName } from '../types/database';

interface SettingsState {
  settings: AppSettings;
  effectiveTheme: ThemeName;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setGlobalFontSize: (size: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setThemePreset: (name: ThemeName) => void;
  cycleTheme: () => ThemeName;
  syncSystemTheme: () => void;
  syncFromStorage: () => void;
}

const initialSettings = getSettings();
const initialTheme = resolveEffectiveThemeName(
  initialSettings.themeMode,
  initialSettings.theme,
  initialSettings.darkTheme,
  initialSettings.lightTheme,
);

function applyAppearanceSettings(s: AppSettings, effective: ThemeName): void {
  if (typeof document === 'undefined') return;
  applyTheme(effective);
  const root = document.documentElement;
  const clampedUi = Math.min(22, Math.max(10, s.uiFontSize || 13));
  const scale = clampedUi / 13;
  const uiFont =
    s.uiFontFamily?.trim() || 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
  const editorFont =
    s.editorFontFamily?.trim() || '"JetBrains Mono", "Cascadia Code", Consolas, monospace';
  const gridFont = s.gridFontFamily === 'sans' ? uiFont : editorFont;

  root.style.fontSize = `${clampedUi}px`;
  root.style.fontFamily = uiFont;
  root.style.setProperty('--quorix-ui-font-size', `${clampedUi}px`);
  root.style.setProperty('--quorix-font-scale', scale.toFixed(4));
  root.style.setProperty('--quorix-ui-font', uiFont);
  root.style.setProperty('--quorix-editor-font', editorFont);
  root.style.setProperty('--font-sans', uiFont);
  root.style.setProperty('--font-mono', editorFont);
  root.style.setProperty('--quorix-editor-font-size', `${s.editorFontSize || 13}px`);
  root.style.setProperty(
    '--quorix-radius',
    s.uiRadius === 'sharp' ? '4px' : s.uiRadius === 'soft' ? '12px' : '8px',
  );
  root.style.setProperty(
    '--quorix-radius-sm',
    s.uiRadius === 'sharp' ? '3px' : s.uiRadius === 'soft' ? '9px' : '6px',
  );
  root.style.setProperty('--quorix-grid-font', gridFont);
  root.style.setProperty('--quorix-grid-font-size', `${s.gridFontSize}px`);
  root.style.setProperty('--quorix-editor-line-height', String(s.editorLineHeight));
  if (document.body) {
    document.body.style.fontFamily = uiFont;
  }
}

applyAppearanceSettings(initialSettings, initialTheme);

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: initialSettings,
  effectiveTheme: initialTheme,

  updateSettings: (patch) => {
    const updated = saveSettings(patch);
    const effective = resolveEffectiveThemeName(
      updated.themeMode,
      updated.theme,
      updated.darkTheme,
      updated.lightTheme,
    );
    applyAppearanceSettings(updated, effective);
    set({ settings: updated, effectiveTheme: effective });
    void emitCrossWindowSettingsUpdated();
  },

  setGlobalFontSize: (size) => {
    const clamped = Math.min(20, Math.max(10, Math.round(size * 2) / 2));
    get().updateSettings({
      globalFontSize: clamped,
      uiFontSize: clamped,
      editorFontSize: clamped,
      gridFontSize: clamped,
    });
  },

  setThemeMode: (mode) => {
    const cur = get().settings;
    const nextTheme =
      mode === 'dark' ? cur.darkTheme : mode === 'light' ? cur.lightTheme : cur.theme;
    get().updateSettings({ themeMode: mode, theme: nextTheme });
  },

  setThemePreset: (name) => {
    const preset = THEMES[name];
    const mode: ThemeMode = preset?.isDark ? 'dark' : 'light';
    get().updateSettings({
      themeMode: mode,
      theme: name,
      ...(preset?.isDark ? { darkTheme: name } : { lightTheme: name }),
    });
  },

  cycleTheme: () => {
    const themeKeys = Object.keys(THEMES) as ThemeName[];
    const current = get().effectiveTheme;
    const next = themeKeys[(themeKeys.indexOf(current) + 1) % themeKeys.length];
    get().setThemePreset(next);
    return next;
  },

  syncSystemTheme: () => {
    const s = get().settings;
    if (s.themeMode !== 'system') return;
    const effective = resolveEffectiveThemeName('system', s.theme, s.darkTheme, s.lightTheme);
    applyTheme(effective);
    set({ effectiveTheme: effective });
  },

  syncFromStorage: () => {
    const fresh = getSettings();
    const effective = resolveEffectiveThemeName(
      fresh.themeMode,
      fresh.theme,
      fresh.darkTheme,
      fresh.lightTheme,
    );
    applyAppearanceSettings(fresh, effective);
    set({ settings: fresh, effectiveTheme: effective });
  },
}));
