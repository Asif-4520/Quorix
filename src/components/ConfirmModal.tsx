import { AlertTriangle, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  sql?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  sql,
  confirmLabel = 'Confirm',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => cancelBtnRef.current?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onCancel]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={16}
              className={danger ? 'text-[var(--error)]' : 'text-[var(--warning)]'}
            />
            <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{message}</p>
          {sql && (
            <pre className="text-[11px] font-mono p-2.5 rounded-lg bg-[var(--code-bg)] border border-[var(--border)] text-[var(--text)] overflow-x-auto max-h-40 whitespace-pre-wrap">
              {sql}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)]">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-colors disabled:opacity-60 ${
              danger
                ? 'bg-[var(--error)] text-white hover:opacity-90'
                : 'bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {submitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
