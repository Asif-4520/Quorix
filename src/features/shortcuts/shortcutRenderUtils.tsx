import { Kbd } from '../../components/ui/Kbd';

export const SHORTCUT_CATEGORIES = [
  'All',
  'Modified',
  'Unbound',
  'Conflicts',
  'General',
  'Settings',
  'Navigation',
  'Window',
  'Database',
  'SQL Editor',
  'Data Grid',
  'Tabs',
] as const;

export type ResizableColKey = 'category' | 'context' | 'keybinding' | 'source' | 'actions';
export type SortKey = 'name' | 'category' | 'scope' | 'keys' | 'source';

export const DEFAULT_COL_WIDTHS: Record<ResizableColKey, number> = {
  category: 108,
  context: 94,
  keybinding: 210,
  source: 80,
  actions: 84,
};

export const COL_LIMITS: Record<ResizableColKey, { min: number; max: number }> = {
  category: { min: 76, max: 180 },
  context: { min: 72, max: 160 },
  keybinding: { min: 130, max: 380 },
  source: { min: 64, max: 130 },
  actions: { min: 68, max: 130 },
};

export function renderComboCaps(
  combo: string,
  size: 'xs' | 'sm' = 'xs',
  align: 'left' | 'right' = 'left',
) {
  const alts = combo
    .split(' / ')
    .map((a) => a.trim())
    .filter(Boolean);
  return (
    <span
      className={`inline-flex items-center gap-1.5 flex-wrap ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      {alts.map((alt, altIdx) => {
        const seen = new Map<string, number>();
        const parts = alt.split('+').map((raw) => {
          const label = raw.trim();
          const occ = (seen.get(label) ?? 0) + 1;
          seen.set(label, occ);
          return { id: `${alt}-${label}-${occ}`, label };
        });
        return (
          <span key={alt} className="inline-flex items-center gap-0.5">
            {altIdx > 0 && <span className="text-[10px] text-[var(--text-muted)] px-0.5">/</span>}
            {parts.map((part, pIdx) => (
              <span key={part.id} className="inline-flex items-center gap-0.5">
                {pIdx > 0 && <span className="text-[9px] text-[var(--text-muted)]">+</span>}
                <Kbd size={size}>{part.label}</Kbd>
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}
