import { Key } from 'lucide-react';
import type React from 'react';
import { Badge } from '../../../components/ui/Badge';
import type { ColumnInfo } from '../../../types/database';

interface StructureTabProps {
  columns: ColumnInfo[];
}

export const StructureTab: React.FC<StructureTabProps> = ({ columns }) => {
  return (
    <div className="flex-1 overflow-auto p-4 select-text">
      <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-panel)]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              <th className="py-2 px-3 w-10">#</th>
              <th className="py-2 px-3">Column</th>
              <th className="py-2 px-3">Data Type</th>
              <th className="py-2 px-3">Nullable</th>
              <th className="py-2 px-3">Default</th>
              <th className="py-2 px-3">Attributes</th>
              <th className="py-2 px-3">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {columns.map((col) => (
              <tr key={col.name} className="hover:bg-[var(--bg-hover)]/60">
                <td className="py-2 px-3 font-mono text-[var(--text-muted)]">
                  {col.ordinalPosition}
                </td>
                <td className="py-2 px-3 font-mono font-semibold text-[var(--text)]">
                  <span className="inline-flex items-center gap-1.5">
                    {col.primaryKey && <Key size={12} className="text-amber-500 shrink-0" />}
                    {col.name}
                  </span>
                </td>
                <td className="py-2 px-3 font-mono text-[var(--accent)]">
                  {col.dataType}
                  {col.enumValues.length > 0 && (
                    <span className="block text-[10px] text-[var(--text-muted)]">
                      enum({col.enumValues.join(', ')})
                    </span>
                  )}
                </td>
                <td className="py-2 px-3">
                  {col.nullable ? (
                    <Badge variant="neutral">NULL</Badge>
                  ) : (
                    <Badge variant="warning">NOT NULL</Badge>
                  )}
                </td>
                <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                  {col.defaultValue ?? <span className="text-[var(--text-muted)]">—</span>}
                </td>
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-1">
                    {col.primaryKey && <Badge variant="primaryKey">PK</Badge>}
                    {col.isUnique && <Badge variant="info">UNIQUE</Badge>}
                    {(col.isIdentity || col.autoIncrement) && (
                      <Badge variant="accent">IDENTITY</Badge>
                    )}
                    {col.isGenerated && (
                      <Badge variant="neutral">GENERATED {col.generationExpression || ''}</Badge>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3 text-[11px] text-[var(--text-muted)]">
                  {col.comment || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
