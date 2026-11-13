import { AlertTriangle, X } from 'lucide-react';
import type React from 'react';
import { useRef } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Kbd } from '../../components/ui/Kbd';
import { keyboardEventToCombo, type ShortcutItem } from '../../services/shortcuts';
import { renderComboCaps } from './shortcutRenderUtils';

interface ShortcutRecorderDialogProps {
  shortcut: ShortcutItem;
  customInput: string;
  recordingMode: boolean;
  candidateConflicts: ShortcutItem[];
  onChangeInput: (next: string) => void;
  onToggleRecordingMode: () => void;
  onSave: (id: string, clearConflictsWith?: ShortcutItem[]) => void;
  onUnbind: (id: string) => void;
  onCancel: () => void;
}

export const ShortcutRecorderDialog: React.FC<ShortcutRecorderDialogProps> = ({
  shortcut,
  customInput,
  recordingMode,
  candidateConflicts,
  onChangeInput,
  onToggleRecordingMode,
  onSave,
  onUnbind,
  onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-recording-shortcut="true"
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-6"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit Keybinding: ${shortcut.name}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-2xl overflow-hidden animate-in"
      >
        <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[var(--text)] truncate">
                {shortcut.name}
              </h3>
              <Badge variant="type">{shortcut.scope}</Badge>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
              {shortcut.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel keybinding edit"
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    recordingMode ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--text-muted)]'
                  }`}
                />
                {recordingMode ? 'Listening for keystrokes' : 'Manual keybinding syntax'}
              </span>
              <button
                type="button"
                onClick={() => {
                  onToggleRecordingMode();
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text)]"
              >
                {recordingMode ? 'Type Manually' : 'Record Key'}
              </button>
            </div>

            <div
              className={`rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-2.5 transition-colors ${
                recordingMode
                  ? 'border-dashed border-[var(--accent)]/60 bg-[var(--code-bg)]'
                  : 'border-[var(--border)] bg-[var(--code-bg)]'
              }`}
            >
              {customInput ? (
                <div className="flex items-center justify-center min-h-[28px]">
                  {renderComboCaps(customInput, 'sm')}
                </div>
              ) : (
                <div className="min-h-[28px] flex items-center text-[11.5px] italic text-[var(--text-muted)]">
                  Unassigned
                </div>
              )}

              <input
                ref={inputRef}
                type="text"
                readOnly={recordingMode}
                value={customInput}
                autoFocus
                onChange={(e) => !recordingMode && onChangeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (!recordingMode) {
                    if (e.key === 'Enter') onSave(shortcut.id);
                    else if (e.key === 'Escape') {
                      e.stopPropagation();
                      onCancel();
                    }
                    return;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                    onCancel();
                    return;
                  }
                  const combo = keyboardEventToCombo(e.nativeEvent);
                  if (combo) onChangeInput(combo);
                }}
                placeholder={recordingMode ? 'Press keys now…' : 'Type combo (e.g. Ctrl+Alt+K)'}
                className="w-full text-center py-1.5 px-3 font-mono text-xs bg-[var(--bg-panel)] border-[var(--border)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
              <span>Default:</span>
              {shortcut.defaultKeys ? (
                <>
                  <Kbd size="xs">{shortcut.defaultKeys}</Kbd>
                  {customInput !== shortcut.defaultKeys && (
                    <button
                      type="button"
                      onClick={() => onChangeInput(shortcut.defaultKeys)}
                      className="text-[10.5px] text-[var(--accent)] hover:underline ml-1"
                    >
                      Use Default
                    </button>
                  )}
                </>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)]">
                  Unassigned
                </span>
              )}
            </div>
            {candidateConflicts.length > 0 && (
              <span className="text-amber-500 font-medium inline-flex items-center gap-1">
                <AlertTriangle size={11} />
                Conflicts: {candidateConflicts.map((c) => c.name).join(', ')}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onUnbind(shortcut.id)}
            className="px-2.5 py-1.5 rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-hover)] text-xs font-medium"
          >
            Unbind
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium"
            >
              Cancel
            </button>
            {candidateConflicts.length > 0 && (
              <button
                type="button"
                onClick={() => onSave(shortcut.id, candidateConflicts)}
                className="px-3 py-1.5 rounded-md bg-amber-500 text-white font-semibold text-xs hover:opacity-90"
                title={`Unbind conflicting: ${candidateConflicts.map((c) => c.name).join(', ')}`}
              >
                Replace ({candidateConflicts.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => onSave(shortcut.id)}
              className="px-3.5 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-text)] font-semibold text-xs hover:bg-[var(--accent-hover)]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
