import { Monitor, Moon, Sun } from 'lucide-react';
import type React from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { Slider } from '../../../components/ui/Slider';
import type { AppSettings } from '../../../services/storage';
import { THEMES } from '../../../theme/themes';
import type { ThemeMode, ThemeName } from '../../../types/database';
import { SegmentedControl, SettingRow, SettingSection } from '../SettingsPrimitives';
import { GLOBAL_FONT_PRESETS, UI_FONT_PRESETS } from '../settingsConfig';

interface AppearanceSectionProps {
  settings: AppSettings;
  effectiveTheme: ThemeName;
  globalSize: number;
  isPresetUiFont: boolean;
  customUiFontOpen: boolean;
  setCustomUiFontOpen: (v: boolean) => void;
  showFont: boolean;
  showTheme: boolean;
  showChrome: boolean;
  isSearching: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setGlobalFontSize: (v: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setThemePreset: (t: ThemeName) => void;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  settings,
  effectiveTheme,
  globalSize,
  isPresetUiFont,
  customUiFontOpen,
  setCustomUiFontOpen,
  showFont,
  showTheme,
  showChrome,
  isSearching,
  updateSettings,
  setGlobalFontSize,
  setThemeMode,
  setThemePreset,
}) => (
  <>
    {showFont && (
      <SettingSection
        title="Global Font & Style"
        sectionTag={isSearching ? 'Appearance' : undefined}
      >
        <SettingRow
          label="Global Font Size"
          hint="Applies to the entire app. Customize SQL queries separately under Editor."
        >
          <div className="flex items-center gap-2">
            <Slider
              ariaLabel="Global Font Size"
              min={10}
              max={20}
              step={0.5}
              value={globalSize}
              onChange={(v) => setGlobalFontSize(v)}
              className="w-28"
            />
            <NumberStepper
              ariaLabel="Global Font Size px"
              min={10}
              max={20}
              step={0.5}
              unit="px"
              value={globalSize}
              onChange={(v) => setGlobalFontSize(v)}
            />
          </div>
        </SettingRow>

        <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-[var(--bg-panel)]/35">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Size Presets</span>
          <div className="inline-flex items-center gap-1 flex-wrap justify-end">
            {GLOBAL_FONT_PRESETS.map((sz) => {
              const active = globalSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setGlobalFontSize(sz)}
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-mono transition-colors ${
                    active
                      ? 'bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent)] font-semibold'
                      : 'bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-focus)]'
                  }`}
                >
                  {sz}px
                </button>
              );
            })}
          </div>
        </div>

        <SettingRow label="Application Font">
          <select
            aria-label="Interface Font Preset"
            value={isPresetUiFont && !customUiFontOpen ? settings.uiFontFamily : 'custom'}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCustomUiFontOpen(true);
              } else {
                setCustomUiFontOpen(false);
                updateSettings({ uiFontFamily: e.target.value });
              }
            }}
            className="w-52"
          >
            {UI_FONT_PRESETS.map((p) => (
              <option key={p.label} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom Font…</option>
          </select>
        </SettingRow>

        {(customUiFontOpen || !isPresetUiFont) && (
          <SettingRow label="Custom Font Name">
            <input
              type="text"
              aria-label="UI Font Family"
              value={settings.uiFontFamily}
              onChange={(e) => updateSettings({ uiFontFamily: e.target.value })}
              className="w-60 font-mono"
            />
          </SettingRow>
        )}

        <SettingRow
          label="Sync Zoom Shortcuts"
          hint="Ctrl + = / - scales both app and SQL editor together"
        >
          <Checkbox
            ariaLabel="Sync Zoom Shortcuts"
            checked={settings.syncFontSizes ?? true}
            onChange={(v) => updateSettings({ syncFontSizes: v })}
          />
        </SettingRow>

        <SettingRow label="Corner Roundness">
          <SegmentedControl<'sharp' | 'balanced' | 'soft'>
            value={settings.uiRadius}
            onChange={(uiRadius) => updateSettings({ uiRadius })}
            options={[
              { value: 'sharp', label: 'Sharp' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'soft', label: 'Soft' },
            ]}
          />
        </SettingRow>
      </SettingSection>
    )}

    {showTheme && (
      <SettingSection title="Theme & Colors" sectionTag={isSearching ? 'Appearance' : undefined}>
        <SettingRow label="Color Mode">
          <SegmentedControl<ThemeMode>
            value={settings.themeMode}
            onChange={setThemeMode}
            options={[
              { value: 'system', label: 'System', icon: <Monitor size={12} /> },
              { value: 'dark', label: 'Dark', icon: <Moon size={12} /> },
              { value: 'light', label: 'Light', icon: <Sun size={12} /> },
            ]}
          />
        </SettingRow>

        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-[var(--text)]">Color Theme</span>
            <span className="text-[11px] font-medium text-[var(--accent)]">
              {THEMES[effectiveTheme]?.displayName}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {Object.values(THEMES).map((t) => {
              const active = effectiveTheme === t.name;
              return (
                <button
                  type="button"
                  key={t.name}
                  onClick={() => setThemePreset(t.name)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    active
                      ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/40'
                      : 'border-[var(--border)] hover:border-[var(--border-focus)]'
                  }`}
                  style={{ background: t.bgPanel, color: t.text }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-[11.5px] truncate">{t.displayName}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: t.accent }}
                    />
                  </div>
                  <div
                    className="h-6 rounded border p-1 flex items-center gap-1"
                    style={{ background: t.bg, borderColor: t.border }}
                  >
                    <span
                      className="w-4 h-full rounded-[2px]"
                      style={{ background: t.bgSidebar }}
                    />
                    <span
                      className="flex-1 h-1.5 rounded-[2px]"
                      style={{ background: t.bgSurface }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SettingSection>
    )}

    {showChrome && (
      <SettingSection title="Workspace Layout" sectionTag={isSearching ? 'Appearance' : undefined}>
        <SettingRow label="Show Left Tool Strip">
          <Checkbox
            ariaLabel="Tool Window Rail"
            checked={settings.toolRailVisible}
            onChange={(v) => updateSettings({ toolRailVisible: v })}
          />
        </SettingRow>
        <SettingRow label="Show Bottom Status Bar">
          <Checkbox
            ariaLabel="Status Bar"
            checked={settings.statusBarVisible}
            onChange={(v) => updateSettings({ statusBarVisible: v })}
          />
        </SettingRow>
      </SettingSection>
    )}
  </>
);
