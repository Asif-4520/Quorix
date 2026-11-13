import type { ThemeMode, ThemeName } from '../types/database';

export interface ThemeColors {
  name: ThemeName;
  displayName: string;
  isDark: boolean;
  bg: string;
  bgSidebar: string;
  bgPanel: string;
  bgSurface: string;
  bgHover: string;
  bgActive: string;
  border: string;
  borderSubtle: string;
  borderFocus: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentText: string;
  accentMuted: string;
  selection: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  nullBg: string;
  nullText: string;
  dirtyUpdate: string;
  dirtyInsert: string;
  dirtyDelete: string;
  codeBg: string;
  syntaxKeyword: string;
  syntaxString: string;
  syntaxNumber: string;
  syntaxFunction: string;
  syntaxComment: string;
  syntaxType: string;
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  'obsidian-dark': {
    name: 'obsidian-dark',
    displayName: 'Obsidian Dark',
    isDark: true,
    bg: '#0c0e12',
    bgSidebar: '#10141a',
    bgPanel: '#131821',
    bgSurface: '#19202c',
    bgHover: '#1f2737',
    bgActive: '#263044',
    border: '#242c38',
    borderSubtle: '#1b222d',
    borderFocus: '#10b981',
    text: '#f1f5f9',
    textSecondary: '#cbd5e1',
    textMuted: '#7c8ba1',
    accent: '#10b981',
    accentHover: '#059669',
    accentText: '#042319',
    accentMuted: 'rgba(16, 185, 129, 0.16)',
    selection: 'rgba(16, 185, 129, 0.24)',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#38bdf8',
    nullBg: 'rgba(148, 163, 184, 0.12)',
    nullText: '#94a3b8',
    dirtyUpdate: 'rgba(245, 158, 11, 0.14)',
    dirtyInsert: 'rgba(16, 185, 129, 0.14)',
    dirtyDelete: 'rgba(239, 68, 68, 0.16)',
    codeBg: '#090b0e',
    syntaxKeyword: '#34d399',
    syntaxString: '#fde047',
    syntaxNumber: '#fb923c',
    syntaxFunction: '#60a5fa',
    syntaxComment: '#64748b',
    syntaxType: '#c084fc',
  },
  'datagrip-dark': {
    name: 'datagrip-dark',
    displayName: 'Slate Studio Dark',
    isDark: true,
    bg: '#1e1f22',
    bgSidebar: '#1e1f22',
    bgPanel: '#2b2d30',
    bgSurface: '#313438',
    bgHover: '#393b40',
    bgActive: '#43454a',
    border: '#393b40',
    borderSubtle: '#2b2d30',
    borderFocus: '#3574f0',
    text: '#dfdfe0',
    textSecondary: '#bcbec4',
    textMuted: '#868a91',
    accent: '#3574f0',
    accentHover: '#2e66d4',
    accentText: '#ffffff',
    accentMuted: 'rgba(53, 116, 240, 0.18)',
    selection: 'rgba(53, 116, 240, 0.28)',
    success: '#59a869',
    warning: '#e5a638',
    error: '#e05555',
    info: '#56a8f5',
    nullBg: 'rgba(188, 190, 196, 0.12)',
    nullText: '#9da0a8',
    dirtyUpdate: 'rgba(229, 166, 56, 0.15)',
    dirtyInsert: 'rgba(89, 168, 105, 0.16)',
    dirtyDelete: 'rgba(224, 85, 85, 0.18)',
    codeBg: '#1e1f22',
    syntaxKeyword: '#cf8e6d',
    syntaxString: '#6aab73',
    syntaxNumber: '#2aacb8',
    syntaxFunction: '#56a8f5',
    syntaxComment: '#7a7e85',
    syntaxType: '#c77dbb',
  },
  midnight: {
    name: 'midnight',
    displayName: 'Midnight',
    isDark: true,
    bg: '#080d1a',
    bgSidebar: '#0c1324',
    bgPanel: '#0f172a',
    bgSurface: '#1e293b',
    bgHover: '#25344d',
    bgActive: '#2d3f5d',
    border: '#1e2d45',
    borderSubtle: '#131f33',
    borderFocus: '#38bdf8',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#7a8da8',
    accent: '#38bdf8',
    accentHover: '#0284c7',
    accentText: '#082f49',
    accentMuted: 'rgba(56, 189, 248, 0.15)',
    selection: 'rgba(56, 189, 248, 0.25)',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    nullBg: 'rgba(148, 163, 184, 0.12)',
    nullText: '#94a3b8',
    dirtyUpdate: 'rgba(251, 191, 36, 0.14)',
    dirtyInsert: 'rgba(52, 211, 153, 0.14)',
    dirtyDelete: 'rgba(248, 113, 113, 0.16)',
    codeBg: '#060a14',
    syntaxKeyword: '#38bdf8',
    syntaxString: '#a7f3d0',
    syntaxNumber: '#f472b6',
    syntaxFunction: '#818cf8',
    syntaxComment: '#64748b',
    syntaxType: '#c084fc',
  },
  graphite: {
    name: 'graphite',
    displayName: 'Graphite',
    isDark: true,
    bg: '#141416',
    bgSidebar: '#18181c',
    bgPanel: '#1f1f24',
    bgSurface: '#282830',
    bgHover: '#32323d',
    bgActive: '#3d3d4a',
    border: '#32323a',
    borderSubtle: '#222228',
    borderFocus: '#f59e0b',
    text: '#ededf0',
    textSecondary: '#c8c8cf',
    textMuted: '#8e8e9b',
    accent: '#f59e0b',
    accentHover: '#d97706',
    accentText: '#2c1102',
    accentMuted: 'rgba(245, 158, 11, 0.15)',
    selection: 'rgba(245, 158, 11, 0.25)',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#38bdf8',
    nullBg: 'rgba(161, 161, 170, 0.14)',
    nullText: '#a1a1aa',
    dirtyUpdate: 'rgba(245, 158, 11, 0.15)',
    dirtyInsert: 'rgba(34, 197, 94, 0.15)',
    dirtyDelete: 'rgba(239, 68, 68, 0.16)',
    codeBg: '#101012',
    syntaxKeyword: '#fbbf24',
    syntaxString: '#a3e635',
    syntaxNumber: '#f97316',
    syntaxFunction: '#38bdf8',
    syntaxComment: '#71717a',
    syntaxType: '#e879f9',
  },
  'pearl-light': {
    name: 'pearl-light',
    displayName: 'Pearl Light',
    isDark: false,
    bg: '#f8fafc',
    bgSidebar: '#f1f5f9',
    bgPanel: '#ffffff',
    bgSurface: '#eef2f6',
    bgHover: '#e2e8f0',
    bgActive: '#cbd5e1',
    border: '#cbd5e1',
    borderSubtle: '#e2e8f0',
    borderFocus: '#4f46e5',
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    accent: '#4f46e5',
    accentHover: '#4338ca',
    accentText: '#ffffff',
    accentMuted: 'rgba(79, 70, 229, 0.1)',
    selection: 'rgba(79, 70, 229, 0.16)',
    success: '#15803d',
    warning: '#b45309',
    error: '#dc2626',
    info: '#0284c7',
    nullBg: 'rgba(100, 116, 139, 0.12)',
    nullText: '#475569',
    dirtyUpdate: 'rgba(217, 119, 6, 0.12)',
    dirtyInsert: 'rgba(22, 163, 74, 0.12)',
    dirtyDelete: 'rgba(220, 38, 38, 0.12)',
    codeBg: '#f8fafc',
    syntaxKeyword: '#4338ca',
    syntaxString: '#047857',
    syntaxNumber: '#c2410c',
    syntaxFunction: '#0369a1',
    syntaxComment: '#64748b',
    syntaxType: '#7c3aed',
  },
  'snow-light': {
    name: 'snow-light',
    displayName: 'Snow Light',
    isDark: false,
    bg: '#ffffff',
    bgSidebar: '#f8fafc',
    bgPanel: '#ffffff',
    bgSurface: '#f3f4f6',
    bgHover: '#e5e7eb',
    bgActive: '#d1d5db',
    border: '#e5e7eb',
    borderSubtle: '#f1f5f9',
    borderFocus: '#2563eb',
    text: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentText: '#ffffff',
    accentMuted: 'rgba(37, 99, 235, 0.1)',
    selection: 'rgba(37, 99, 235, 0.16)',
    success: '#15803d',
    warning: '#b45309',
    error: '#dc2626',
    info: '#0284c7',
    nullBg: 'rgba(107, 114, 128, 0.12)',
    nullText: '#4b5563',
    dirtyUpdate: 'rgba(217, 119, 6, 0.12)',
    dirtyInsert: 'rgba(22, 163, 74, 0.12)',
    dirtyDelete: 'rgba(220, 38, 38, 0.12)',
    codeBg: '#fafafa',
    syntaxKeyword: '#1d4ed8',
    syntaxString: '#047857',
    syntaxNumber: '#c2410c',
    syntaxFunction: '#6d28d9',
    syntaxComment: '#6b7280',
    syntaxType: '#0f766e',
  },
  'soft-light': {
    name: 'soft-light',
    displayName: 'Soft Light',
    isDark: false,
    bg: '#faf7f2',
    bgSidebar: '#f4efe6',
    bgPanel: '#fffdfa',
    bgSurface: '#efe8dc',
    bgHover: '#e5dcce',
    bgActive: '#d9ccba',
    border: '#d9cfbf',
    borderSubtle: '#e8dfd2',
    borderFocus: '#b45309',
    text: '#292524',
    textSecondary: '#44403c',
    textMuted: '#78716c',
    accent: '#b45309',
    accentHover: '#92400e',
    accentText: '#ffffff',
    accentMuted: 'rgba(180, 83, 9, 0.12)',
    selection: 'rgba(180, 83, 9, 0.18)',
    success: '#15803d',
    warning: '#b45309',
    error: '#b91c1c',
    info: '#0369a1',
    nullBg: 'rgba(120, 113, 108, 0.14)',
    nullText: '#57534e',
    dirtyUpdate: 'rgba(180, 83, 9, 0.13)',
    dirtyInsert: 'rgba(21, 128, 61, 0.12)',
    dirtyDelete: 'rgba(185, 28, 28, 0.13)',
    codeBg: '#f6f1e8',
    syntaxKeyword: '#92400e',
    syntaxString: '#15803d',
    syntaxNumber: '#c2410c',
    syntaxFunction: '#6d28d9',
    syntaxComment: '#78716c',
    syntaxType: '#0f766e',
  },
};

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveEffectiveThemeName(
  mode: ThemeMode,
  selectedTheme: ThemeName,
  darkFallback: ThemeName = 'obsidian-dark',
  lightFallback: ThemeName = 'pearl-light',
): ThemeName {
  if (mode === 'system') {
    if (systemPrefersDark()) {
      return THEMES[selectedTheme]?.isDark ? selectedTheme : darkFallback;
    }
    return !THEMES[selectedTheme]?.isDark ? selectedTheme : lightFallback;
  }
  if (mode === 'dark') {
    return THEMES[selectedTheme]?.isDark ? selectedTheme : darkFallback;
  }
  return !THEMES[selectedTheme]?.isDark ? selectedTheme : lightFallback;
}

