import type React from 'react';

export interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  ariaLabel?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  indeterminate = false,
  onChange,
  label,
  ariaLabel,
  description,
  disabled = false,
  size = 'md',
  className = '',
  id,
}) => {
  const isActive = checked || indeterminate;
  const boxSize =
    size === 'sm' ? 'w-[15px] h-[15px] rounded-[4px]' : 'w-[17px] h-[17px] rounded-[5px]';
  const svgSize = size === 'sm' ? 10 : 12;

  const toggle = () => {
    if (!disabled) onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  };

  return (
    <label
      htmlFor={id}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={`group inline-flex ${
        description ? 'items-start' : 'items-center'
      } gap-2.5 select-none transition-colors ${
        disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <span
        role="checkbox"
        id={id}
        aria-label={ariaLabel}
        aria-checked={indeterminate ? 'mixed' : checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`relative shrink-0 ${description ? 'mt-0.5' : ''} inline-flex items-center justify-center ${boxSize} border-[1.5px] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-panel)] active:scale-95 ${
          isActive
            ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-text)] shadow-xs group-hover:brightness-105 group-hover:ring-4 group-hover:ring-[var(--accent)]/15'
            : 'bg-[var(--bg-panel)] border-[var(--text-muted)]/55 group-hover:border-[var(--accent)] group-hover:bg-[var(--bg-surface)] group-hover:ring-4 group-hover:ring-[var(--accent)]/10'
        }`}
      >
        {indeterminate ? (
          <svg width={svgSize} height={svgSize} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 6H9.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            width={svgSize}
            height={svgSize}
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className={`transition-all duration-150 ${
              checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            }`}
          >
            <path
              d="M2.25 6.2L4.8 8.75L9.75 3.4"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      {(label || description) && (
        <span className="flex flex-col min-w-0 leading-tight">
          {label && (
            <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text)] transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5">{description}</span>
          )}
        </span>
      )}
    </label>
  );
};
