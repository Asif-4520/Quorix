import { ArrowUpRight, Copy, ExternalLink, Info, Keyboard, RotateCcw, Trash2 } from 'lucide-react';
import type React from 'react';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/Badge';
import { Checkbox } from '../../../components/ui/Checkbox';
import { GithubIcon } from '../../../components/ui/DatabaseIcons';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { QuorixLogo } from '../../../components/ui/QuorixLogo';
import { Slider } from '../../../components/ui/Slider';
import { ABOUT_LINKS, APP_INFO, openExternalUrl } from '../../../services/appInfo';
import { getCustomKeybindings, resetAllKeybindings } from '../../../services/shortcuts';
import { type AppSettings, DEFAULT_SETTINGS, STORAGE_KEYS } from '../../../services/storage';
import { SegmentedControl, SettingRow, SettingSection } from '../SettingsPrimitives';
import type { SettingsTabId } from '../settingsConfig';
import { getModifiedSettingsCount } from '../settingsMetadata';

interface SystemSectionsProps {
  settings: AppSettings;
  isSearching: boolean;
  showDatabase: boolean;
  showWorkspace: boolean;
  showPerfLimits: boolean;
  showPerfStorage: boolean;
  showSecurityCreds: boolean;
  showSecurityConfirms: boolean;
  showAdvancedAbout: boolean;
  showAdvancedReset: boolean;
  showAbout: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
  clearHistory: () => void;
  onClose: () => void;
  onOpenShortcuts?: () => void;
  onSelectTab: (tab: SettingsTabId) => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

function getStorageDiagnostics() {
  let keyCount = 0;
  let totalBytes = 0;
  const readArrayLen = (key: string): number => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('quorix')) {
        keyCount++;
        const v = localStorage.getItem(k) || '';
        totalBytes += (k.length + v.length) * 2;
      }
    }
  } catch {
    // ignore storage errors in restricted contexts
  }

  return {
    keyCount,
    kb: Math.max(0.1, Math.round((totalBytes / 1024) * 10) / 10).toFixed(1),
    savedProfiles: readArrayLen(STORAGE_KEYS.SAVED_CONNECTIONS),
    savedQueries: readArrayLen(STORAGE_KEYS.SAVED_QUERIES),
    historyItems: readArrayLen(STORAGE_KEYS.QUERY_HISTORY),
    customBindings: Object.keys(getCustomKeybindings()).length,
  };
}

