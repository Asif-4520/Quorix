import { Clock, Loader2, Lock, Palette, RefreshCw, Square, Table } from 'lucide-react';
import type React from 'react';
import { SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import { getEnvironmentMeta } from '../../services/envTag';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import type { ConnectionSummary } from '../../types/database';

interface StatusBarProps {
  currentConnection: ConnectionSummary | null;
  activeConnectionCount: number;
  activeTabTitle?: string;
  activeTabType?: string;
  rowsInfo?: string;
  cellInfo?: string;
  durationMs?: number;
  txState?: string;
  runningQueryId?: string;
  runningLabel?: string;
  tableCount?: number;
  viewCount?: number;
  themeName?: string;
  onCancelRunningQuery?: (queryId: string) => void;
  onNewSqlTab?: () => void;
  onRefreshSchema?: () => void;
  onCycleTheme?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  currentConnection,
  activeConnectionCount,
  activeTabTitle,
  activeTabType,
  rowsInfo,
  cellInfo,
  durationMs,
  txState,
  runningQueryId,
  runningLabel,
  tableCount,
  viewCount,
  themeName,
  onCancelRunningQuery,
  onNewSqlTab,
  onRefreshSchema,
  onCycleTheme,
}) => {
  const sc = (id: string) => formatShortcutForDisplay(getEffectiveShortcut(id));
  const hasLeftStatusBadges = Boolean(
    activeConnectionCount > 1 ||
      (currentConnection?.environment && currentConnection.environment !== 'local') ||
      currentConnection?.readOnly,
  );
  const hasTelemetry = Boolean(
    rowsInfo || cellInfo || durationMs !== undefined || txState || activeTabTitle,
  );

  return (
    <footer className="h-7 shrink-0 bg-[var(--bg-sidebar)] border-t border-[var(--border)] px-2.5 flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)] select-none">
      <div className="flex items-center gap-2 min-w-0">
        {activeConnectionCount > 1 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            title={`${activeConnectionCount} active connections`}
          >
            {activeConnectionCount} sessions
          </span>
        )}

        {currentConnection?.environment && currentConnection.environment !== 'local' && (
          <span
            className={`text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${getEnvironmentMeta(currentConnection.environment).badgeClass}`}
            title={`Environment: ${getEnvironmentMeta(currentConnection.environment).label}`}
          >
            {getEnvironmentMeta(currentConnection.environment).shortLabel}
          </span>
        )}

        {currentConnection?.readOnly && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
            <Lock size={9} /> Read-Only
          </span>
        )}

        {currentConnection && tableCount !== undefined && !runningQueryId && (
          <>
            {hasLeftStatusBadges && (
              <span className="h-3 w-px bg-[var(--border)] hidden sm:inline-block" />
            )}
            <button
              type="button"
              onClick={onRefreshSchema}
              disabled={!onRefreshSchema}
              className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors disabled:pointer-events-none"
              title={`Refresh Schema (${sc('refresh-schema')})`}
            >
              <Table size={10} className="text-[var(--accent)]" />
              <span>
                {tableCount} {tableCount === 1 ? 'table' : 'tables'}
                {viewCount ? ` · ${viewCount} ${viewCount === 1 ? 'view' : 'views'}` : ''}
              </span>
              {onRefreshSchema && <RefreshCw size={9} className="opacity-65 ml-0.5" />}
            </button>
          </>
        )}

        {runningQueryId && (
          <>
            <span className="h-3 w-px bg-[var(--border)]" />
            <div className="inline-flex items-center gap-1.5 text-[var(--accent)]">
              <Loader2 size={11} className="animate-spin shrink-0" />
              <span className="truncate max-w-[160px] font-medium">
                {runningLabel || 'Running query…'}
              </span>
              {onCancelRunningQuery && (
                <button
                  type="button"
                  onClick={() => onCancelRunningQuery(runningQueryId)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--error)]/15 text-[var(--error)] hover:bg-[var(--error)]/25 text-[10px] font-medium"
                  title="Cancel active query"
                >
                  <Square size={8} fill="currentColor" /> Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasTelemetry && (
          <div className="flex items-center gap-2 font-mono text-[10.5px]">
            {activeTabTitle && (
              <span className="hidden lg:inline font-sans text-[var(--text-secondary)] truncate max-w-[160px]">
                {activeTabType === 'sql' ? 'SQL · ' : ''}
                {activeTabTitle}
              </span>
            )}
            {rowsInfo && (
              <span className="text-[var(--text-secondary)] whitespace-nowrap">{rowsInfo}</span>
            )}
            {cellInfo && (
              <span className="hidden xl:inline text-[var(--text-muted)] whitespace-nowrap">
                {cellInfo}
              </span>
            )}
            {durationMs !== undefined && (
              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)] whitespace-nowrap">
                <Clock size={10} />
                {durationMs} ms
              </span>
            )}
            {txState && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] whitespace-nowrap">
                {txState}
              </span>
            )}
          </div>
        )}

        {hasTelemetry && <span className="h-3 w-px bg-[var(--border)]" />}

        <div className="flex items-center gap-1">
          {onNewSqlTab && (
            <button
              type="button"
              onClick={onNewSqlTab}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
              title={`New SQL Query (${sc('new-sql-tab')})`}
            >
              <SqlQueryIcon size={11} className="text-[var(--info)]" />
              <span className="hidden sm:inline">New SQL</span>
            </button>
          )}

          {onCycleTheme && themeName && (
            <button
              type="button"
              onClick={onCycleTheme}
              className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
              title={`Cycle Theme (${sc('cycle-theme')})`}
            >
              <Palette size={11} className="text-[var(--accent)]" />
              <span>{themeName}</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
