import { Code2, Cpu, Database, Info, Layout, Palette, Shield, Sliders, Table } from 'lucide-react';
import type React from 'react';

export type SettingsTabId =
  | 'appearance'
  | 'editor'
  | 'grid'
  | 'database'
  | 'workspace'
  | 'performance'
  | 'security'
  | 'advanced'
  | 'about';

export const SECTIONS: Array<{
  id: SettingsTabId;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Code2 },
  { id: 'grid', label: 'Data Grid', icon: Table },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'workspace', label: 'Workspace', icon: Layout },
  { id: 'performance', label: 'Performance', icon: Cpu },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'advanced', label: 'Advanced', icon: Sliders },
  { id: 'about', label: 'About', icon: Info },
];

export const GLOBAL_FONT_PRESETS = [11, 12, 13, 14, 15, 16, 18] as const;

export const UI_FONT_PRESETS = [
  {
    label: 'Inter / Modern Sans',
    value: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
  },
  {
    label: 'Bahnschrift (Geometric)',
    value: 'Bahnschrift, "Avenir Next", "Segoe UI", sans-serif',
  },
  {
    label: 'Calibri (Humanist)',
    value: 'Calibri, "Gill Sans", "Trebuchet MS", sans-serif',
  },
  {
    label: 'Verdana (Sharp Wide)',
    value: 'Verdana, Geneva, Tahoma, sans-serif',
  },
  {
    label: 'Georgia (Editorial Serif)',
    value: 'Georgia, Cambria, "Times New Roman", serif',
  },
  {
    label: 'Monospace Developer UI',
    value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  },
] as const;

export const EDITOR_FONT_PRESETS = [
  {
    label: 'JetBrains Mono',
    value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  },
  {
    label: 'Cascadia Code',
    value: '"Cascadia Code", Consolas, monospace',
  },
  {
    label: 'Consolas',
    value: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
  },
  {
    label: 'Lucida Console',
    value: '"Lucida Console", "DejaVu Sans Mono", Menlo, monospace',
  },
  {
    label: 'Courier New',
    value: '"Courier New", Courier, monospace',
  },
  {
    label: 'Fira Code',
    value: '"Fira Code", "Cascadia Code", Consolas, monospace',
  },
] as const;
