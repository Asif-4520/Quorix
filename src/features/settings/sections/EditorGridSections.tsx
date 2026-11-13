import type React from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { Slider } from '../../../components/ui/Slider';
import type { AppSettings } from '../../../services/storage';
import { SegmentedControl, SettingRow, SettingSection } from '../SettingsPrimitives';
import { EDITOR_FONT_PRESETS } from '../settingsConfig';

interface EditorGridSectionsProps {
  settings: AppSettings;
  globalSize: number;
  isPresetEditorFont: boolean;
  customEditorFontOpen: boolean;
  setCustomEditorFontOpen: (v: boolean) => void;
  showEditorFont: boolean;
  showEditorBehavior: boolean;
  showGridDisplay: boolean;
  showGridValues: boolean;
  isSearching: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

export const EditorGridSections: React.FC<EditorGridSectionsProps> = ({
  settings,
  globalSize,
  isPresetEditorFont,
  customEditorFontOpen,
  setCustomEditorFontOpen,
  showEditorFont,
  showEditorBehavior,
  showGridDisplay,
  showGridValues,
  isSearching,
  updateSettings,
}) => (
  <>
    {showEditorFont && (
      <SettingSection
        title="SQL Query Font & Spacing"
        sectionTag={isSearching ? 'Editor' : undefined}
      >
        <SettingRow label="SQL Editor Font">
          <select
            aria-label="SQL Editor Font Preset"
            value={
              isPresetEditorFont && !customEditorFontOpen ? settings.editorFontFamily : 'custom'
            }
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCustomEditorFontOpen(true);
              } else {
                setCustomEditorFontOpen(false);
                updateSettings({ editorFontFamily: e.target.value });
              }
            }}
            className="w-52"
          >
            {EDITOR_FONT_PRESETS.map((p) => (
              <option key={p.label} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom Font…</option>
          </select>
        </SettingRow>

        {(customEditorFontOpen || !isPresetEditorFont) && (
          <SettingRow label="Custom SQL Font">
            <input
              type="text"
              aria-label="SQL Editor Font Family"
              value={settings.editorFontFamily}
              onChange={(e) => updateSettings({ editorFontFamily: e.target.value })}
              className="w-60 font-mono"
            />
          </SettingRow>
        )}

        <SettingRow
          label="SQL Editor Font Size"
          hint="Set a larger or smaller size just for SQL queries"
        >
          <div className="flex items-center gap-2">
            {settings.editorFontSize !== globalSize && (
              <button
                type="button"
                onClick={() => updateSettings({ editorFontSize: globalSize })}
                title="Match the global UI font size"
                className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-[10.5px] font-medium"
              >
                Match Global ({globalSize}px)
              </button>
            )}
            <Slider
              ariaLabel="Editor Font Size"
              min={10}
              max={26}
              step={1}
              value={settings.editorFontSize}
              onChange={(v) => updateSettings({ editorFontSize: v })}
              className="w-28"
            />
            <NumberStepper
              ariaLabel="Editor Font Size px"
              min={10}
              max={26}
              step={1}
              unit="px"
              value={settings.editorFontSize}
              onChange={(v) => updateSettings({ editorFontSize: v })}
            />
          </div>
        </SettingRow>

        <SettingRow label="Line Spacing">
          <Slider
            ariaLabel="Line Height"
            min={1.1}
            max={2.4}
            step={0.1}
            value={settings.editorLineHeight}
            onChange={(v) => updateSettings({ editorLineHeight: v })}
            className="w-28"
          />
          <NumberStepper
            ariaLabel="Line Height value"
            min={1.1}
            max={2.4}
            step={0.1}
            unit="x"
            value={settings.editorLineHeight}
            onChange={(v) => updateSettings({ editorLineHeight: v })}
          />
        </SettingRow>

        <SettingRow label="Tab Width (Spaces)">
          <SegmentedControl<number>
            value={settings.editorTabSize}
            onChange={(editorTabSize) => updateSettings({ editorTabSize })}
            options={[
              { value: 2, label: '2' },
              { value: 4, label: '4' },
              { value: 8, label: '8' },
            ]}
          />
        </SettingRow>
      </SettingSection>
    )}

    {showEditorBehavior && (
      <SettingSection
        title="SQL Writing Assistance"
        sectionTag={isSearching ? 'Editor' : undefined}
      >
        <SettingRow label="Show Line Numbers">
          <Checkbox
            ariaLabel="Line Numbers"
            checked={settings.editorLineNumbers}
            onChange={(v) => updateSettings({ editorLineNumbers: v })}
          />
        </SettingRow>
        <SettingRow label="Wrap Long Lines">
          <Checkbox
            ariaLabel="Word Wrap"
            checked={settings.editorWordWrap}
            onChange={(v) => updateSettings({ editorWordWrap: v })}
          />
        </SettingRow>
        <SettingRow label="Schema Autocomplete" hint="Suggest table and column names as you type">
          <Checkbox
            ariaLabel="Schema Autocomplete"
            checked={settings.editorAutocomplete}
            onChange={(v) => updateSettings({ editorAutocomplete: v })}
          />
        </SettingRow>
      </SettingSection>
    )}

    {showGridDisplay && (
      <SettingSection title="Table Display" sectionTag={isSearching ? 'Data Grid' : undefined}>
        <SettingRow label="Rows Per Page">
          <select
            value={settings.defaultPageSize}
            onChange={(e) => updateSettings({ defaultPageSize: Number(e.target.value) })}
            className="w-32 font-mono"
          >
            {[25, 50, 100, 250, 500, 1000].map((n) => (
              <option key={n} value={n}>
                {n} rows
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Cell Font Style">
          <SegmentedControl<'mono' | 'sans'>
            value={settings.gridFontFamily}
            onChange={(gridFontFamily) => updateSettings({ gridFontFamily })}
            options={[
              { value: 'mono', label: 'Monospace' },
              { value: 'sans', label: 'App Sans' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Alternating Row Colors">
          <Checkbox
            ariaLabel="Striped Rows"
            checked={settings.gridStripedRows}
            onChange={(v) => updateSettings({ gridStripedRows: v })}
          />
        </SettingRow>
        <SettingRow label="Show Row Numbers (#)">
          <Checkbox
            ariaLabel="Row Numbers"
            checked={settings.gridShowRowNumbers}
            onChange={(v) => updateSettings({ gridShowRowNumbers: v })}
          />
        </SettingRow>
      </SettingSection>
    )}

    {showGridValues && (
      <SettingSection title="Values & Saving" sectionTag={isSearching ? 'Data Grid' : undefined}>
        <SettingRow label="Empty (NULL) Label">
          <SegmentedControl<'NULL' | 'null' | '—'>
            value={settings.nullDisplay}
            onChange={(nullDisplay) => updateSettings({ nullDisplay })}
            options={[
              { value: 'NULL', label: 'NULL' },
              { value: 'null', label: 'null' },
              { value: '—', label: '—' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Date & Time Format">
          <SegmentedControl<'iso' | 'local' | 'relative'>
            value={settings.dateFormat}
            onChange={(dateFormat) => updateSettings({ dateFormat })}
            options={[
              { value: 'iso', label: 'ISO' },
              { value: 'local', label: 'Local' },
              { value: 'relative', label: 'Relative' },
            ]}
          />
        </SettingRow>
        <SettingRow label="How Edits Save" hint="Review First holds edits until you press Ctrl+S">
          <SegmentedControl<'staged' | 'immediate'>
            value={settings.editMode}
            onChange={(editMode) => updateSettings({ editMode })}
            options={[
              { value: 'staged', label: 'Review First' },
              { value: 'immediate', label: 'Save Immediately' },
            ]}
          />
        </SettingRow>
      </SettingSection>
    )}
  </>
);
