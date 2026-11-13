import { Clock, Search, Trash2 } from 'lucide-react';
import type React from 'react';
import type { QueryHistoryItem } from '../../types/database';

interface SqlHistoryTabProps {
  historyFilter: string;
  totalCount: number;
  filteredHistory: QueryHistoryItem[];
  onFilterChange: (value: string) => void;
  onClearHistory: () => void;
  onSelectHistorySql: (sql: string) => void;
}

export const SqlHistoryTab: React.FC<SqlHistoryTabProps> = ({
  historyFilter,
  totalCount,
  filteredHistory,
  onFilterChange,
  onClearHistory,
  onSelectHistorySql,
}) => (
  <div className="p-3 space-y-2 text-xs">
    <div className="flex items-center justify-between gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="text"
          value={historyFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Search query history…"
          className="w-full pl-7 pr-2 py-1 text-[11px]"
        />
      </div>
      {totalCount > 0 && (
        <button
          type="button"
          onClick={onClearHistory}
          className="px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text-muted)] hover:text-[var(--error)] inline-flex items-center gap-1"
        >
          <Trash2 size={11} /> Clear History
        </button>
      )}
    </div>

    <div className="space-y-1.5">
      {filteredHistory.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-muted)]">No query history entries.</div>
      ) : (
        filteredHistory.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectHistorySql(item.sql)}
            className="p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--border-focus)] cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-[10.5px] text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <span
                  className={`px-1.5 rounded font-semibold uppercase ${
                    item.status === 'success'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                      : item.status === 'cancelled'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                  }`}
                >
                  {item.status}
                </span>
                {item.connectionName && <span>{item.connectionName}</span>}
              </div>
              <span className="inline-flex items-center gap-1 font-mono">
                <Clock size={10} />
                {new Date(item.timestamp).toLocaleTimeString()} · {item.durationMs} ms
              </span>
            </div>
            <pre className="font-mono text-[11px] text-[var(--text)] truncate m-0">{item.sql}</pre>
          </div>
        ))
      )}
    </div>
  </div>
);
