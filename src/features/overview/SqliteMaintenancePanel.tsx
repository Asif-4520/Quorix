import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/Badge';
import {
  getSqliteMaintenanceInfo,
  runSqliteMaintenance,
  type SqliteMaintenanceAction,
} from '../../services/tauri';
import type { ConnectionSummary, SqliteMaintenanceInfo } from '../../types/database';

interface SqliteMaintenancePanelProps {
  connection: ConnectionSummary;
}

function formatBytesHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export const SqliteMaintenancePanel: React.FC<SqliteMaintenancePanelProps> = ({ connection }) => {
  const [info, setInfo] = useState<SqliteMaintenanceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<SqliteMaintenanceAction | null>(null);

  const loadInfo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSqliteMaintenanceInfo(connection.id);
      setInfo(res);
    } catch (err) {
      toast.error(`Failed loading SQLite PRAGMA stats: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [connection.id]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  const handleAction = async (action: SqliteMaintenanceAction, label: string) => {
    setRunningAction(action);
    try {
      const next = await runSqliteMaintenance(action, connection.id);
      setInfo(next);
      if (action === 'integrity_check') {
        toast.success(`Integrity check: ${next.integrityStatus || 'ok'}`);
      } else if (action === 'wal_checkpoint' && next.walCheckpointResult) {
        toast.success(`WAL Checkpoint (${next.walCheckpointResult})`);
      } else {
        toast.success(`SQLite ${label} completed`);
      }
    } catch (err) {
      toast.error(`SQLite ${label} failed: ${err}`);
    } finally {
      setRunningAction(null);
    }
  };

  const busy = loading || runningAction !== null;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench size={15} className="text-[var(--accent)]" />
          <div>
            <h3 className="text-xs font-semibold text-[var(--text)]">
              SQLite Maintenance &amp; PRAGMA Diagnostics
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Inspect storage health, page fragmentation, WAL journal state, and reclaim free pages.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadInfo()}
          className="px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {info && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)]">File Size</div>
            <div className="font-mono font-semibold text-[var(--text)]">
              {formatBytesHuman(info.fileSizeBytes)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)]">Free Pages (Reclaimable)</div>
            <div className="font-mono font-semibold text-[var(--text)]">
              {info.freelistCount} / {info.pageCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)]">Page Size</div>
            <div className="font-mono font-semibold text-[var(--text)]">{info.pageSize} B</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)]">Journal Mode</div>
            <div className="font-mono font-semibold uppercase text-[var(--accent)]">
              {info.journalMode}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)]">WAL Sidecar</div>
            <div className="font-mono font-semibold text-[var(--text)]">
              {info.walSizeBytes !== undefined ? formatBytesHuman(info.walSizeBytes) : 'None'}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)]">Foreign Keys / Schema v</div>
            <div className="font-mono font-semibold text-[var(--text)]">
              {info.foreignKeys ? 'ON' : 'OFF'} · v{info.userVersion}
            </div>
          </div>
        </div>
      )}

      {info?.integrityStatus && (
        <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] flex items-center gap-2 text-xs">
          <CheckCircle2
            size={14}
            className={
              info.integrityStatus.toLowerCase() === 'ok'
                ? 'text-[var(--success)] shrink-0'
                : 'text-[var(--warning)] shrink-0'
            }
          />
          <span className="font-mono text-[11px] text-[var(--text)]">
            integrity_check: {info.integrityStatus}
          </span>
        </div>
      )}

      {info?.walCheckpointResult && (
        <div className="text-[11px] font-mono text-[var(--text-muted)]">
          Last WAL Checkpoint: <Badge variant="info">{info.walCheckpointResult}</Badge>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {(
          [
            { action: 'integrity_check', label: 'PRAGMA integrity_check', readOk: true },
            { action: 'vacuum', label: 'VACUUM', readOk: false },
            { action: 'analyze', label: 'ANALYZE', readOk: false },
            { action: 'reindex', label: 'REINDEX', readOk: false },
            { action: 'wal_checkpoint', label: 'WAL Checkpoint', readOk: false },
          ] as const
        ).map((btn) => {
          const disabled = busy || (connection.readOnly && !btn.readOk);
          const isRunning = runningAction === btn.action;
          return (
            <button
              key={btn.action}
              type="button"
              disabled={disabled}
              onClick={() => void handleAction(btn.action, btn.label)}
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] font-medium text-[var(--text)] inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <Loader2 size={11} className="animate-spin text-[var(--accent)]" />
              ) : btn.action === 'integrity_check' ? (
                <ShieldCheck size={12} className="text-[var(--success)]" />
              ) : (
                <Wrench size={11} className="text-[var(--accent)]" />
              )}
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
