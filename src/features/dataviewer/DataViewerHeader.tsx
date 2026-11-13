import {
  BarChart3,
  Columns,
  Download,
  Filter,
  ListTree,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Table,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { RelationsIcon, SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import type { ConnectionSummary, TableSubTab } from '../../types/database';

interface DataViewerHeaderProps {
  tableName: string;
  schema?: string;
  tableKind: string;
  activeTab: TableSubTab;
  onSelectTab: (tab: TableSubTab) => void;
  totalRows?: number;
  loading: boolean;
  editable: boolean;
  readonlyReason?: string | null;
  currentConnection: ConnectionSummary;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  showFilterBuilder: boolean;
  onToggleFilterBuilder: () => void;
  activeFilterCount: number;
  showColPicker: boolean;
  onToggleColPicker: () => void;
  visibleColCount: number;
  totalColCount: number;
  pendingChangeCount: number;
  committingChanges: boolean;
  onCommitChanges: () => void;
  onDiscardChanges: () => void;
  selectedRowCount: number;
  onInsertRow: () => void;
  onDeleteSelectedRows: () => void;
  onRefresh: () => void;
  onToggleInspector?: () => void;
  inspectorOpen?: boolean;
  onExport: (format: 'csv' | 'json') => void;
  onImport: (format: 'csv' | 'json') => void;
}

const SUB_TABS: Array<{
  id: TableSubTab;
  label: string;
  shortcutId: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { id: 'data', label: 'Data', shortcutId: 'view-data', icon: Table },
  {
    id: 'structure',
    label: 'Structure',
    shortcutId: 'view-structure',
    icon: Columns,
  },
  {
    id: 'relations',
    label: 'Relationships',
    shortcutId: 'view-relations',
    icon: RelationsIcon,
  },
  { id: 'indexes', label: 'Indexes', shortcutId: 'view-indexes', icon: ListTree },
  {
    id: 'constraints',
    label: 'Constraints',
    shortcutId: 'view-constraints',
    icon: ShieldCheck,
  },
  {
    id: 'statistics',
    label: 'Statistics',
    shortcutId: 'view-statistics',
    icon: BarChart3,
  },
  { id: 'ddl', label: 'DDL', shortcutId: 'view-ddl', icon: SqlQueryIcon },
];

export const DataViewerHeader: React.FC<DataViewerHeaderProps> = ({
  tableName,
  schema,
  tableKind,
  activeTab,
  onSelectTab,
  totalRows,
  loading,
  editable,
  readonlyReason,
  currentConnection,
  searchQuery,
  onSearchChange,
  searchInputRef,
  showFilterBuilder,
  onToggleFilterBuilder,
  activeFilterCount,
  showColPicker,
  onToggleColPicker,
  visibleColCount,
  totalColCount,
  pendingChangeCount,
  committingChanges,
  onCommitChanges,
  onDiscardChanges,
  selectedRowCount,
  onInsertRow,
  onDeleteSelectedRows,
  onRefresh,
  onExport,
  onImport,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const sc = (id: string) => formatShortcutForDisplay(getEffectiveShortcut(id));
  const canWrite = editable && !currentConnection.readOnly;
  const fullTableTitle = `${schema ? `${schema}.` : ''}${tableName}`;

  return (
    <div className="shrink-0 bg-[var(--bg-panel)] border-b border-[var(--border)] select-none">
      <div className="h-9 px-3 flex items-center justify-between gap-2 bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-0.5 overflow-x-auto min-w-0">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => onSelectTab(t.id)}
                title={`${t.label} (${sc(t.shortcutId)})`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[var(--accent)] text-[var(--text)] bg-[var(--bg-panel)]/70'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon size={12} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={tableKind === 'table' ? 'neutral' : 'info'} title={fullTableTitle}>
            {tableKind}
          </Badge>
          {totalRows !== undefined && (
            <Badge variant="type">{totalRows.toLocaleString()} rows</Badge>
          )}
          {!canWrite && (
            <Badge variant="warning" title={readonlyReason || 'Read-only'}>
              <Lock size={9} /> Read-Only
            </Badge>
          )}

          {pendingChangeCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/30">
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {pendingChangeCount} pending
              </span>
              <button
                type="button"
                disabled={committingChanges}
                onClick={onDiscardChanges}
                className="px-1.5 py-0.5 rounded text-[10.5px] hover:bg-black/10 text-[var(--text-secondary)] inline-flex items-center gap-1"
                title="Discard staged changes"
              >
                <RotateCcw size={10} /> Discard
              </button>
              <button
                type="button"
                disabled={committingChanges}
                onClick={onCommitChanges}
                className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] inline-flex items-center gap-1"
                title={`Commit changes in transaction (${sc('save-action')})`}
              >
                <Save size={10} /> {committingChanges ? 'Saving…' : 'Commit'}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text)] disabled:opacity-50 inline-flex items-center gap-1"
            title={`Reload Table Data (${sc('refresh-schema')})`}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Reload</span>
          </button>
        </div>
      </div>

      {activeTab === 'data' && (
        <div className="h-9 px-3 flex items-center justify-between gap-2 bg-[var(--bg-panel)]">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="relative w-48">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={`Find in ${tableName}… (${sc('find-in-table')})`}
                className="w-full pl-6 pr-5 py-1 text-[11px] bg-[var(--bg)] border border-[var(--border)] rounded-md"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  title="Clear search"
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleFilterBuilder}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
                showFilterBuilder || activeFilterCount > 0
                  ? 'bg-[var(--accent-muted)] border-[var(--accent)]/40 text-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
              title={`Structured Filters (${sc('toggle-filter-builder')})`}
            >
              <Filter size={11} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="px-1 rounded-full bg-[var(--accent)] text-[var(--accent-text)] text-[9.5px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleColPicker}
              className={`px-2 py-1 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
                showColPicker
                  ? 'bg-[var(--accent-muted)] border-[var(--accent)]/40 text-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
              title={`Columns & Order (${sc('column-visibility')})`}
            >
              <Columns size={11} />
              <span>
                Columns ({visibleColCount}/{totalColCount})
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canWrite && (
              <>
                <button
                  type="button"
                  onClick={onInsertRow}
                  className="px-2.5 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-[11px] font-semibold inline-flex items-center gap-1"
                  title={`Insert Row (${sc('insert-row')})`}
                >
                  <Plus size={12} /> Insert
                </button>
                {selectedRowCount > 0 && (
                  <button
                    type="button"
                    onClick={onDeleteSelectedRows}
                    className="px-2 py-1 rounded-md bg-[var(--error)]/15 text-[var(--error)] border border-[var(--error)]/30 hover:bg-[var(--error)]/25 text-[11px] font-medium inline-flex items-center gap-1"
                    title={`Delete Selected (${sc('delete-row')})`}
                  >
                    <Trash2 size={11} /> Delete ({selectedRowCount})
                  </button>
                )}
              </>
            )}

            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((s) => !s)}
                className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1 text-[11px]"
                title="Export / Import Data"
              >
                <Download size={11} />
                <span className="hidden md:inline">Export</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-xl p-1 z-30 animate-fade-in text-xs">
                  <button
                    type="button"
                    className="menubar-dropdown-item"
                    onClick={() => {
                      setShowExportMenu(false);
                      onExport('csv');
                    }}
                  >
                    <Download size={12} /> <span>Export CSV…</span>
                  </button>
                  <button
                    type="button"
                    className="menubar-dropdown-item"
                    onClick={() => {
                      setShowExportMenu(false);
                      onExport('json');
                    }}
                  >
                    <Download size={12} /> <span>Export JSON…</span>
                  </button>
                  {canWrite && (
                    <>
                      <div className="menubar-separator" />
                      <button
                        type="button"
                        className="menubar-dropdown-item"
                        onClick={() => {
                          setShowExportMenu(false);
                          onImport('csv');
                        }}
                      >
                        <Upload size={12} /> <span>Import CSV…</span>
                      </button>
                      <button
                        type="button"
                        className="menubar-dropdown-item"
                        onClick={() => {
                          setShowExportMenu(false);
                          onImport('json');
                        }}
                      >
                        <Upload size={12} /> <span>Import JSON…</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
