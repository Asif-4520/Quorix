import { ArrowRight } from 'lucide-react';
import type React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { RelationsIcon } from '../../../components/ui/DatabaseIcons';
import type { ForeignKeyInfo } from '../../../types/database';

interface RelationsTabProps {
  foreignKeys: ForeignKeyInfo[];
  onNavigateToTable?: (table: string, schema?: string) => void;
}

export const RelationsTab: React.FC<RelationsTabProps> = ({ foreignKeys, onNavigateToTable }) => {
  const outgoing = foreignKeys.filter((f) => f.direction !== 'incoming');
  const incoming = foreignKeys.filter((f) => f.direction === 'incoming');

  const renderList = (title: string, items: ForeignKeyInfo[]) => (
    <div className="space-y-2">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)]">
          None
        </div>
      ) : (
        <div className="grid gap-2">
          {items.map((fk) => (
            <div
              key={`${fk.name || 'fk'}-${fk.fromSchema || ''}-${fk.fromTable}-${fk.fromColumn}-${fk.toTable}-${fk.toColumn}`}
              className="p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => onNavigateToTable?.(fk.fromTable, fk.fromSchema)}
                  className="font-semibold text-[var(--text)] hover:text-[var(--accent)] hover:underline"
                >
                  {fk.fromSchema ? `${fk.fromSchema}.` : ''}
                  {fk.fromTable}.{fk.fromColumn}
                </button>
                <ArrowRight size={13} className="text-[var(--accent)]" />
                <button
                  type="button"
                  onClick={() => onNavigateToTable?.(fk.toTable, fk.toSchema)}
                  className="font-semibold text-[var(--accent)] hover:underline"
                >
                  {fk.toSchema ? `${fk.toSchema}.` : ''}
                  {fk.toTable}.{fk.toColumn}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {fk.name && <Badge variant="type">{fk.name}</Badge>}
                {fk.onUpdate && <Badge variant="neutral">ON UPDATE {fk.onUpdate}</Badge>}
                {fk.onDelete && <Badge variant="neutral">ON DELETE {fk.onDelete}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (foreignKeys.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-xs text-[var(--text-muted)] gap-2">
        <RelationsIcon size={24} className="opacity-35" />
        <p>No foreign-key relationships found for this table.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-5 select-text">
      {renderList('Outgoing Foreign Keys (References)', outgoing)}
      {renderList('Incoming Foreign Keys (Referenced By)', incoming)}
    </div>
  );
};
