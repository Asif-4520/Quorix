import { Check, Copy } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { SqlQueryIcon } from '../../../components/ui/DatabaseIcons';

interface DdlTabProps {
  tableName: string;
  schema?: string;
  ddl: string;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DdlTab: React.FC<DdlTabProps> = ({ tableName, schema, ddl, onShowToast }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(ddl);
    setCopied(true);
    onShowToast?.('DDL copied to clipboard', 'info');
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 1500);
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-3 select-text">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <SqlQueryIcon size={14} className="text-[var(--accent)]" />
          <span className="font-mono font-semibold">
            {schema ? `${schema}.` : ''}
            {tableName}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5"
        >
          {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy DDL'}
        </button>
      </div>

      <pre className="p-4 rounded-xl bg-[var(--code-bg)] border border-[var(--border)] font-mono text-xs leading-relaxed text-[var(--text)] overflow-x-auto whitespace-pre-wrap">
        {ddl || '-- DDL not available'}
      </pre>
    </div>
  );
};
