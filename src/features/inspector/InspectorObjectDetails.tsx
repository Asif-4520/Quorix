import { Check, Copy } from 'lucide-react';
import type React from 'react';
import type { InspectorTarget } from '../../types/database';

type ObjectTarget = Extract<InspectorTarget, { kind: 'object' }>;

interface InspectorObjectDetailsProps {
  target: ObjectTarget;
  copiedKey: string | null;
  onCopyText: (key: string, text: string) => void;
}

export const InspectorObjectDetails: React.FC<InspectorObjectDetailsProps> = ({
  target,
  copiedKey,
  onCopyText,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
      {target.subtitle && (
        <div className="text-[11px] text-[var(--text-muted)]">{target.subtitle}</div>
      )}
      <div className="space-y-1.5">
        {Object.entries(target.details).map(([k, v]) => (
          <div
            key={k}
            className="p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)]"
          >
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{k}</div>
            <div className="mt-0.5 font-mono text-[11px] text-[var(--text)] break-words">
              {Array.isArray(v)
                ? v.join(', ') || '—'
                : v === null || v === undefined
                  ? '—'
                  : String(v)}
            </div>
          </div>
        ))}
      </div>
      {target.definition && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
              Definition
            </span>
            <button
              type="button"
              onClick={() => onCopyText('def', target.definition || '')}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
            >
              {copiedKey === 'def' ? <Check size={11} /> : <Copy size={11} />}
              Copy
            </button>
          </div>
          <pre className="p-2.5 rounded-lg bg-[var(--code-bg)] border border-[var(--border)] font-mono text-[11px] text-[var(--text)] overflow-x-auto whitespace-pre-wrap">
            {target.definition}
          </pre>
        </div>
      )}
    </div>
  );
};
