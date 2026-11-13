import type React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'accent'
    | 'primaryKey'
    | 'foreignKey'
    | 'type'
    | 'neutral'
    | 'success'
    | 'warning'
    | 'error'
    | 'info';
  size?: 'xs' | 'sm';
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'xs',
  className = '',
  title,
}) => {
  const sizeClasses =
    size === 'xs' ? 'text-[10px] px-1.5 py-0.5 rounded-[5px]' : 'text-xs px-2 py-0.5 rounded-md';

  const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
    accent:
      'bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/30 font-medium',
    primaryKey:
      'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-semibold',
    foreignKey: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-medium',
    type: 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] font-mono text-[10px]',
    neutral:
      'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] font-normal',
    success:
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-medium',
    warning:
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium',
    error: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-medium',
    info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-medium',
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 select-none tracking-tight transition-colors ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
