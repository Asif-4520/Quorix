import { ShieldCheck } from 'lucide-react';
import type React from 'react';
import { Badge } from '../../../components/ui/Badge';
import type { ConstraintInfo } from '../../../types/database';

interface ConstraintsTabProps {
  constraints: ConstraintInfo[];
}

export const ConstraintsTab: React.FC<ConstraintsTabProps> = ({ constraints }) => {
  const badgeVariant = (type: string) => {
    switch (type) {
      case 'PRIMARY KEY':
        return 'primaryKey' as const;
      case 'FOREIGN KEY':
        return 'foreignKey' as const;
      case 'UNIQUE':
        return 'info' as const;
      case 'CHECK':
        return 'warning' as const;
      default:
        return 'neutral' as const;
    }
  };

  if (constraints.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-xs text-[var(--text-muted)] gap-2">
        <ShieldCheck size={24} className="opacity-35" />
        <p>No constraints found on this relation.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 select-text">
      <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-panel)]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              <th className="py-2 px-3">Constraint Name</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Columns</th>
              <th className="py-2 px-3">Definition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {constraints.map((con) => (
              <tr
                key={`${con.name}-${con.constraintType}-${con.columns.join(',')}`}
                className="hover:bg-[var(--bg-hover)]/60"
              >
                <td className="py-2 px-3 font-mono font-semibold text-[var(--text)]">{con.name}</td>
                <td className="py-2 px-3">
                  <Badge variant={badgeVariant(con.constraintType)}>{con.constraintType}</Badge>
                </td>
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-1">
                    {con.columns.length > 0
                      ? con.columns.map((c) => (
                          <Badge key={c} variant="type">
                            {c}
                          </Badge>
                        ))
                      : '—'}
                  </div>
                </td>
                <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-secondary)] break-all">
                  {con.definition}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
