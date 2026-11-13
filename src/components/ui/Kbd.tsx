import type React from 'react';

export interface KbdProps {
  children: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm';
}

export const Kbd: React.FC<KbdProps> = ({ children, className = '', size = 'xs' }) => {
  const sizeClasses =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5 min-w-[18px]'
      : 'text-[11px] px-2 py-0.5 min-w-[20px]';

  return (
    <kbd
      className={`inline-flex items-center justify-center font-mono font-medium tracking-tight rounded-[5px] bg-bg-surface/90 border border-border-base text-text-secondary shadow-xs shadow-black/20 select-none ${sizeClasses} ${className}`}
    >
      {children}
    </kbd>
  );
};
