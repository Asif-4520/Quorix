import { ArrowUpRight, Keyboard, RotateCcw, Search, Sliders, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/Badge';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { AppearanceSection } from './sections/AppearanceSection';
import { EditorGridSections } from './sections/EditorGridSections';
import { SystemSections } from './sections/SystemSections';
import {
  EDITOR_FONT_PRESETS,
  SECTIONS,
  type SettingsTabId,
  UI_FONT_PRESETS,
} from './settingsConfig';
import {
  getModifiedPatchForTab,
  getModifiedSettingsCount,
  hasAnyModifiedKey,
  TAB_METADATA,
} from './settingsMetadata';

export type { SettingsTabId } from './settingsConfig';

interface SettingsModalProps {
  isOpen: boolean;
  standaloneWindow?: boolean;
  initialTab?: string;
  onClose: () => void;
  onOpenShortcuts?: () => void;
  onClearHistory?: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  standaloneWindow = false,
  initialTab,
  onClose,
  onOpenShortcuts,
  onClearHistory,
  onRequestConfirm,
}) => {
  const settings = useSettingsStore((s) => s.settings);
  const effectiveTheme = useSettingsStore((s) => s.effectiveTheme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setGlobalFontSize = useSettingsStore((s) => s.setGlobalFontSize);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const setThemePreset = useSettingsStore((s) => s.setThemePreset);
  const storeClearHistory = useWorkspaceStore((s) => s.clearHistory);

  const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [customUiFontOpen, setCustomUiFontOpen] = useState(false);
  const [customEditorFontOpen, setCustomEditorFontOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tabButtonRefs = useRef<Map<SettingsTabId, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (isOpen) {
      const valid = SECTIONS.find((s) => s.id === initialTab);
      if (valid) setActiveTab(valid.id);
      setSearchQuery('');
      setModifiedOnly(false);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (!isTyping && e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < SECTIONS.length) {
          e.preventDefault();
          setSearchQuery('');
          setModifiedOnly(false);
          setActiveTab(SECTIONS[idx].id);
          return;
        }
        if (standaloneWindow && e.key.toLowerCase() === 'w') {
          e.preventDefault();
          onClose();
          return;
        }
      }

      const inSidebarNav = Boolean(target?.closest('[data-settings-nav="true"]'));
      if (
        (inSidebarNav || !isTyping) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp')
      ) {
        const currentTag = target?.tagName;
        if (inSidebarNav || currentTag === 'BODY' || currentTag === 'DIV') {
          e.preventDefault();
          const curIdx = SECTIONS.findIndex((s) => s.id === activeTab);
          const nextIdx =
            e.key === 'ArrowDown'
              ? (curIdx + 1) % SECTIONS.length
              : (curIdx - 1 + SECTIONS.length) % SECTIONS.length;
          const nextId = SECTIONS[nextIdx].id;
          setSearchQuery('');
          setModifiedOnly(false);
          setActiveTab(nextId);
          requestAnimationFrame(() => tabButtonRefs.current.get(nextId)?.focus());
          return;
        }
      }

      if (e.key === 'Escape') {
        e.stopPropagation();
        if (searchQuery.trim() || modifiedOnly) {
          setSearchQuery('');
          setModifiedOnly(false);
        } else if (!standaloneWindow) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeTab, searchQuery, modifiedOnly, standaloneWindow, onClose]);

  if (!isOpen) return null;

  const q = searchQuery.trim().toLowerCase();
  const isModifiedQuery = modifiedOnly || q === '@modified';
  const isSearchingText = q.length > 0 && q !== '@modified';
  const isCrossSectionView = isSearchingText || isModifiedQuery;

  const inView = (
    id: SettingsTabId,
    modifiedKeys: ReadonlyArray<keyof typeof settings>,
    ...terms: string[]
  ): boolean => {
    if (isModifiedQuery && modifiedKeys.length > 0 && !hasAnyModifiedKey(settings, modifiedKeys)) {
      return false;
    }
    if (isModifiedQuery && modifiedKeys.length === 0 && !isSearchingText) {
      return false;
    }
    if (isSearchingText) {
      return terms.some((t) => t.toLowerCase().includes(q));
    }
    if (isModifiedQuery) return true;
    return activeTab === id;
  };

  const showAppearanceTheme = inView(
    'appearance',
    ['themeMode', 'theme', 'darkTheme', 'lightTheme'],
    'appearance',
    'theme',
    'mode',
    'dark',
    'light',
    'system',
    'palette',
    'color',
  );
  const showAppearanceFont = inView(
    'appearance',
    ['globalFontSize', 'syncFontSizes', 'uiFontSize', 'uiFontFamily', 'uiRadius'],
    'appearance',
    'global',
    'font',
    'size',
    'scale',
    'zoom',
    'radius',
    'corner',
    'typography',
  );
  const showAppearanceChrome = inView(
    'appearance',
    ['toolRailVisible', 'statusBarVisible'],
    'appearance',
    'rail',
    'sidebar',
    'status bar',
    'layout',
    'chrome',
  );

  const showEditorFont = inView(
    'editor',
    ['editorFontFamily', 'editorFontSize', 'editorLineHeight', 'editorTabSize'],
    'editor',
    'sql',
    'font',
    'size',
    'line height',
    'spacing',
    'tab',
    'indent',
  );
  const showEditorBehavior = inView(
    'editor',
    ['editorLineNumbers', 'editorWordWrap', 'editorAutocomplete'],
    'editor',
    'sql',
    'line numbers',
    'wrap',
    'autocomplete',
    'suggestions',
  );

  const showGridDisplay = inView(
    'grid',
    ['defaultPageSize', 'gridFontSize', 'gridFontFamily', 'gridStripedRows', 'gridShowRowNumbers'],
    'grid',
    'table',
    'page',
    'rows',
    'font',
    'striped',
    'shading',
    'row numbers',
  );
  const showGridValues = inView(
    'grid',
    ['nullDisplay', 'dateFormat', 'editMode'],
    'grid',
    'null',
    'empty',
    'date',
    'time',
    'timestamp',
    'edit',
    'save',
    'staged',
  );

  const showDatabase = inView(
    'database',
    ['connectionTimeout', 'queryTimeout', 'pgbouncerDefault'],
    'database',
    'timeout',
    'connection',
    'query',
    'pgbouncer',
    'pooling',
  );
  const showWorkspace = inView(
    'workspace',
    ['restoreWorkspace', 'reuseExistingTableTab'],
    'workspace',
    'restore',
    'startup',
    'tabs',
    'session',
    'reuse',
  );
  const showPerfLimits = inView(
    'performance',
    ['maxResultRows', 'historyRetentionLimit', 'lazyLoadExplorer'],
    'performance',
    'max rows',
    'limit',
    'memory',
    'history',
    'lazy',
    'expand',
  );
  const showPerfStorage = inView('performance', [], 'performance', 'clear', 'history');
  const showSecurityCreds = inView(
    'security',
    [],
    'security',
    'keyring',
    'vault',
    'password',
    'credential',
  );
  const showSecurityConfirms = inView(
    'security',
    ['confirmDropTable', 'confirmTruncateTable', 'confirmDeleteRow'],
    'security',
    'confirm',
    'ask',
    'safety',
    'drop',
    'truncate',
    'delete',
  );
  const showAdvancedAbout = inView('advanced', [], 'advanced', 'shortcuts', 'keymap', 'version');
  const showAdvancedReset = inView(
    'advanced',
    ['explainAnalyze', 'confirmUnfilteredWrites', 'recordFailedHistory'],
    'advanced',
    'query',
    'execution',
    'explain',
    'analyze',
    'buffers',
    'unfiltered',
    'where',
    'errors',
    'reset',
    'default',
    'factory',
    'workspace',
    'layout',
    'cache',
    'er',
    'recent',
    'keybindings',
    'diagnostics',
    'storage',
  );
  const showAbout = inView(
    'about',
    [],
    'about',
    'version',
    'owner',
    'asif',
    'github',
    'links',
    'author',
    'repo',
    'quorix',
    'stack',
    'docs',
  );

  const hasAnyResult =
    showAppearanceTheme ||
    showAppearanceFont ||
    showAppearanceChrome ||
    showEditorFont ||
    showEditorBehavior ||
    showGridDisplay ||
    showGridValues ||
    showDatabase ||
    showWorkspace ||
    showPerfLimits ||
    showPerfStorage ||
    showSecurityCreds ||
    showSecurityConfirms ||
    showAdvancedAbout ||
    showAdvancedReset ||
    showAbout;

  const isPresetUiFont = UI_FONT_PRESETS.some((p) => p.value === settings.uiFontFamily);
  const isPresetEditorFont = EDITOR_FONT_PRESETS.some((p) => p.value === settings.editorFontFamily);
  const globalSize = settings.globalFontSize || settings.uiFontSize;
  const modifiedCount = getModifiedSettingsCount(settings);
  const activeSectionMeta = SECTIONS.find((s) => s.id === activeTab) || SECTIONS[0];
  const activeTabIsModified = hasAnyModifiedKey(settings, TAB_METADATA[activeTab].keys);

  const handleClearHistory = onClearHistory ?? storeClearHistory;

  const container = (
    <div
      role={standaloneWindow ? 'region' : 'dialog'}
      aria-modal={standaloneWindow ? undefined : true}
      aria-label="Settings"
      className={
        standaloneWindow
          ? 'flex-1 min-h-0 flex flex-col bg-[var(--bg)] overflow-hidden'
          : 'w-full max-w-4xl h-[82vh] bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in'
      }
      onClick={(e) => {
        if (!standaloneWindow) e.stopPropagation();
      }}
    >
      <div className="px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Sliders size={15} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-[var(--text)]">Settings</h2>
            <Badge variant="success">Auto-saved</Badge>
            {modifiedCount > 0 && <Badge variant="accent">{modifiedCount} modified</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-56 sm:w-64">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings or @modified…"
              className="w-full pl-8 pr-7 py-1 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            aria-pressed={modifiedOnly}
            aria-label="Filter Modified Settings"
            title="Show only settings changed from defaults (@modified)"
            onClick={() => setModifiedOnly((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 ${
              modifiedOnly
                ? 'bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent)]'
                : 'bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <span>Modified</span>
            {modifiedCount > 0 && <span className="font-mono opacity-85">({modifiedCount})</span>}
          </button>

          {!standaloneWindow && (
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close Settings"
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <nav
          aria-label="Settings Categories"
          data-settings-nav="true"
          className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-sidebar)] px-3 py-4 flex flex-col justify-between gap-3 overflow-y-auto"
        >
          <div className="space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = !isCrossSectionView && activeTab === s.id;
              return (
                <div
                  key={s.id}
                  className={
                    s.id === 'about' ? 'pt-2 mt-2 border-t border-[var(--border-subtle)]' : ''
                  }
                >
                  <button
                    ref={(el) => {
                      if (el) tabButtonRefs.current.set(s.id, el);
                      else tabButtonRefs.current.delete(s.id);
                    }}
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setModifiedOnly(false);
                      setActiveTab(s.id);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="truncate">{s.label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {onOpenShortcuts && (
            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                title="Open Keyboard Shortcuts in a separate window"
                onClick={() => {
                  if (!standaloneWindow) onClose();
                  onOpenShortcuts();
                }}
                className="group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent)]/60 text-xs font-medium text-[var(--text)] transition-colors"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Keyboard size={14} className="text-[var(--accent)] shrink-0" />
                  <span className="truncate">Keybindings</span>
                </span>
                <ArrowUpRight
                  size={12}
                  aria-hidden="true"
                  className="text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>
            </div>
          )}
        </nav>

        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <div className="max-w-2xl mx-auto space-y-6 text-xs">
            {!isCrossSectionView ? (
              <div className="sticky top-0 z-10 -mx-8 px-8 pt-5 pb-3.5 bg-[var(--bg)]/95 backdrop-blur-sm border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Settings / {activeSectionMeta.label}
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    {TAB_METADATA[activeTab].description}
                  </p>
                </div>

                {activeTabIsModified && (
                  <button
                    type="button"
                    onClick={() =>
                      onRequestConfirm(
                        `Reset ${activeSectionMeta.label} Settings`,
                        `Restore all ${activeSectionMeta.label} preferences to defaults?`,
                        () => {
                          updateSettings(getModifiedPatchForTab(activeTab));
                          toast.info(`Reset ${activeSectionMeta.label} settings to defaults`);
                        },
                      )
                    }
                    className="px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1.5"
                  >
                    <RotateCcw size={11} /> Reset Section
                  </button>
                )}
              </div>
            ) : (
              <div className="sticky top-0 z-10 pt-5 pb-2 bg-[var(--bg)]/95 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-muted)]">
                  <span>
                    {isModifiedQuery && !isSearchingText
                      ? 'Showing only customized settings differing from defaults'
                      : `Filtered results across all settings for “${searchQuery}”`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setModifiedOnly(false);
                    }}
                    className="text-[var(--accent)] hover:underline font-medium shrink-0"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}

            {!hasAnyResult && (
              <div className="py-14 text-center text-xs text-[var(--text-muted)] space-y-2.5">
                <div>
                  {isModifiedQuery && !isSearchingText
                    ? 'All settings match factory defaults.'
                    : `No settings match “${searchQuery}”`}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setModifiedOnly(false);
                  }}
                  className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
                >
                  Clear Filters
                </button>
              </div>
            )}

            <AppearanceSection
              settings={settings}
              effectiveTheme={effectiveTheme}
              globalSize={globalSize}
              isPresetUiFont={isPresetUiFont}
              customUiFontOpen={customUiFontOpen}
              setCustomUiFontOpen={setCustomUiFontOpen}
              showFont={showAppearanceFont}
              showTheme={showAppearanceTheme}
              showChrome={showAppearanceChrome}
              isSearching={isCrossSectionView}
              updateSettings={updateSettings}
              setGlobalFontSize={setGlobalFontSize}
              setThemeMode={setThemeMode}
              setThemePreset={setThemePreset}
            />

            <EditorGridSections
              settings={settings}
              globalSize={globalSize}
              isPresetEditorFont={isPresetEditorFont}
              customEditorFontOpen={customEditorFontOpen}
              setCustomEditorFontOpen={setCustomEditorFontOpen}
              showEditorFont={showEditorFont}
              showEditorBehavior={showEditorBehavior}
              showGridDisplay={showGridDisplay}
              showGridValues={showGridValues}
              isSearching={isCrossSectionView}
              updateSettings={updateSettings}
            />

            <SystemSections
              settings={settings}
              isSearching={isCrossSectionView}
              showDatabase={showDatabase}
              showWorkspace={showWorkspace}
              showPerfLimits={showPerfLimits}
              showPerfStorage={showPerfStorage}
              showSecurityCreds={showSecurityCreds}
              showSecurityConfirms={showSecurityConfirms}
              showAdvancedAbout={showAdvancedAbout}
              showAdvancedReset={showAdvancedReset}
              showAbout={showAbout}
              updateSettings={updateSettings}
              clearHistory={handleClearHistory}
              onClose={standaloneWindow ? () => {} : onClose}
              onOpenShortcuts={onOpenShortcuts}
              onSelectTab={(tab) => {
                setSearchQuery('');
                setModifiedOnly(false);
                setActiveTab(tab);
              }}
              onRequestConfirm={onRequestConfirm}
            />
          </div>
        </div>
      </div>

      {standaloneWindow && (
        <div className="px-6 py-2 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between text-[11px] text-[var(--text-muted)] shrink-0 select-none">
          <span>
            Ctrl+F or / to search · Ctrl+1–9 to switch sections · Changes sync live across all
            Quorix windows
          </span>
          <span>Ctrl+W to close window</span>
        </div>
      )}
    </div>
  );

  if (standaloneWindow) {
    return container;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-5"
      onClick={onClose}
    >
      {container}
    </div>
  );
};
