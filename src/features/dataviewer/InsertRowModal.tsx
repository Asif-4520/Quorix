import { Plus, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Checkbox } from '../../components/ui/Checkbox';
import type { ColumnInfo } from '../../types/database';

interface InsertRowModalProps {
  isOpen: boolean;
  tableName: string;
  columns: ColumnInfo[];
  onClose: () => void;
  onSubmit: (row: Record<string, string | null>) => Promise<void>;
}

export const InsertRowModal: React.FC<InsertRowModalProps> = ({
  isOpen,
  tableName,
  columns,
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [nullFlags, setNullFlags] = useState<Record<string, boolean>>({});
  const [skipDefaultFlags, setSkipDefaultFlags] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const initNulls: Record<string, boolean> = {};
    const initSkip: Record<string, boolean> = {};
    for (const c of columns) {
      if (c.autoIncrement || c.isIdentity || c.isGenerated || c.defaultValue) {
        initSkip[c.name] = true;
      } else if (c.nullable) {
        initNulls[c.name] = true;
      }
    }
    setValues({});
    setNullFlags(initNulls);
    setSkipDefaultFlags(initSkip);
    setErrorMsg(null);
  }, [isOpen, columns]);

  if (!isOpen) return null;

  const submitForm = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, string | null> = {};
      for (const col of columns) {
        if (col.isGenerated || skipDefaultFlags[col.name]) continue;
        payload[col.name] = nullFlags[col.name] ? null : (values[col.name] ?? '');
      }
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <form
        className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void submitForm();
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void submitForm();
          }
        }}
      >
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus size={15} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">
              Insert Row into <span className="font-mono">{tableName}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-md bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-[11px]">
              {errorMsg}
            </div>
          )}

          {columns.map((col) => {
            const skip = !!skipDefaultFlags[col.name];
            const isNull = !!nullFlags[col.name];
            return (
              <div key={col.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-[var(--text)]">{col.name}</span>
                    <Badge variant="type">{col.dataType}</Badge>
                    {col.primaryKey && <Badge variant="primaryKey">PK</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    {(col.autoIncrement || col.isIdentity || col.defaultValue) &&
                      !col.isGenerated && (
                        <Checkbox
                          checked={skip}
                          onChange={(checked) =>
                            setSkipDefaultFlags((p) => ({
                              ...p,
                              [col.name]: checked,
                            }))
                          }
                          size="sm"
                          label="Default"
                        />
                      )}
                    {col.nullable && !skip && !col.isGenerated && (
                      <Checkbox
                        checked={isNull}
                        onChange={(checked) => setNullFlags((p) => ({ ...p, [col.name]: checked }))}
                        size="sm"
                        label="NULL"
                      />
                    )}
                  </div>
                </div>

                {col.isGenerated ? (
                  <div className="px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] italic">
                    Generated column (computed automatically)
                  </div>
                ) : skip ? (
                  <div className="px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-muted)]">
                    {col.defaultValue ? `DEFAULT (${col.defaultValue})` : 'AUTO / IDENTITY'}
                  </div>
                ) : isNull ? (
                  <div className="px-2.5 py-1.5 rounded bg-[var(--null-badge-bg)] border border-[var(--border-subtle)] text-[11px] font-mono italic text-[var(--null-badge-text)]">
                    NULL
                  </div>
                ) : (
                  <input
                    type="text"
                    value={values[col.name] ?? ''}
                    onChange={(e) => setValues((p) => ({ ...p, [col.name]: e.target.value }))}
                    placeholder={`Enter ${col.dataType}…`}
                    className="w-full font-mono"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[var(--text-muted)]">Ctrl+Enter to submit</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold disabled:opacity-60"
            >
              {submitting ? 'Inserting…' : 'Insert Row'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
