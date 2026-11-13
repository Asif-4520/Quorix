import type React from 'react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { format as formatSqlLib } from 'sql-formatter';
import {
  getEffectiveShortcut,
  matchesKeyCombination,
  shouldIgnoreShortcut,
} from '../../services/shortcuts';
import {
  analyzeDangerousSql,
  extractSqlParameters,
  substituteSqlParameters,
} from '../../services/sqlUtils';
import {
  cancelQuery,
  executeQuery,
  explainQuery,
  exportData,
  isTauri,
  selectExportPathDialog,
} from '../../services/tauri';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import type { ConnectionSummary, ExplainResponse, MultiQueryResponse } from '../../types/database';
import { SqlEditorToolbar } from './SqlEditorToolbar';
import { type SqlBottomTab, SqlResultsPanel } from './SqlResultsPanel';
import { useSqlCodeMirror } from './useSqlCodeMirror';

export interface SqlEditorHandle {
  execute: () => void;
  executeAll: () => void;
  explain: () => void;
  formatSql: () => void;
  saveQuery: () => void;
}

interface SqlEditorProps {
  tabId: string;
  initialSql: string;
  savedQueryId?: string;
  currentConnection: ConnectionSummary | null;
  onSqlChange: (sql: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRequestConfirm?: (
    title: string,
    message: string,
    sql: string | undefined,
    onConfirm: () => Promise<void> | void,
  ) => void;
  editorRef: React.MutableRefObject<SqlEditorHandle | null>;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  tabId,
  initialSql,
  savedQueryId,
  currentConnection,
  onSqlChange,
  onShowToast,
  onRequestConfirm,
  editorRef,
}) => {
  const settings = useSettingsStore((s) => s.settings);
  const effectiveTheme = useSettingsStore((s) => s.effectiveTheme);

  const introspection = useConnectionStore((s) =>
    currentConnection ? s.introspectionsByConn[currentConnection.id] : undefined,
  );
  const queryHistory = useWorkspaceStore((s) => s.queryHistory);
  const recordQueryHistory = useWorkspaceStore((s) => s.recordQueryHistory);
  const clearHistory = useWorkspaceStore((s) => s.clearHistory);
  const saveQuery = useWorkspaceStore((s) => s.saveQuery);
  const updateTab = useWorkspaceStore((s) => s.updateTab);
  const registerRunningQuery = useWorkspaceStore((s) => s.registerRunningQuery);
  const unregisterRunningQuery = useWorkspaceStore((s) => s.unregisterRunningQuery);
  const setStatusMetrics = useWorkspaceStore((s) => s.setStatusMetrics);

  const [bottomTab, setBottomTab] = useState<SqlBottomTab>('results');
  const [multiResult, setMultiResult] = useState<MultiQueryResponse | null>(null);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [explainResult, setExplainResult] = useState<ExplainResponse | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [runningQueryId, setRunningQueryId] = useState<string | null>(null);
  const [editorHeight, setEditorHeight] = useState(260);
  const [isResultsMaximized, setIsResultsMaximized] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveFolder, setSaveFolder] = useState('');
  const [pendingParamExec, setPendingParamExec] = useState<{
    sqlText: string;
    mode: 'run' | 'explain';
    params: string[];
  } | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const actionRefs = useRef({
    executeCurrent: () => {},
    executeAll: () => {},
    explain: () => {},
    formatSql: () => {},
    saveQuery: () => {},
  });

  const { mountRef, getSqlToExecute, getDocumentText, replaceDocumentText } = useSqlCodeMirror({
    initialSql,
    engineKind: currentConnection?.engineKind,
    introspection,
    settings,
    effectiveTheme,
    onSqlChange,
    actionRefs,
  });

  const dispatchSqlExecution = useCallback(
    async (finalSql: string) => {
      if (!currentConnection) return;
      const trimmed = finalSql.trim();
      if (!trimmed) return;

      const executeNow = async () => {
        const qid = `sql_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setRunningQueryId(qid);
        setQueryError(null);
        registerRunningQuery(qid, currentConnection.id, 'Executing SQL…');

        try {
          const res = await executeQuery({
            connectionId: currentConnection.id,
            sql: trimmed,
            maxRows: settings.maxResultRows || 5000,
            queryId: qid,
          });
          setMultiResult(res);
          const firstWithRows = res.results.findIndex((r) => r.columns.length > 0);
          setActiveResultIdx(Math.max(firstWithRows, 0));
          setBottomTab(firstWithRows >= 0 ? 'results' : 'messages');

          const lastRes = res.results[res.results.length - 1];
          const totalRows = lastRes?.totalRows ?? lastRes?.affectedRows ?? 0;
          recordQueryHistory({
            sql: trimmed,
            connectionId: currentConnection.id,
            connectionName: currentConnection.name,
            timestamp: Date.now(),
            durationMs: res.totalDurationMs,
            status: 'success',
            rowsCount: totalRows,
          });
          setStatusMetrics({
            rowsInfo: lastRes?.columns.length
              ? `${lastRes.rows.length} rows`
              : `${lastRes?.affectedRows ?? 0} affected`,
            durationMs: res.totalDurationMs,
            txState: currentConnection.engine,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const cancelled = msg.toLowerCase().includes('cancelled');
          setQueryError(msg);
          setBottomTab('messages');
          if (settings.recordFailedHistory !== false) {
            recordQueryHistory({
              sql: trimmed,
              connectionId: currentConnection.id,
              connectionName: currentConnection.name,
              timestamp: Date.now(),
              durationMs: 0,
              status: cancelled ? 'cancelled' : 'error',
              errorMessage: msg,
            });
          }
          onShowToast(cancelled ? 'Query cancelled' : msg, cancelled ? 'info' : 'error');
        } finally {
          setRunningQueryId(null);
          unregisterRunningQuery(qid);
        }
      };

      const danger = analyzeDangerousSql(trimmed);
      const isProd = currentConnection.environment === 'production';
      const warnUnwhered = danger.isUnwheredWrite && settings.confirmUnfilteredWrites !== false;
      const warnDrop = danger.hasDrop && (settings.confirmDropTable || isProd);
      const warnTruncate = danger.hasTruncate && (settings.confirmTruncateTable || isProd);
      const warnProdDanger = isProd && (danger.isDestructiveDdl || danger.hasDelete);
      if (warnUnwhered || warnDrop || warnTruncate || warnProdDanger) {
        const title = warnUnwhered
          ? 'Unfiltered Write Warning (No WHERE Clause)'
          : warnDrop
            ? 'Destructive DROP Confirmation'
            : warnTruncate
              ? 'Truncate Table Confirmation'
              : 'Production Destructive SQL Confirmation';
        const extraReason =
          warnProdDanger && danger.reasons.length === 0
            ? ['DELETE / destructive statement targeting a production database.']
            : [];
        const message = [
          isProd ? `[PRODUCTION: ${currentConnection.name}]` : '',
          ...danger.reasons,
          ...extraReason,
          'Review the SQL carefully before proceeding.',
        ]
          .filter(Boolean)
          .join('\n');
        if (onRequestConfirm) {
          onRequestConfirm(title, message, trimmed, executeNow);
          return;
        }
        if (!window.confirm(`${title}\n\n${message}`)) {
          return;
        }
      }

      await executeNow();
    },
    [
      currentConnection,
      onRequestConfirm,
      onShowToast,
      registerRunningQuery,
      unregisterRunningQuery,
      settings.maxResultRows,
      settings.confirmUnfilteredWrites,
      settings.confirmDropTable,
      settings.confirmTruncateTable,
      settings.recordFailedHistory,
      recordQueryHistory,
      setStatusMetrics,
    ],
  );

  const runSql = useCallback(
    async (runAll: boolean) => {
      if (!currentConnection) {
        onShowToast('Connect to a database first', 'error');
        return;
      }
      const sqlText = getSqlToExecute(runAll).trim();
      if (!sqlText) return;

      const params = extractSqlParameters(sqlText);
      if (params.length > 0) {
        setPendingParamExec({ sqlText, mode: 'run', params });
        return;
      }

      await dispatchSqlExecution(sqlText);
    },
    [currentConnection, getSqlToExecute, onShowToast, dispatchSqlExecution],
  );

  const dispatchExplain = useCallback(
    async (finalSql: string) => {
      if (!currentConnection) return;
      const danger = analyzeDangerousSql(finalSql);
      if (danger.hasMultipleStatements) {
        const msg =
          'EXPLAIN only supports a single SQL statement at a time. Select one statement or place your cursor inside it.';
        setQueryError(msg);
        setBottomTab('messages');
        onShowToast(msg, 'error');
        return;
      }
      if (danger.isDestructiveDdl) {
        const msg =
          'Unsafe for EXPLAIN: DDL statements (DROP / TRUNCATE / ALTER DROP) cannot be safely explained.';
        setQueryError(msg);
        setBottomTab('messages');
        onShowToast(msg, 'error');
        return;
      }

      const safeAnalyze = settings.explainAnalyze !== false && !danger.hasWriteDml;
      if (settings.explainAnalyze !== false && danger.hasWriteDml) {
        onShowToast(
          'Safe Explain Mode: estimating plan without executing write/delete SQL',
          'info',
        );
      }

      try {
        const res = await explainQuery(finalSql, currentConnection.id, safeAnalyze);
        setExplainResult(res);
        setQueryError(null);
        setBottomTab('plan');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setQueryError(msg);
        setBottomTab('messages');
      }
    },
    [currentConnection, settings.explainAnalyze, onShowToast],
  );

  const handleExplain = useCallback(async () => {
    if (!currentConnection) {
      onShowToast('Connect to a database first', 'error');
      return;
    }
    const sqlText = getSqlToExecute(false).trim();
    if (!sqlText) return;
    const params = extractSqlParameters(sqlText);
    if (params.length > 0) {
      setPendingParamExec({ sqlText, mode: 'explain', params });
      return;
    }
    await dispatchExplain(sqlText);
  }, [currentConnection, getSqlToExecute, onShowToast, dispatchExplain]);

  const handleFormatSql = useCallback(() => {
    const raw = getDocumentText();
    try {
      const formatted = formatSqlLib(raw, {
        language:
          currentConnection?.engineKind === 'postgres'
            ? 'postgresql'
            : currentConnection?.engineKind === 'mysql'
              ? 'mysql'
              : 'sqlite',
        tabWidth: settings.editorTabSize || 2,
      });
      replaceDocumentText(formatted);
      onSqlChange(formatted);
    } catch {
      onShowToast('Unable to format current SQL syntax', 'info');
    }
  }, [
    currentConnection?.engineKind,
    settings.editorTabSize,
    getDocumentText,
    replaceDocumentText,
    onSqlChange,
    onShowToast,
  ]);

  const handleOpenSave = useCallback(() => {
    const activeTab = useWorkspaceStore.getState().tabs.find((t) => t.id === tabId);
    const defaultTitle =
      activeTab?.title && !activeTab.title.startsWith('Query ') ? activeTab.title : '';
    setSaveTitle(defaultTitle);
    setShowSaveDialog(true);
  }, [tabId]);

  const editorKeyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  editorKeyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const matchEditor = (id: string) =>
      !shouldIgnoreShortcut(e, id) && matchesKeyCombination(e, getEffectiveShortcut(id));

    if (matchEditor('save-sql-query')) {
      e.preventDefault();
      handleOpenSave();
    } else if (matchEditor('cancel-running-query')) {
      if (runningQueryId) {
        e.preventDefault();
        void cancelQuery(runningQueryId);
      }
    } else if (matchEditor('sql-toggle-history')) {
      e.preventDefault();
      setBottomTab('history');
    } else if (matchEditor('sql-toggle-results')) {
      e.preventDefault();
      setBottomTab('results');
    } else if (matchEditor('sql-toggle-plan')) {
      e.preventDefault();
      setBottomTab('plan');
    } else if (matchEditor('sql-toggle-messages')) {
      e.preventDefault();
      setBottomTab('messages');
    } else if (matchEditor('sql-export-csv')) {
      e.preventDefault();
      void handleExportResults('csv');
    } else if (matchEditor('sql-export-json')) {
      e.preventDefault();
      void handleExportResults('json');
    } else if (matchEditor('sql-clear-history')) {
      e.preventDefault();
      clearHistory();
      onShowToast('Cleared SQL query history', 'info');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => editorKeyHandlerRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    actionRefs.current = {
      executeCurrent: () => void runSql(false),
      executeAll: () => void runSql(true),
      explain: () => void handleExplain(),
      formatSql: handleFormatSql,
      saveQuery: handleOpenSave,
    };
  }, [runSql, handleExplain, handleFormatSql, handleOpenSave]);

  useImperativeHandle(editorRef, () => ({
    execute: () => actionRefs.current.executeCurrent(),
    executeAll: () => actionRefs.current.executeAll(),
    explain: () => actionRefs.current.explain(),
    formatSql: () => actionRefs.current.formatSql(),
    saveQuery: () => actionRefs.current.saveQuery(),
  }));

  const activeResult = multiResult?.results[activeResultIdx] || null;
  const keyedResults = useMemo(() => {
    const list = multiResult?.results ?? [];
    const seen = new Map<string, number>();
    return list.map((res, pos) => {
      const base = `${res.statementType}-${res.durationMs}-${res.rows.length}`;
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return { res, pos, id: `${base}-${count}` };
    });
  }, [multiResult]);

  const keyedColumns = useMemo(() => {
    if (!activeResult) return [];
    const counts = new Map<string, number>();
    return activeResult.columns.map((name, idx) => {
      const seen = (counts.get(name) ?? 0) + 1;
      counts.set(name, seen);
      return {
        name,
        dataType: activeResult.columnTypes?.[idx] || '',
        key: `${name}#${seen}`,
      };
    });
  }, [activeResult]);

  const keyedRows = useMemo(() => {
    if (!activeResult) return [];
    return activeResult.rows.map((cells, rowPos) => ({
      rowPos,
      rowKey: `r-${activeResultIdx}-${rowPos}-${cells.slice(0, 3).join('|')}`,
      cells: cells.map((val, colPos) => ({
        val,
        cellKey: `${keyedColumns[colPos]?.key || colPos}-${rowPos}`,
      })),
    }));
  }, [activeResult, activeResultIdx, keyedColumns]);

  const filteredHistory = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    return queryHistory.filter(
      (h) =>
        !q || h.sql.toLowerCase().includes(q) || (h.connectionName || '').toLowerCase().includes(q),
    );
  }, [queryHistory, historyFilter]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = editorHeight;
    const onMove = (ev: MouseEvent) => {
      setEditorHeight(Math.max(120, Math.min(540, startH + (ev.clientY - startY))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleExportResults = async (format: 'csv' | 'json') => {
    if (!currentConnection) return;
    const sqlText = getSqlToExecute(false).trim();
    if (!sqlText) return;

    const defaultName = `query-results-${new Date().toISOString().slice(0, 10)}.${format}`;
    let chosenPath: string | null = null;
    if (isTauri()) {
      chosenPath = await selectExportPathDialog(defaultName, format);
      if (!chosenPath) return;
    }

    try {
      const res = await exportData({
        connectionId: currentConnection.id,
        sql: sqlText,
        format,
        outputPath: chosenPath || undefined,
      });

      if (res.savedPath) {
        onShowToast(`Exported ${res.rowCount} rows to ${res.savedPath}`, 'success');
      } else {
        const blob = new Blob([res.content], {
          type: format === 'json' ? 'application/json' : 'text/csv',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
        onShowToast(
          `Saved ${defaultName} (${res.rowCount} rows) to your browser Downloads folder`,
          'success',
        );
      }
    } catch (err) {
      onShowToast(`Export failed: ${err}`, 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]">
      <SqlEditorToolbar
        currentConnection={currentConnection}
        runningQueryId={runningQueryId}
        pendingParamExec={pendingParamExec}
        paramValues={paramValues}
        showSaveDialog={showSaveDialog}
        saveTitle={saveTitle}
        saveFolder={saveFolder}
        onRunCurrent={() => void runSql(false)}
        onRunAll={() => void runSql(true)}
        onCancelQuery={(qid) => void cancelQuery(qid)}
        onExplain={() => void handleExplain()}
        onFormatSql={handleFormatSql}
        onOpenSave={handleOpenSave}
        onParamValuesChange={setParamValues}
        onSubmitParams={() => {
          if (!pendingParamExec) return;
          const resolved = substituteSqlParameters(
            pendingParamExec.sqlText,
            paramValues,
            currentConnection?.engineKind,
          );
          const mode = pendingParamExec.mode;
          setPendingParamExec(null);
          if (mode === 'explain') {
            void dispatchExplain(resolved);
          } else {
            void dispatchSqlExecution(resolved);
          }
        }}
        onCancelParams={() => setPendingParamExec(null)}
        onSaveTitleChange={setSaveTitle}
        onSaveFolderChange={setSaveFolder}
        onConfirmSaveQuery={() => {
          const sqlText = getDocumentText();
          if (!saveTitle.trim()) return;
          const saved = saveQuery({
            id: savedQueryId,
            title: saveTitle.trim(),
            folder: saveFolder.trim() || undefined,
            sql: sqlText,
            connectionId: currentConnection?.id,
          });
          updateTab(tabId, {
            title: saved.title,
            savedQueryId: saved.id,
            isDirty: false,
          });
          setShowSaveDialog(false);
          onShowToast(`Saved query "${saved.title}"`, 'success');
        }}
        onCloseSaveDialog={() => setShowSaveDialog(false)}
      />

      {!isResultsMaximized && (
        <>
          <div
            style={{ height: editorHeight }}
            className="shrink-0 overflow-hidden border-b border-[var(--border)]"
          >
            <div ref={mountRef} className="h-full w-full" />
          </div>

          <div
            onMouseDown={startResize}
            className="h-1.5 shrink-0 cursor-row-resize bg-[var(--bg-panel)] hover:bg-[var(--accent)]/60 border-b border-[var(--border)] transition-colors"
            title="Drag to resize results panel"
          />
        </>
      )}

      <SqlResultsPanel
        bottomTab={bottomTab}
        currentConnection={currentConnection}
        runningQueryId={runningQueryId}
        multiResult={multiResult}
        keyedResults={keyedResults}
        activeResult={activeResult}
        activeResultIdx={activeResultIdx}
        keyedColumns={keyedColumns}
        keyedRows={keyedRows}
        explainResult={explainResult}
        queryError={queryError}
        historyFilter={historyFilter}
        historyTotalCount={queryHistory.length}
        filteredHistory={filteredHistory}
        onBottomTabChange={setBottomTab}
        onActiveResultIdxChange={setActiveResultIdx}
        isMaximized={isResultsMaximized}
        onToggleMaximize={() => setIsResultsMaximized((p) => !p)}
        onCopyResultsJson={() => {
          if (!activeResult) return;
          const json = activeResult.rows.map((r) => {
            const o: Record<string, string | null> = {};
            activeResult.columns.forEach((c, i) => {
              o[c] = r[i] ?? null;
            });
            return o;
          });
          void navigator.clipboard.writeText(JSON.stringify(json, null, 2));
          onShowToast('Results copied as JSON', 'info');
        }}
        onExportResults={(fmt) => void handleExportResults(fmt)}
        onHistoryFilterChange={setHistoryFilter}
        onClearHistory={clearHistory}
        onSelectHistorySql={(sqlText) => {
          replaceDocumentText(sqlText);
          onSqlChange(sqlText);
        }}
      />
    </div>
  );
};
