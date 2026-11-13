import { ListTree, Plus, Trash2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Checkbox } from '../../../components/ui/Checkbox';
import type { ColumnInfo, DatabaseEngine, IndexInfo } from '../../../types/database';

interface IndexesTabProps {
  tableName: string;
  schema?: string;
  engineKind: DatabaseEngine;
  indexes: IndexInfo[];
  columns: ColumnInfo[];
  readOnly: boolean;
  onCreateIndex: (payload: {
    indexName: string;
    columns: string[];
    unique: boolean;
    method?: string;
  }) => Promise<void>;
  onDropIndex: (indexName: string) => void;
}

export const IndexesTab: React.FC<IndexesTabProps> = ({
  tableName,
  engineKind,
  indexes,
  columns,
  readOnly,
  onCreateIndex,
  onDropIndex,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [indexName, setIndexName] = useState(`idx_${tableName}_`);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [unique, setUnique] = useState(false);
  const [method, setMethod] = useState('btree');
  const [creating, setCreating] = useState(false);

  const toggleCol = (col: string) => {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indexName.trim() || selectedCols.length === 0) return;
    setCreating(true);
    try {
      await onCreateIndex({
        indexName: indexName.trim(),
        columns: selectedCols,
        unique,
        method: engineKind === 'postgres' ? method : undefined,
      });
      setShowCreate(false);
      setIndexName(`idx_${tableName}_`);
      setSelectedCols([]);
      setUnique(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4 select-text">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--text-secondary)]">
          Indexes ({indexes.length})
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowCreate((s) => !s)}
            className="px-2.5 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold inline-flex items-center gap-1"
          >
            <Plus size={12} /> Create Index
          </button>
        )}
      </div>

      {showCreate && !readOnly && (
        <form
          onSubmit={handleSubmit}
          className="p-3.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">Index Name</label>
              <input
                type="text"
                value={indexName}
                onChange={(e) => setIndexName(e.target.value)}
                className="w-full font-mono"
                required
              />
            </div>
            {engineKind === 'postgres' && (
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Index Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full font-mono"
                >
                  <option value="btree">btree</option>
                  <option value="hash">hash</option>
                  <option value="gin">gin</option>
                  <option value="gist">gist</option>
                  <option value="brin">brin</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] text-[var(--text-muted)] mb-1.5">Indexed Columns</div>
            <div className="flex flex-wrap gap-2">
              {columns.map((c) => (
                <button
                  type="button"
                  key={c.name}
                  onClick={() => toggleCol(c.name)}
                  className={`px-2 py-1 rounded border font-mono text-[11px] ${
                    selectedCols.includes(c.name)
                      ? 'bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent)] font-semibold'
                      : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Checkbox checked={unique} onChange={setUnique} size="sm" label="UNIQUE index" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-2.5 py-1 rounded border border-[var(--border)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !indexName.trim() || selectedCols.length === 0}
                className="px-3 py-1 rounded bg-[var(--accent)] text-[var(--accent-text)] font-semibold disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      )}

      {indexes.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-lg text-xs text-[var(--text-muted)] space-y-2">
          <ListTree size={24} className="mx-auto opacity-35" />
          <p>No indexes defined on this table.</p>
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-panel)]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                <th className="py-2 px-3">Index Name</th>
                <th className="py-2 px-3">Columns</th>
                <th className="py-2 px-3">Method</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Definition</th>
                {!readOnly && <th className="py-2 px-3 w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {indexes.map((idx) => (
                <tr key={idx.name} className="hover:bg-[var(--bg-hover)]/60">
                  <td className="py-2 px-3 font-mono font-semibold text-[var(--text)]">
                    {idx.name}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {idx.columns.length > 0 ? (
                        idx.columns.map((c) => (
                          <Badge key={`${idx.name}-${c}`} variant="type">
                            {c}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                    {idx.indexType || 'btree'}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {idx.isPrimary && <Badge variant="primaryKey">PRIMARY</Badge>}
                      {idx.isUnique && !idx.isPrimary && <Badge variant="info">UNIQUE</Badge>}
                      {idx.isPartial && <Badge variant="warning">PARTIAL</Badge>}
                      {!idx.isPrimary && !idx.isUnique && <Badge variant="neutral">INDEX</Badge>}
                    </div>
                  </td>
                  <td className="py-2 px-3 font-mono text-[10.5px] text-[var(--text-muted)] max-w-md break-all">
                    {idx.definition || (idx.predicate ? `WHERE ${idx.predicate}` : '—')}
                  </td>
                  {!readOnly && (
                    <td className="py-2 px-3 text-right">
                      {!idx.isPrimary && !idx.name.startsWith('sqlite_autoindex_') && (
                        <button
                          type="button"
                          onClick={() => onDropIndex(idx.name)}
                          className="p-1 rounded hover:bg-[var(--error)]/15 text-[var(--text-muted)] hover:text-[var(--error)]"
                          title="Drop Index"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
