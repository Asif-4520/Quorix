import { FilePlus2, FolderOpen } from 'lucide-react';
import type React from 'react';
import { Checkbox } from '../../components/ui/Checkbox';
import { SqliteIcon } from '../../components/ui/DatabaseIcons';

interface SqliteConnectionFieldsProps {
  sqlitePath: string;
  sqliteCreateMissing: boolean;
  sqliteReadOnly: boolean;
  recentSqliteFiles: string[];
  onSqlitePathChange: (value: string) => void;
  onSqliteCreateMissingChange: (value: boolean) => void;
  onSqliteReadOnlyChange: (value: boolean) => void;
  onBrowseLocalFile: () => void;
  onCreateLocalFile: () => void;
  onSelectRecentFile: (filePath: string) => void;
}

export const SqliteConnectionFields: React.FC<SqliteConnectionFieldsProps> = ({
  sqlitePath,
  sqliteCreateMissing,
  sqliteReadOnly,
  recentSqliteFiles,
  onSqlitePathChange,
  onSqliteCreateMissingChange,
  onSqliteReadOnlyChange,
  onBrowseLocalFile,
  onCreateLocalFile,
  onSelectRecentFile,
}) => (
  <div className="space-y-4">
    <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3">
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
          Database File
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={sqlitePath}
            onChange={(e) => onSqlitePathChange(e.target.value)}
            placeholder="C:\path\to\database.sqlite"
            className="flex-1 min-w-[200px] font-mono"
            autoFocus
          />
          <button
            type="button"
            onClick={onBrowseLocalFile}
            className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 font-medium"
          >
            <FolderOpen size={13} /> Browse File
          </button>
          <button
            type="button"
            onClick={onCreateLocalFile}
            className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 font-medium"
          >
            <FilePlus2 size={13} /> New File
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-1">
        <Checkbox
          checked={sqliteCreateMissing}
          onChange={onSqliteCreateMissingChange}
          size="sm"
          label="Create if missing"
        />
        <Checkbox
          checked={sqliteReadOnly}
          onChange={onSqliteReadOnlyChange}
          size="sm"
          label="Read-Only Mode"
        />
      </div>
    </div>

    {recentSqliteFiles.length > 0 && (
      <div className="space-y-1.5">
        <div className="text-[10.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Recent Files
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {recentSqliteFiles.map((filePath) => (
            <button
              type="button"
              key={filePath}
              onClick={() => onSelectRecentFile(filePath)}
              className="w-full text-left px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] font-mono text-[11px] flex items-center gap-2"
            >
              <SqliteIcon size={14} />
              <span className="truncate">{filePath}</span>
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);
