import { AlignLeft, BookmarkPlus, GitMerge, Play, SlidersHorizontal, Square } from 'lucide-react';
import type React from 'react';
import { getEnvironmentMeta } from '../../services/envTag';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import type { ConnectionSummary } from '../../types/database';

interface PendingParamExec {
  sqlText: string;
  mode: 'run' | 'explain';
  params: string[];
}

interface SqlEditorToolbarProps {
  currentConnection: ConnectionSummary | null;
  runningQueryId: string | null;
  pendingParamExec: PendingParamExec | null;
  paramValues: Record<string, string>;
  showSaveDialog: boolean;
  saveTitle: string;
  saveFolder: string;
  onRunCurrent: () => void;
  onRunAll: () => void;
  onCancelQuery: (queryId: string) => void;
  onExplain: () => void;
  onFormatSql: () => void;
  onOpenSave: () => void;
  onParamValuesChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onSubmitParams: () => void;
  onCancelParams: () => void;
  onSaveTitleChange: (value: string) => void;
  onSaveFolderChange: (value: string) => void;
  onConfirmSaveQuery: () => void;
  onCloseSaveDialog: () => void;
}

export const SqlEditorToolbar: React.FC<SqlEditorToolbarProps> = ({
  currentConnection,
  runningQueryId,
  pendingParamExec,
  paramValues,
  showSaveDialog,
  saveTitle,
  saveFolder,
  onRunCurrent,
  onRunAll,
  onCancelQuery,
  onExplain,
  onFormatSql,
  onOpenSave,
  onParamValuesChange,
  onSubmitParams,
  onCancelParams,
  onSaveTitleChange,
  onSaveFolderChange,
  onConfirmSaveQuery,
  onCloseSaveDialog,
}) => {
  const sc = (id: string) => formatShortcutForDisplay(getEffectiveShortcut(id));

  return (
    <>
      <div className="h-10 shrink-0 px-3 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between gap-2 text-xs select-none">
        <div className="flex items-center gap-1.5">
          {runningQueryId ? (
            <button
              type="button"
              onClick={() => onCancelQuery(runningQueryId)}
              title="Cancel running query"
              className="px-2.5 py-1 rounded-md bg-[var(--error)] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Square size={10} fill="currentColor" /> Cancel
            </button>
          ) : (
            <button
              type="button"
              disabled={!currentConnection}
              onClick={onRunCurrent}
              className="px-2.5 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
              title={`Run Current / Selection (${sc('execute-query')})`}
            >
              <Play size={11} fill="currentColor" /> Run
            </button>
          )}

          <button
            type="button"
            disabled={!currentConnection || !!runningQueryId}
            onClick={onRunAll}
            className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] disabled:opacity-45"
            title={`Run All Statements (${sc('execute-all')})`}
          >
            Run All
          </button>

          <button
            type="button"
            disabled={!currentConnection}
            onClick={onExplain}
            className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] inline-flex items-center gap-1 disabled:opacity-45"
            title={`Explain Plan (${sc('explain-query')})`}
          >
            <GitMerge size={11} /> Explain
          </button>

          <button
            type="button"
            onClick={onFormatSql}
            className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] inline-flex items-center gap-1"
            title={`Format SQL (${sc('format-sql')})`}
          >
            <AlignLeft size={11} /> Format
          </button>

          <button
            type="button"
            onClick={onOpenSave}
            className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] inline-flex items-center gap-1"
            title={`Save Query (${sc('save-action')})`}
          >
            <BookmarkPlus size={11} /> Save
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          {currentConnection ? (
            <>
              {currentConnection.environment && (
                <span
                  className={`text-[9.5px] uppercase px-1.5 py-0.2 rounded border ${getEnvironmentMeta(currentConnection.environment).badgeClass}`}
                >
                  {getEnvironmentMeta(currentConnection.environment).shortLabel}
                </span>
              )}
              <span className="font-mono">
                {currentConnection.engine} · {currentConnection.name}
              </span>
            </>
          ) : (
            <span>No connection selected</span>
          )}
        </div>
      </div>

      {pendingParamExec && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitParams();
          }}
          className="px-3 py-2 bg-[var(--bg-surface)] border-b border-[var(--border)] flex flex-wrap items-center gap-2.5 text-xs"
        >
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent)]">
            <SlidersHorizontal size={12} /> Parameters:
          </span>
          {pendingParamExec.params.map((p, idx) => (
            <label key={p} className="inline-flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                {`{{${p}}}`}
              </span>
              <input
                type="text"
                autoFocus={idx === 0}
                value={paramValues[p] ?? ''}
                onChange={(e) =>
                  onParamValuesChange((prev) => ({
                    ...prev,
                    [p]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancelParams();
                  }
                }}
                placeholder="value, 123, NULL…"
                className="w-36 py-0.5 px-2 font-mono text-[11px]"
              />
            </label>
          ))}
          <button
            type="submit"
            className="px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--accent-text)] font-semibold text-[11px]"
          >
            {pendingParamExec.mode === 'explain' ? 'Explain' : 'Execute'}
          </button>
          <button
            type="button"
            onClick={onCancelParams}
            className="px-2 py-1 rounded border border-[var(--border)] text-[11px]"
          >
            Cancel
          </button>
        </form>
      )}

      {showSaveDialog && (
        <div className="px-3 py-2 bg-[var(--bg-surface)] border-b border-[var(--border)] flex items-center gap-2 text-xs">
          <input
            type="text"
            value={saveTitle}
            onChange={(e) => onSaveTitleChange(e.target.value)}
            placeholder="Query title…"
            className="w-56 py-1"
            autoFocus
          />
          <input
            type="text"
            value={saveFolder}
            onChange={(e) => onSaveFolderChange(e.target.value)}
            placeholder="Folder (optional)"
            className="w-40 py-1"
          />
          <button
            type="button"
            onClick={onConfirmSaveQuery}
            className="px-3 py-1 rounded bg-[var(--accent)] text-[var(--accent-text)] font-semibold"
          >
            Save Query
          </button>
          <button
            type="button"
            onClick={onCloseSaveDialog}
            className="px-2 py-1 rounded border border-[var(--border)]"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
};
