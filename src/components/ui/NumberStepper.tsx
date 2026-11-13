import { Minus, Plus } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';

export interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  min,
  max,
  step = 1,
  unit,
  ariaLabel,
  disabled = false,
  onChange,
  className = '',
}) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const clampAndRound = (n: number) => {
    const clamped = Math.min(max, Math.max(min, n));
    const precision = step < 1 ? 10 : 1;
    return Math.round(clamped * precision) / precision;
  };

  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || draft.trim() === '') {
      setDraft(String(value));
      return;
    }
    const next = clampAndRound(parsed);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const stepBy = (dir: -1 | 1) => {
    if (disabled) return;
    const next = clampAndRound((Number.isFinite(value) ? value : min) + dir * step);
    onChange(next);
  };

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-[var(--accent)]/35 overflow-hidden transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => stepBy(-1)}
        aria-label={ariaLabel ? `Decrease ${ariaLabel}` : 'Decrease'}
        className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={11} />
      </button>
      <input
        type="number"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const parsed = Number(raw);
          if (raw.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
            onChange(parsed);
          }
        }}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className="quorix-no-spinner w-14 border-none! bg-transparent! rounded-none! px-1 py-1 text-center font-mono text-[11.5px] font-medium text-[var(--text)] tabular-nums focus:shadow-none!"
      />
      {unit && (
        <span className="pr-1.5 text-[10.5px] font-mono text-[var(--text-muted)] select-none">
          {unit}
        </span>
      )}
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => stepBy(1)}
        aria-label={ariaLabel ? `Increase ${ariaLabel}` : 'Increase'}
        className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors border-l border-[var(--border-subtle)]"
      >
        <Plus size={11} />
      </button>
    </div>
  );
};