export function applyTheme(themeName: ThemeName): ThemeColors {
  const t = THEMES[themeName] || THEMES['obsidian-dark'];
  const root = document.documentElement;

  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--bg-sidebar', t.bgSidebar);
  root.style.setProperty('--bg-panel', t.bgPanel);
  root.style.setProperty('--bg-surface', t.bgSurface);
  root.style.setProperty('--bg-hover', t.bgHover);
  root.style.setProperty('--bg-active', t.bgActive);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--border-subtle', t.borderSubtle);
  root.style.setProperty('--border-focus', t.borderFocus);
  root.style.setProperty('--text', t.text);
  root.style.setProperty('--text-secondary', t.textSecondary);
  root.style.setProperty('--text-muted', t.textMuted);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-hover', t.accentHover);
  root.style.setProperty('--accent-text', t.accentText);
  root.style.setProperty('--accent-muted', t.accentMuted);
  root.style.setProperty('--selection', t.selection);
  root.style.setProperty('--success', t.success);
  root.style.setProperty('--warning', t.warning);
  root.style.setProperty('--error', t.error);
  root.style.setProperty('--info', t.info);
  root.style.setProperty('--null-badge-bg', t.nullBg);
  root.style.setProperty('--null-badge-text', t.nullText);
  root.style.setProperty('--dirty-update', t.dirtyUpdate);
  root.style.setProperty('--dirty-insert', t.dirtyInsert);
  root.style.setProperty('--dirty-delete', t.dirtyDelete);
  root.style.setProperty('--code-bg', t.codeBg);

  if (t.isDark) {
    document.body.classList.add('dark');
    document.body.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    document.body.classList.add('light');
    document.body.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  return t;
}