export const SystemSections: React.FC<SystemSectionsProps> = ({
  settings,
  isSearching,
  showDatabase,
  showWorkspace,
  showPerfLimits,
  showPerfStorage,
  showSecurityCreds,
  showSecurityConfirms,
  showAdvancedAbout,
  showAdvancedReset,
  showAbout,
  updateSettings,
  clearHistory,
  onClose,
  onOpenShortcuts,
  onSelectTab,
  onRequestConfirm,
}) => (
  <>
    {showDatabase && (
      <SettingSection
        title="Connection & Query Defaults"
        sectionTag={isSearching ? 'Database' : undefined}
      >
        <SettingRow label="Connection Timeout">
          <Slider
            ariaLabel="Connection Timeout"
            min={2}
            max={60}
            step={1}
            value={settings.connectionTimeout}
            onChange={(v) => updateSettings({ connectionTimeout: v })}
            className="w-28"
          />
          <NumberStepper
            ariaLabel="Connection Timeout sec"
            min={2}
            max={60}
            step={1}
            unit="sec"
            value={settings.connectionTimeout}
            onChange={(v) => updateSettings({ connectionTimeout: v })}
          />
        </SettingRow>
        <SettingRow label="Query Timeout">
          <Slider
            ariaLabel="Query Timeout"
            min={5}
            max={300}
            step={5}
            value={settings.queryTimeout}
            onChange={(v) => updateSettings({ queryTimeout: v })}
            className="w-28"
          />
          <NumberStepper
            ariaLabel="Query Timeout sec"
            min={5}
            max={300}
            step={5}
            unit="sec"
            value={settings.queryTimeout}
            onChange={(v) => updateSettings({ queryTimeout: v })}
          />
        </SettingRow>
        <SettingRow
          label="PgBouncer Pooling (PostgreSQL)"
          hint="Disable statement cache for pooled connections"
        >
          <Checkbox
            ariaLabel="PgBouncer Mode Default"
            checked={settings.pgbouncerDefault}
            onChange={(v) => updateSettings({ pgbouncerDefault: v })}
          />
        </SettingRow>
      </SettingSection>
    )}

    {showWorkspace && (
      <SettingSection title="Startup & Tabs" sectionTag={isSearching ? 'Workspace' : undefined}>
        <SettingRow label="Restore Open Tabs on Startup">
          <Checkbox
            ariaLabel="Restore Previous Session"
            checked={settings.restoreWorkspace}
            onChange={(v) => updateSettings({ restoreWorkspace: v })}
          />
        </SettingRow>
        <SettingRow label="Focus Already-Open Table Tab">
          <Checkbox
            ariaLabel="Reuse Existing Table Tab"
            checked={settings.reuseExistingTableTab}
            onChange={(v) => updateSettings({ reuseExistingTableTab: v })}
          />
        </SettingRow>
      </SettingSection>
    )}

    {showPerfLimits && (
      <SettingSection title="Speed & Limits" sectionTag={isSearching ? 'Performance' : undefined}>
        <SettingRow label="Max Rows per Query">
          <Slider
            ariaLabel="Max Query Result Rows"
            min={500}
            max={25000}
            step={500}
            value={settings.maxResultRows}
            onChange={(v) => updateSettings({ maxResultRows: v })}
            className="w-28"
          />
          <NumberStepper
            ariaLabel="Max Query Result Rows value"
            min={100}
            max={25000}
            step={500}
            unit="rows"
            value={settings.maxResultRows}
            onChange={(v) => updateSettings({ maxResultRows: v })}
          />
        </SettingRow>
        <SettingRow label="Saved Query History Limit">
          <Slider
            ariaLabel="Query History Limit"
            min={20}
            max={1000}
            step={20}
            value={settings.historyRetentionLimit}
            onChange={(v) => updateSettings({ historyRetentionLimit: v })}
            className="w-28"
          />
          <NumberStepper
            ariaLabel="Query History Limit value"
            min={20}
            max={1000}
            step={20}
            unit="items"
            value={settings.historyRetentionLimit}
            onChange={(v) => updateSettings({ historyRetentionLimit: v })}
          />
        </SettingRow>
        <SettingRow label="Load Columns Only When Expanded">
          <Checkbox
            ariaLabel="Lazy-Load Schema Explorer"
            checked={settings.lazyLoadExplorer}
            onChange={(v) => updateSettings({ lazyLoadExplorer: v })}
          />
        </SettingRow>
      </SettingSection>
    )}

    {showPerfStorage && (
      <SettingSection title="Saved History" sectionTag={isSearching ? 'Performance' : undefined}>
        <SettingRow label="Clear Saved Query History">
          <button
            type="button"
            onClick={() =>
              onRequestConfirm(
                'Clear Query History',
                'Delete all locally saved SQL history entries?',
                clearHistory,
              )
            }
            className="px-3 py-1.5 rounded-md border border-[var(--error)]/40 text-[var(--error)] hover:bg-[var(--error)]/10 text-xs font-medium"
          >
            Clear History
          </button>
        </SettingRow>
      </SettingSection>
    )}

    {showSecurityCreds && (
      <SettingSection title="Passwords & Safety" sectionTag={isSearching ? 'Security' : undefined}>
        <SettingRow
          label="System Password Vault"
          hint="Database passwords are encrypted by your OS"
        >
          <Badge variant="success">Active</Badge>
        </SettingRow>
      </SettingSection>
    )}

    {showSecurityConfirms && (
      <SettingSection
        title="Safety Confirmations"
        sectionTag={isSearching ? 'Security' : undefined}
      >
        <SettingRow label="Confirm Before Dropping Tables">
          <Checkbox
            ariaLabel="Confirm DROP TABLE"
            checked={settings.confirmDropTable}
            onChange={(v) => updateSettings({ confirmDropTable: v })}
          />
        </SettingRow>
        <SettingRow label="Confirm Before Emptying Tables">
          <Checkbox
            ariaLabel="Confirm TRUNCATE TABLE"
            checked={settings.confirmTruncateTable}
            onChange={(v) => updateSettings({ confirmTruncateTable: v })}
          />
        </SettingRow>
        <SettingRow label="Confirm Before Deleting Rows">
          <Checkbox
            ariaLabel="Confirm Row Deletion"
            checked={settings.confirmDeleteRow}
            onChange={(v) => updateSettings({ confirmDeleteRow: v })}
          />
        </SettingRow>
      </SettingSection>
    )}

    {showAdvancedAbout && (
      <SettingSection title="Shortcuts & About" sectionTag={isSearching ? 'Advanced' : undefined}>
        {onOpenShortcuts && (
          <SettingRow label="Keyboard Shortcuts">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenShortcuts();
              }}
              className="relative pl-3 pr-6 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent)]/50 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <Keyboard size={12} className="text-[var(--accent)]" />
              <span>Open Shortcuts Window</span>
              <ArrowUpRight
                size={10}
                aria-hidden="true"
                className="absolute top-1 right-1 text-[var(--accent)]"
              />
            </button>
          </SettingRow>
        )}
        <SettingRow label="About Quorix">
          <button
            type="button"
            onClick={() => onSelectTab('about')}
            className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Info size={12} /> Version, Owner &amp; Links…
          </button>
        </SettingRow>
      </SettingSection>
    )}

    {showAbout && (
      <>
        <SettingSection title="About Quorix" sectionTag={isSearching ? 'About' : undefined}>
          <div className="px-6 py-7 flex flex-col items-center text-center gap-3">
            <QuorixLogo variant="badge" alt="Quorix Logo" className="w-16 h-16 drop-shadow-sm" />
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-[var(--text)]">
                  {APP_INFO.name}
                </span>
                <Badge variant="accent">v{APP_INFO.version}</Badge>
              </div>
              <p className="text-[11.5px] text-[var(--text-muted)] max-w-md leading-relaxed">
                {APP_INFO.tagline}
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-panel)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)]">
              <span>Built by {APP_INFO.ownerName}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="font-mono text-[var(--accent)]">@{APP_INFO.ownerHandle}</span>
            </div>
          </div>
        </SettingSection>

        <SettingSection
          title="Social & Profile Links"
          sectionTag={isSearching ? 'About' : undefined}
        >
          {ABOUT_LINKS.map((link) => (
            <SettingRow key={link.id} label={link.label} hint={link.description}>
              <button
                type="button"
                onClick={() => void openExternalUrl(link.url)}
                className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent)]/60 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1.5 transition-colors"
              >
                <GithubIcon size={12} />
                <span className="font-mono text-[11px]">
                  {link.url.replace(/^https?:\/\//, '')}
                </span>
                <ExternalLink size={11} className="text-[var(--text-muted)]" />
              </button>
            </SettingRow>
          ))}
        </SettingSection>
      </>
    )}

    {showAdvancedReset && (
      <>
        <SettingSection
          title="Query Execution & Explain"
          sectionTag={isSearching ? 'Advanced' : undefined}
        >
          <SettingRow
            label="Explain Plan Mode"
            hint="PostgreSQL execution timing & buffers vs planner cost estimate only"
          >
            <SegmentedControl<'analyze' | 'estimate'>
              value={settings.explainAnalyze ? 'analyze' : 'estimate'}
              onChange={(mode) => updateSettings({ explainAnalyze: mode === 'analyze' })}
              options={[
                { value: 'analyze', label: 'Analyze + Buffers' },
                { value: 'estimate', label: 'Estimate Only' },
              ]}
            />
          </SettingRow>

          <SettingRow
            label="Warn on Unfiltered Writes"
            hint="Confirm before running SQL UPDATE or DELETE without a WHERE clause"
          >
            <Checkbox
              ariaLabel="Warn on Unfiltered Writes"
              checked={settings.confirmUnfilteredWrites}
              onChange={(v) => updateSettings({ confirmUnfilteredWrites: v })}
            />
          </SettingRow>

          <SettingRow
            label="Log Failed Queries to History"
            hint="Keep errored or cancelled statements in SQL Query History for debugging"
          >
            <Checkbox
              ariaLabel="Log Failed Queries to History"
              checked={settings.recordFailedHistory}
              onChange={(v) => updateSettings({ recordFailedHistory: v })}
            />
          </SettingRow>
        </SettingSection>

        <SettingSection title="Workspace & Cache" sectionTag={isSearching ? 'Advanced' : undefined}>
          <SettingRow
            label="Reset Workspace Layout"
            hint="Clear persisted open tabs, sidebar width, and inspector pane geometry"
          >
            <button
              type="button"
              onClick={() =>
                onRequestConfirm(
                  'Reset Workspace Layout',
                  'Clear saved workspace session tabs and panel dimensions? Saved connections and settings are kept.',
                  () => {
                    localStorage.removeItem(STORAGE_KEYS.WORKSPACE_SESSION);
                    toast.success('Workspace layout cache cleared');
                  },
                )
              }
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <RotateCcw size={12} /> Reset Layout
            </button>
          </SettingRow>

          <SettingRow
            label="Clear ER Diagram Positions"
            hint="Reset cached diagram node coordinates so schemas auto-layout freshly"
          >
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEYS.ER_POSITIONS);
                toast.success('Cleared ER diagram layout cache');
              }}
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Clear Positions
            </button>
          </SettingRow>

          <SettingRow
            label="Clear Recent Files & Favorites"
            hint="Remove locally cached SQLite recent file list, recent objects, and favorites"
          >
            <button
              type="button"
              onClick={() =>
                onRequestConfirm(
                  'Clear Recent Items',
                  'Clear cached recent SQLite files, recent objects, and starred items?',
                  () => {
                    localStorage.removeItem(STORAGE_KEYS.RECENT_FILES);
                    localStorage.removeItem(STORAGE_KEYS.RECENT_OBJECTS);
                    localStorage.removeItem(STORAGE_KEYS.FAVORITES);
                    toast.success('Cleared recent files and favorites');
                  },
                )
              }
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Clear Recents
            </button>
          </SettingRow>

          <SettingRow
            label="Reset Custom Keybindings"
            hint="Restore all modified or unbound keyboard shortcuts back to defaults"
          >
            <button
              type="button"
              disabled={Object.keys(getCustomKeybindings()).length === 0}
              onClick={() =>
                onRequestConfirm(
                  'Reset Keybindings',
                  'Restore all custom keyboard shortcuts back to factory defaults?',
                  () => {
                    resetAllKeybindings();
                    toast.success('Restored default keybindings');
                  },
                )
              }
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-medium inline-flex items-center gap-1.5"
            >
              <RotateCcw size={12} /> Reset Keymap ({Object.keys(getCustomKeybindings()).length})
            </button>
          </SettingRow>
        </SettingSection>

        <SettingSection
          title="Storage & Diagnostics"
          sectionTag={isSearching ? 'Advanced' : undefined}
        >
          {(() => {
            const diag = getStorageDiagnostics();
            const modifiedTotal = getModifiedSettingsCount(settings);
            return (
              <>
                <SettingRow
                  label="Local Storage Footprint"
                  hint="Persisted preferences, sessions, and caches stored locally"
                >
                  <Badge variant="neutral">
                    {diag.kb} KB · {diag.keyCount} keys
                  </Badge>
                </SettingRow>
                <SettingRow
                  label="Workspace Data Summary"
                  hint="Counts of saved profiles, queries, history, and customized controls"
                >
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                    {diag.savedProfiles} profiles · {diag.savedQueries} queries ·{' '}
                    {diag.historyItems} history
                  </span>
                </SettingRow>
                <SettingRow
                  label="Copy Runtime Diagnostics"
                  hint="Copy non-sensitive version, platform, and storage counts for bug reports"
                >
                  <button
                    type="button"
                    onClick={async () => {
                      const report = [
                        `App: ${APP_INFO.name} v${APP_INFO.version}`,
                        `Platform: ${typeof navigator !== 'undefined' ? navigator.platform : 'unknown'}`,
                        `Modified Settings: ${modifiedTotal}`,
                        `Custom Keybindings: ${diag.customBindings}`,
                        `Saved Profiles: ${diag.savedProfiles}`,
                        `Saved Queries: ${diag.savedQueries}`,
                        `History Items: ${diag.historyItems}`,
                        `Local Storage: ${diag.kb} KB (${diag.keyCount} keys)`,
                      ].join('\n');
                      try {
                        await navigator.clipboard.writeText(report);
                        toast.success('Copied diagnostics summary');
                      } catch {
                        toast.error('Clipboard unavailable');
                      }
                    }}
                    className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Copy size={12} /> Copy Diagnostics
                  </button>
                </SettingRow>
              </>
            );
          })()}
        </SettingSection>

        <SettingSection title="Factory Reset" sectionTag={isSearching ? 'Advanced' : undefined}>
          <SettingRow
            label="Reset All Settings"
            hint="Restore every Quorix preference back to factory defaults"
          >
            <button
              type="button"
              onClick={() =>
                onRequestConfirm(
                  'Restore Default Settings',
                  'Restore all settings back to factory defaults?',
                  () => updateSettings(DEFAULT_SETTINGS),
                )
              }
              className="px-3 py-1.5 rounded-md border border-[var(--error)]/40 text-[var(--error)] hover:bg-[var(--error)]/10 text-xs font-medium inline-flex items-center gap-1.5"
            >
              <RotateCcw size={12} /> Reset All
            </button>
          </SettingRow>
        </SettingSection>
      </>
    )}
  </>
);
