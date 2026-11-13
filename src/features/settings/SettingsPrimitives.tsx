import type React from 'react';

interface SettingSectionProps {
  title: string;
  sectionTag?: string;
  modified?: boolean;
  onResetSection?: () => void;
  children: React.ReactNode;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  sectionTag,
  modified = false,
  onResetSection,
  children,
}) => (
  <section className="space-y-2.5">
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </h3>
        {modified && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
            title="Contains customized values"
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        {sectionTag && (
          <span className="text-[10px] font-medium text-[var(--text-muted)]">{sectionTag}</span>
        )}
        {modified && onResetSection && (
          <button
            type="button"
            onClick={onResetSection}
            className="text-[10.5px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/55 divide-y divide-[var(--border-subtle)] overflow-hidden">
      {children}
    </div>
  </section>
);

interface SettingRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export const SettingRow: React.FC<SettingRowProps> = ({ label, hint, children }) => (
  <div className="px-4 py-3 flex items-center justify-between gap-6 min-h-[46px] hover:bg-[var(--bg-hover)]/25 transition-colors">
    <div className="min-w-0">
      <div className="text-[12.5px] font-medium text-[var(--text)] leading-snug">{label}</div>
      {hint && (
        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{hint}</div>
      )}
    </div>
    <div className="shrink-0 flex items-center gap-2">{children}</div>
  </div>
);

interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] gap-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-[6px] text-[11.5px] inline-flex items-center gap-1.5 transition-colors ${
              active
                ? 'bg-[var(--accent-muted)] text-[var(--accent)] font-medium'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]/60'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
