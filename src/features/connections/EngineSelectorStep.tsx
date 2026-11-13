import { ArrowRight, Check } from 'lucide-react';
import type React from 'react';
import { EngineIcon } from '../../components/ui/DatabaseIcons';
import { getEngineDisplayName } from '../../services/envTag';
import type { DatabaseEngine } from '../../types/database';
import { SUPPORTED_DB_ENGINES } from './connectionFormUtils';

interface EngineSelectorStepProps {
  selectedEngine: DatabaseEngine;
  onSelectEngine: (engine: DatabaseEngine) => void;
  onAdvance: (engine: DatabaseEngine) => void;
  onCancel: () => void;
}

export const EngineSelectorStep: React.FC<EngineSelectorStepProps> = ({
  selectedEngine,
  onSelectEngine,
  onAdvance,
  onCancel,
}) => (
  <>
    <div className="px-6 pt-5 pb-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--accent)]">
          Step 1 of 2
        </div>
        <h2 className="text-sm font-semibold text-[var(--text)] mt-0.5">Select Database</h2>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div role="radiogroup" aria-label="Supported Database Engines" className="space-y-2.5">
        {SUPPORTED_DB_ENGINES.map((eng) => {
          const active = selectedEngine === eng.id;
          return (
            <button
              key={eng.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelectEngine(eng.id)}
              onDoubleClick={() => onAdvance(eng.id)}
              className={`group w-full px-4 py-3.5 rounded-xl border text-left flex items-center gap-3.5 transition-all ${
                active
                  ? 'bg-[var(--accent-muted)] border-[var(--accent)] ring-1 ring-[var(--accent)]/40'
                  : 'bg-[var(--bg-surface)]/70 border-[var(--border)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] flex items-center justify-center shrink-0 p-1.5">
                <EngineIcon engine={eng.id} size={24} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[var(--text)]">{eng.name}</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{eng.subtitle}</div>
              </div>

              <span className="hidden sm:inline-flex text-[10.5px] px-2 py-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] shrink-0">
                {eng.tag}
              </span>

              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  active
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-text)]'
                    : 'border-[var(--border)] bg-[var(--bg-panel)] text-transparent'
                }`}
              >
                <Check size={11} strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
    </div>

    <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-end gap-2 shrink-0">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => onAdvance(selectedEngine)}
        className="px-4 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold inline-flex items-center gap-1.5"
      >
        Next: Configure {getEngineDisplayName(selectedEngine)}
        <ArrowRight size={13} />
      </button>
    </div>
  </>
);
