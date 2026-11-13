import { Database, GitCompareArrows, Settings } from 'lucide-react';
import type React from 'react';
import { ErDiagramIcon, SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';

interface ToolWindowStripProps {
  databaseOpen: boolean;
  onToggleDatabase: () => void;
  onOpenNewConsole: () => void;
  onOpenErDiagram: () => void;
  onOpenSchemaDiff?: () => void;
  onOpenSettings: () => void;
  isConnected: boolean;
}

export const ToolWindowStrip: React.FC<ToolWindowStripProps> = ({
  databaseOpen,
  onToggleDatabase,
  onOpenNewConsole,
  onOpenErDiagram,
  onOpenSchemaDiff,
  onOpenSettings,
  isConnected,
}) => {
  const sc = (id: string) => formatShortcutForDisplay(getEffectiveShortcut(id));

  const btnCls = (active = false) =>
    `relative w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
      active
        ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
    }`;

  return (
    <aside
      aria-label="Tool Windows"
      className="w-10 shrink-0 bg-[var(--bg-panel)] border-r border-[var(--border)] flex flex-col items-center justify-between py-2 select-none"
    >
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          className={btnCls(databaseOpen)}
          onClick={onToggleDatabase}
          title={`Database Explorer (${sc('toggle-sidebar')})`}
          data-tooltip-side="right"
        >
          <Database size={16} />
        </button>

        <button
          type="button"
          className={btnCls(false)}
          onClick={onOpenNewConsole}
          title={`New SQL Query (${sc('new-sql-tab')})`}
          data-tooltip-side="right"
        >
          <SqlQueryIcon size={16} />
        </button>

        <button
          type="button"
          disabled={!isConnected}
          className={`${btnCls(false)} disabled:opacity-35 disabled:cursor-not-allowed`}
          onClick={onOpenErDiagram}
          title={`ER Diagram (${sc('open-er')})`}
          data-tooltip-side="right"
        >
          <ErDiagramIcon size={16} />
        </button>

        {onOpenSchemaDiff && (
          <button
            type="button"
            disabled={!isConnected}
            className={`${btnCls(false)} disabled:opacity-35 disabled:cursor-not-allowed`}
            onClick={onOpenSchemaDiff}
            title={`Schema Diff & Migration (${sc('open-schema-diff')})`}
            data-tooltip-side="right"
          >
            <GitCompareArrows size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          className={btnCls(false)}
          onClick={onOpenSettings}
          title={`Settings (${sc('open-settings')})`}
          data-tooltip-side="right"
        >
          <Settings size={15} />
        </button>
      </div>
    </aside>
  );
};
