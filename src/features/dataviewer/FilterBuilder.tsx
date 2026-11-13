import { Play, Plus, Trash2, X } from 'lucide-react';
import type React from 'react';
import type { ColumnInfo, FilterOperator, FilterRule } from '../../types/database';

interface FilterBuilderProps {
  columns: ColumnInfo[];
  rules: FilterRule[];
  filterLogic: 'and' | 'or';
  onChangeLogic: (logic: 'and' | 'or') => void;
  onAddRule: () => void;
  onUpdateRule: (id: string, patch: Partial<FilterRule>) => void;
  onRemoveRule: (id: string) => void;
  onApply: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

const OPERATORS: Array<{
  value: FilterOperator;
  label: string;
  argCount: 0 | 1 | 2;
}> = [
  { value: 'contains', label: 'Contains', argCount: 1 },
  { value: 'not_contains', label: 'Not Contains', argCount: 1 },
  { value: 'equals', label: 'Equals (=)', argCount: 1 },
  { value: 'not_equals', label: 'Not Equals (!=)', argCount: 1 },
  { value: 'starts_with', label: 'Starts With', argCount: 1 },
  { value: 'ends_with', label: 'Ends With', argCount: 1 },
  { value: 'greater_than', label: 'Greater (>)', argCount: 1 },
  { value: 'greater_or_equal', label: 'Greater or Eq (>=)', argCount: 1 },
  { value: 'less_than', label: 'Less (<)', argCount: 1 },
  { value: 'less_or_equal', label: 'Less or Eq (<=)', argCount: 1 },
  { value: 'between', label: 'Between', argCount: 2 },
  { value: 'in_list', label: 'In (a, b, c)', argCount: 1 },
  { value: 'is_null', label: 'IS NULL', argCount: 0 },
  { value: 'is_not_null', label: 'IS NOT NULL', argCount: 0 },
];

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  columns,
  rules,
  filterLogic,
  onChangeLogic,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onApply,
  onClearAll,
  onClose,
}) => {
  return (
    <div className="shrink-0 px-3 py-2.5 bg-[var(--bg-sidebar)] border-b border-[var(--border)] space-y-2 text-xs select-none">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text)]">Structured Filters</span>
          <div className="inline-flex rounded border border-[var(--border)] overflow-hidden bg-[var(--bg-surface)]">
            <button
              type="button"
              onClick={() => onChangeLogic('and')}
              className={`px-2 py-0.5 text-[10.5px] font-semibold ${
                filterLogic === 'and'
                  ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              AND
            </button>
            <button
              type="button"
              onClick={() => onChangeLogic('or')}
              className={`px-2 py-0.5 text-[10.5px] font-semibold ${
                filterLogic === 'or'
                  ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              OR
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAddRule}
            className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] inline-flex items-center gap-1"
          >
            <Plus size={11} /> Add Rule
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text-secondary)]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onApply}
            className="px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-[11px] font-semibold inline-flex items-center gap-1"
          >
            <Play size={10} fill="currentColor" /> Apply
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
            title="Hide Filters"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-[11px] text-[var(--text-muted)] italic">
          No filter rules added. Click "Add Rule" to build parameterized WHERE clauses.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rules.map((rule) => {
            const opMeta = OPERATORS.find((o) => o.value === rule.operator) || OPERATORS[0];
            return (
              <div key={rule.id} className="flex items-center gap-2 flex-wrap">
                <select
                  value={rule.column ?? ''}
                  onChange={(e) => onUpdateRule(rule.id, { column: e.target.value })}
                  className="min-w-[140px] py-1 text-[11.5px]"
                >
                  <option value="">Any Column</option>
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.dataType})
                    </option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) =>
                    onUpdateRule(rule.id, {
                      operator: e.target.value as FilterOperator,
                    })
                  }
                  className="min-w-[140px] py-1 text-[11.5px]"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {opMeta.argCount >= 1 && (
                  <input
                    type="text"
                    value={rule.value ?? ''}
                    onChange={(e) => onUpdateRule(rule.id, { value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onApply();
                    }}
                    placeholder={rule.operator === 'in_list' ? 'val1, val2, val3' : 'Filter value…'}
                    className="flex-1 min-w-[140px] py-1 text-[11.5px] font-mono"
                  />
                )}

                {opMeta.argCount === 2 && (
                  <input
                    type="text"
                    value={rule.value2 ?? ''}
                    onChange={(e) => onUpdateRule(rule.id, { value2: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onApply();
                    }}
                    placeholder="And value…"
                    className="w-36 py-1 text-[11.5px] font-mono"
                  />
                )}

                <button
                  type="button"
                  onClick={() => onRemoveRule(rule.id)}
                  className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--error)]"
                  title="Remove Rule"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
