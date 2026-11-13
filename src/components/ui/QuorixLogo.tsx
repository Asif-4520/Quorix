import type React from 'react';
import badgeDark from '../../assets/logos/quorix-badge-dark.png';
import badgeLight from '../../assets/logos/quorix-badge-light.png';
import markDark from '../../assets/logos/quorix-mark-dark.png';
import markLight from '../../assets/logos/quorix-mark-light.png';
import { useSettingsStore } from '../../stores/settingsStore';
import { THEMES } from '../../theme/themes';

interface QuorixLogoProps {
  variant?: 'mark' | 'badge';
  tone?: 'auto' | 'dark' | 'light';
  alt?: string;
  className?: string;
}

export const QuorixLogo: React.FC<QuorixLogoProps> = ({
  variant = 'mark',
  tone = 'auto',
  alt = 'Quorix',
  className = 'w-5 h-5',
}) => {
  const effectiveTheme = useSettingsStore((s) => s.effectiveTheme);
  const isDark = tone === 'auto' ? (THEMES[effectiveTheme]?.isDark ?? true) : tone === 'dark';

  const src =
    variant === 'badge' ? (isDark ? badgeDark : badgeLight) : isDark ? markDark : markLight;

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      data-quorix-logo={variant}
      data-logo-tone={isDark ? 'dark' : 'light'}
      className={`select-none shrink-0 object-contain ${className}`}
    />
  );
};
