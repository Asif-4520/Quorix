import type React from 'react';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  unit?: string;
  showValuePill?: boolean;
  disabled?: boolean;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  unit = '',
  showValuePill = false,
  disabled = false,
  className = '',
}) => {
  const safeVal = Number.isFinite(value) ? value : min;
  const clamped = Math.min(max, Math.max(min, safeVal));
  const span = max - min || 1;
  const pct = Math.min(100, Math.max(0, ((clamped - min) / span) * 100));

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div className="relative flex items-center flex-1 min-w-[96px] h-5">
        <div
          aria-hidden="true"
          className="pointer-events-none w-full h-1.5 rounded-full overflow-hidden bg-[var(--bg-active)] border border-[var(--border-subtle)]"
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          aria-label={ariaLabel}
          min={min}
          max={max}
          step={step}
          value={clamped}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="quorix-slider absolute inset-0 w-full h-full m-0 opacity-100"
        />
      </div>
      {showValuePill && (
        <span className="min-w-[44px] text-center px-1.5 py-0.5 rounded-md bg-[var(--bg-panel)] border border-[var(--border)] font-mono text-[11px] font-medium text-[var(--text-secondary)] tabular-nums">
          {clamped}
          {unit}
        </span>
      )}
    </div>
  );
};
