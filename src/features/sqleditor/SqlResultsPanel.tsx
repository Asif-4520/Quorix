import {
  AlertCircle,
  Copy,
  Download,
  GitMerge,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Table2,
} from 'lucide-react';
import type React from 'react';
import { formatColumnTypeMeta } from '../../services/columnTypeFormat';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import type {
  ConnectionSummary,
  ExplainResponse,
  MultiQueryResponse,
  QueryHistoryItem,
  QueryResult,
} from '../../types/database';
import { ExplainPlanViewer } from './ExplainPlanViewer';
import { SqlHistoryTab } from './SqlHistoryTab';

export type SqlBottomTab = 'results' | 'messages' | 'plan' | 'history';

interface SqlResultsPanelProps {
  bottomTab: SqlBottomTab;
  currentConnection: ConnectionSummary | null;
  runningQueryId: string | null;
  multiResult: MultiQueryResponse | null;
  keyedResults: Array<{ res: QueryResult; pos: number; id: string }>;
  activeResult: QueryResult | null;
  activeResultIdx: number;
  keyedColumns: Array<{ name: string; dataType: string; key: string }>;
  keyedRows: Array<{
    rowPos: number;
    rowKey: string;
    cells: Array<{ val: string | null; cellKey: string }>;
  }>;
  explainResult: ExplainResponse | null;
  queryError: string | null;
  historyFilter: string;
  historyTotalCount: number;
  filteredHistory: QueryHistoryItem[];
  onBottomTabChange: (tab: SqlBottomTab) => void;
  onActiveResultIdxChange: (idx: number) => void;
  onCopyResultsJson: () => void;
  onExportResults: (format: 'csv' | 'json') => void;
  onHistoryFilterChange: (value: string) => void;
  onClearHistory: () => void;
  onSelectHistorySql: (sql: string) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const SqlResultsPanel: React.FC<SqlResultsPanelProps> = ({
  bottomTab,
  currentConnection,
  runningQueryId,
  multiResult,
  keyedResults,
  activeResult,
  activeResultIdx,
  keyedColumns,
  keyedRows,
  explainResult,
  queryError,
  historyFilter,
  historyTotalCount,
  filteredHistory,
  onBottomTabChange,
  onActiveResultIdxChange,
  onCopyResultsJson,
  onExportResults,
  onHistoryFilterChange,
  onClearHistory,
  onSelectHistorySql,
  isMaximized,
  onToggleMaximize,
}) => {
  const sc = (id: string) => formatShortcutForDisplay(getEffectiveShortcut(id));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]">
      <div className="h-8 shrink-0 px-3 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between text-[11.5px] select-none">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'results', label: 'Results', icon: Table2 },
              { id: 'messages', label: 'Messages', icon: AlertCircle },
              { id: 'plan', label: 'Explain Plan', icon: GitMerge },
              {
                id: 'history',
                label: `History (${historyTotalCount})`,
                icon: History,
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => onBottomTabChange(t.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  bottomTab === t.id
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon size={11} />
                {t.label}
              </button>
            );
          })}

          {keyedResults.length > 1 && bottomTab === 'results' && (
            <div className="ml-3 flex items-center gap-1">
              {keyedResults.map(({ res, pos, id }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => onActiveResultIdxChange(pos)}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-mono ${
                    activeResultIdx === pos
                      ? 'bg-[var(--accent)] text-[var(--accent-text)] font-semibold'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                  }`}
                >
                  Set #{pos + 1} ({res.rows.length})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeResult && activeResult.columns.length > 0 && bottomTab === 'results' && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className="font-mono">
                {activeResult.rows.length} rows · {activeResult.durationMs} ms
                {activeResult.truncated ? ' (capped)' : ''}
              </span>
              <button
                type="button"
                onClick={onCopyResultsJson}
                className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1"
              >
                <Copy size={10} /> Copy
              </button>
              <button
                type="button"
                onClick={() => onExportResults('csv')}
                className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1"
              >
                <Download size={10} /> CSV
              </button>
              <button
                type="button"
                onClick={() => onExportResults('json')}
                className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1"
              >
                <Download size={10} /> JSON
              </button>
            </div>
          )}

          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className="p-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              title={
                isMaximized
                  ? 'Restore editor split view'
                  : 'Maximize results & diagram (take full height)'
              }
              aria-label={isMaximized ? 'Restore editor split' : 'Maximize results panel'}
            >
              {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          )}
        </div>
      </div>

      <div
        className={`flex-1 min-h-0 select-text ${
          bottomTab === 'plan' ? 'flex flex-col overflow-hidden' : 'overflow-auto'
        }`}
      >
        {runningQueryId ? (
          <div className="h-full flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 size={15} className="animate-spin text-[var(--accent)]" />
            <span>Executing SQL against {currentConnection?.name}…</span>
          </div>
        ) : bottomTab === 'results' ? (
          activeResult && activeResult.columns.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="sticky top-0 bg-[var(--bg-panel)] border-b border-[var(--border)]">
                <tr>
                  <th className="py-1.5 px-2.5 text-[10px] text-[var(--text-muted)] border-r border-[var(--border-subtle)] w-10">
                    #
                  </th>
                  {keyedColumns.map((col) => {
                    const tmeta = formatColumnTypeMeta(col.dataType);
                    return (
                      <th
                        key={col.key}
                        title={`${col.name} (${tmeta.fullType})`}
                        className="py-1.5 px-2.5 border-r border-[var(--border-subtle)] whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[var(--text)]">
                            {col.name}
                          </span>
                          <span
                            className={`px-1 py-0 rounded border text-[9px] font-mono font-medium leading-tight ${tmeta.badgeClass}`}
                          >
                            {tmeta.shortLabel}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {keyedRows.map((row) => (
                  <tr key={row.rowKey} className="hover:bg-[var(--bg-hover)]/60">
                    <td className="py-1 px-2.5 text-[10.5px] text-[var(--text-muted)] border-r border-[var(--border-subtle)]">
                      {row.rowPos + 1}
                    </td>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.cellKey}
                        className="py-1 px-2.5 border-r border-[var(--border-subtle)] max-w-xs truncate"
                      >
                        {cell.val === null ? (
                          <span className="px-1 rounded bg-[var(--null-badge-bg)] text-[var(--null-badge-text)] italic text-[10.5px]">
                            NULL
                          </span>
                        ) : (
                          cell.val
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] p-6">
              Run a SQL query ({sc('execute-query')}) to inspect result sets here.
            </div>
          )
        ) : bottomTab === 'messages' ? (
          <div className="p-4 space-y-2 text-xs font-mono">
            {queryError && (
              <div className="p-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] whitespace-pre-wrap">
                {queryError}
              </div>
            )}
            {keyedResults.map(({ res, pos, id }) => (
              <div
                key={id}
                className="p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] flex items-center justify-between"
              >
                <span>
                  Statement #{pos + 1} ({res.statementType}):{' '}
                  {res.columns.length > 0
                    ? `${res.rows.length} row(s) returned`
                    : `${res.affectedRows} row(s) affected`}
                </span>
                <span className="text-[var(--text-muted)]">{res.durationMs} ms</span>
              </div>
            ))}
            {!queryError && !multiResult && (
              <div className="text-[var(--text-muted)]">No execution messages yet.</div>
            )}
          </div>
        ) : bottomTab === 'plan' ? (
          <div className="h-full flex-1 flex flex-col min-h-0 overflow-hidden">
            {explainResult ? (
              <ExplainPlanViewer explainResult={explainResult} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] p-6">
                Click Explain ({sc('explain-query')}) to view the query execution plan.
              </div>
            )}
          </div>
        ) : (
          <SqlHistoryTab
            historyFilter={historyFilter}
            totalCount={historyTotalCount}
            filteredHistory={filteredHistory}
            onFilterChange={onHistoryFilterChange}
            onClearHistory={onClearHistory}
            onSelectHistorySql={onSelectHistorySql}
          />
        )}
      </div>
    </div>
  );
};
