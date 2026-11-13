import { BarChart3 } from 'lucide-react';
import type React from 'react';
import type { TableInfo, TableStatistics } from '../../../types/database';

interface StatisticsTabProps {
  table: TableInfo;
  statistics: TableStatistics;
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({ table, statistics }) => {
  const cards = [
    {
      label: 'Row Estimate',
      value:
        statistics.rowCountEstimate !== undefined && statistics.rowCountEstimate !== null
          ? statistics.rowCountEstimate.toLocaleString()
          : '—',
    },
    {
      label: 'Exact Count',
      value:
        statistics.exactRowCount !== undefined && statistics.exactRowCount !== null
          ? statistics.exactRowCount.toLocaleString()
          : 'On-demand',
    },
    {
      label: 'Table Size',
      value: statistics.tableSizePretty || '—',
    },
    {
      label: 'Indexes Size',
      value: statistics.indexesSizePretty || '—',
    },
    {
      label: 'Total Relation Size',
      value: statistics.totalSizePretty || '—',
    },
    {
      label: 'Primary Key',
      value: table.hasPrimaryKey ? 'Present' : 'None',
    },
    {
      label: 'Last Vacuum',
      value: statistics.lastVacuum || '—',
    },
    {
      label: 'Last Analyze',
      value: statistics.lastAnalyze || '—',
    },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4 select-text">
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
        <BarChart3 size={14} className="text-[var(--accent)]" />
        <span>Relation Storage &amp; Planner Statistics</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="p-3.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] space-y-1"
          >
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-muted)]">
              {c.label}
            </div>
            <div className="text-sm font-mono font-semibold text-[var(--text)] truncate">
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {table.comment && (
        <div className="p-3.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] space-y-1">
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-muted)]">
            Table Comment
          </div>
          <p className="text-xs text-[var(--text-secondary)]">{table.comment}</p>
        </div>
      )}
    </div>
  );
};
