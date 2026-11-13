import { Braces, Check, Copy, Edit3, Key } from 'lucide-react';
import type React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Checkbox } from '../../components/ui/Checkbox';
import type { ColumnInfo } from '../../types/database';
import { tryPrettyJson } from './inspectorUtils';

interface InspectorFieldCardProps {
  col: string;
  val: string | null;
  meta: ColumnInfo | undefined;
  isSelected: boolean;
  isFieldEditing: boolean;
  canEditField: boolean;
  isRawJson: boolean;
  copiedKey: string | null;
  editText: string;
  editAsNull: boolean;
  editTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  registerRowRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditText: (nextText: string) => void;
  onChangeEditAsNull: (nextNull: boolean) => void;
  onToggleJsonView: () => void;
  onCopyValue: () => void;
}

export const InspectorFieldCard: React.FC<InspectorFieldCardProps> = ({
  col,
  val,
  meta,
  isSelected,
  isFieldEditing,
  canEditField,
  isRawJson,
  copiedKey,
  editText,
  editAsNull,
  editTextareaRef,
  registerRowRef,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEditText,
  onChangeEditAsNull,
  onToggleJsonView,
  onCopyValue,
}) => {
  const jsonInfo = tryPrettyJson(val);
  const isMultiline = val !== null && (val.includes('\n') || val.length > 90);

  return (
    <div
      ref={registerRowRef}
      data-inspector-field={col}
      data-inspector-selected={isSelected ? 'true' : undefined}
      onClick={() => {
        if (!isFieldEditing) onSelect();
      }}
      onDoubleClick={() => {
        if (!isFieldEditing && canEditField) onStartEdit();
      }}
      onKeyDown={(e) => {
        if (
          !isFieldEditing &&
          e.target === e.currentTarget &&
          canEditField &&
          (e.key === 'Enter' || e.key === 'F2')
        ) {
          e.preventDefault();
          onStartEdit();
        }
      }}
      className={`group/field px-3 py-2.5 transition-colors border-l-2 ${
        isFieldEditing
          ? 'border-l-[var(--accent)] bg-[var(--bg-panel)]'
          : isSelected
            ? 'border-l-[var(--accent)] bg-[var(--accent-muted)]/45'
            : 'border-l-transparent hover:bg-[var(--bg-hover)]/70'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {meta?.primaryKey && (
            <span title="Primary Key" className="inline-flex shrink-0">
              <Key size={11} className="text-amber-500" />
            </span>
          )}
          <span className="text-[11.5px] font-semibold font-mono text-[var(--text)] truncate">
            {col}
          </span>
          {meta?.dataType && <Badge variant="type">{meta.dataType}</Badge>}
        </div>

        <div
          className={`flex items-center gap-1 shrink-0 transition-opacity ${
            isSelected || isFieldEditing
              ? 'opacity-100'
              : 'opacity-0 group-hover/field:opacity-100 focus-within:opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {!isFieldEditing && jsonInfo.valid && (
            <button
              type="button"
              onClick={onToggleJsonView}
              className="px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[10px] text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1"
              title="Toggle Pretty / Raw JSON"
            >
              <Braces size={10} />
              {isRawJson ? 'Raw' : 'Pretty'}
            </button>
          )}
          {canEditField && !isFieldEditing && (
            <button
              type="button"
              onClick={onStartEdit}
              aria-label={`Edit ${col} value`}
              title={`Edit ${col} value`}
              className="p-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]"
            >
              <Edit3 size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={onCopyValue}
            aria-label={`Copy ${col} value`}
            title={`Copy ${col} value`}
            className="p-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]"
          >
            {copiedKey === `val:${col}` ? (
              <Check size={11} className="text-[var(--success)]" />
            ) : (
              <Copy size={11} />
            )}
          </button>
        </div>
      </div>

      <div className="mt-1.5">
        {isFieldEditing ? (
          <div className="space-y-2">
            <textarea
              ref={editTextareaRef}
              aria-label={`Edit ${col}`}
              value={editAsNull ? '' : editText}
              placeholder={
                editAsNull
                  ? 'SQL NULL — type a value to replace NULL, or Apply to keep NULL'
                  : undefined
              }
              onChange={(e) => onChangeEditText(e.target.value)}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSaveEdit();
                }
              }}
              rows={isMultiline ? 5 : 3}
              className={`w-full font-mono text-[11.5px] bg-[var(--code-bg)] border border-[var(--border-focus)] rounded-md px-2.5 py-2 text-[var(--text)] resize-y focus:outline-none ${
                editAsNull ? 'opacity-70 italic' : ''
              }`}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editAsNull}
                  onChange={onChangeEditAsNull}
                  size="sm"
                  label="SQL NULL"
                />
                <span className="text-[10px] text-[var(--text-muted)]">Ctrl+Enter · Esc</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-2 py-1 rounded text-[11px] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] inline-flex items-center gap-1"
                >
                  <Check size={11} />
                  Apply
                </button>
              </div>
            </div>
          </div>
        ) : val === null ? (
          <span className="inline-flex px-1.5 py-0.5 rounded bg-[var(--null-badge-bg)] text-[var(--null-badge-text)] font-mono text-[10.5px] italic">
            NULL
          </span>
        ) : val === '' ? (
          <span className="font-mono text-[11px] italic text-[var(--text-muted)]">
            (empty string)
          </span>
        ) : jsonInfo.valid ? (
          <pre className="m-0 rounded-md bg-[var(--code-bg)] border border-[var(--border-subtle)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text)] whitespace-pre-wrap break-words max-h-48 overflow-auto">
            {isRawJson ? val : jsonInfo.formatted}
          </pre>
        ) : isSelected || !isMultiline ? (
          <div className="font-mono text-[11.5px] text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-40 overflow-auto">
            {val}
          </div>
        ) : (
          <div className="font-mono text-[11.5px] text-[var(--text-secondary)] line-clamp-2 break-words">
            {val}
          </div>
        )}
      </div>
    </div>
  );
};
