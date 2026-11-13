import { ArrowDown, ArrowUp, Key, Link2, MoreVertical, Pin } from 'lucide-react';
import type React from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';
import { formatColumnTypeMeta } from '../../../services/columnTypeFormat';
import type { ColumnInfo, ForeignKeyInfo, QueryResponse } from '../../../types/database';
import { type GridColumnHeaderSpec, type HeaderMenuState, INDEX_GUTTER_WIDTH } from './gridTypes';

interface GridHeaderRowProps {
  data: QueryResponse;
  headers: GridColumnHeaderSpec[];
  colMetaMap: Map<string, ColumnInfo>;
  colDistinctCounts: Map<string, number>;
  outgoingFkMap?: Record<string, ForeignKeyInfo>;
  sortColumn: string | null;
  sortDesc: boolean;
  pinnedLeftOffsets: Map<string, number>;
  lastPinnedColId: string | null;
  allPageSelected: boolean;
  somePageSelected: boolean;
  onToggleAllPageRows: (checked: boolean) => void;
  onSort: (colName: string) => void;
  onAutoFitColumn: (colName: string) => void;
  onSetHeaderMenu: React.Dispatch<React.SetStateAction<HeaderMenuState | null>>;
}

export const GridHeaderRow: React.FC<GridHeaderRowProps> = ({
  data,
  headers,
  colMetaMap,
  colDistinctCounts,
  outgoingFkMap,
  sortColumn,
  sortDesc,
  pinnedLeftOffsets,
  lastPinnedColId,
  allPageSelected,
  somePageSelected,
  onToggleAllPageRows,
  onSort,
  onAutoFitColumn,
  onSetHeaderMenu,
}) => (
  <div className="sticky top-0 z-20 flex items-stretch bg-[var(--bg-panel)] border-b border-[var(--border)] shadow-[0_1px_0_var(--border)] text-xs font-medium select-none">
    <div
      style={{ width: INDEX_GUTTER_WIDTH }}
      className="sticky left-0 z-30 shrink-0 px-2 py-2 border-r border-[var(--border)] flex items-center justify-between bg-[var(--bg-surface)]"
    >
      <Checkbox
        ariaLabel="Select All Rows"
        checked={allPageSelected}
        indeterminate={somePageSelected}
        onChange={onToggleAllPageRows}
        size="sm"
      />
      <span className="text-[10px] font-mono text-[var(--text-muted)]">#</span>
    </div>

    {headers.map((header) => {
      const colName = header.colName;
      const meta = colMetaMap.get(colName);
      const colIdx = data.columns.indexOf(colName);
      const rawType = meta?.dataType || (colIdx >= 0 ? data.columnTypes?.[colIdx] : '') || 'text';
      const typeMeta = formatColumnTypeMeta(rawType);
      const distinctCount = colDistinctCounts.get(colName);
      const fkInfo = outgoingFkMap?.[colName];
      const isSorted = sortColumn === colName;
      const isPinned = pinnedLeftOffsets.has(colName);
      const leftOffset = pinnedLeftOffsets.get(colName);
      const isLastPinned = colName === lastPinnedColId;

      const headerTooltip = [
        `${colName} (${typeMeta.fullType})`,
        meta?.primaryKey ? 'Primary Key' : null,
        fkInfo ? `FK -> ${fkInfo.toTable}.${fkInfo.toColumn}` : null,
        meta && !meta.nullable ? 'NOT NULL' : null,
        distinctCount !== undefined ? `${distinctCount} unique values on page` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      return (
        <div
          key={header.id}
          data-column-header={colName}
          style={{
            width: header.size,
            ...(isPinned ? { left: leftOffset } : {}),
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSetHeaderMenu({
              colName,
              x: Math.min(e.clientX, window.innerWidth - 210),
              y: Math.min(e.clientY, window.innerHeight - 280),
            });
          }}
          className={`group/hdr shrink-0 border-r border-[var(--border)] px-2.5 py-2 flex items-center justify-between gap-1.5 transition-colors ${
            isPinned
              ? 'sticky z-25 bg-[var(--bg-surface)]'
              : 'relative bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)]/70'
          } ${isLastPinned ? 'shadow-[2px_0_6px_-2px_rgba(0,0,0,0.28)]' : ''}`}
        >
          <button
            type="button"
            onClick={() => onSort(colName)}
            className="flex-1 min-w-0 text-left flex items-center gap-1.5"
            title={headerTooltip}
          >
            {meta?.primaryKey && <Key size={10} className="text-amber-500 shrink-0" />}
            {fkInfo && <Link2 size={10} className="text-[var(--accent)] shrink-0" />}
            <span className="truncate font-semibold text-[11.5px] text-[var(--text)]">
              {colName}
            </span>
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            {isPinned && <Pin size={10} className="text-[var(--accent)]" />}
            {isSorted && (
              <span className="text-[var(--accent)]">
                {sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
              </span>
            )}
            <button
              type="button"
              aria-label={`Column actions for ${colName}`}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                onSetHeaderMenu((prev) =>
                  prev?.colName === colName
                    ? null
                    : {
                        colName,
                        x: Math.min(rect.left - 130, window.innerWidth - 210),
                        y: rect.bottom + 4,
                      },
                );
              }}
              className="p-0.5 rounded opacity-0 group-hover/hdr:opacity-100 focus:opacity-100 hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--text)] transition-opacity"
              title="Manage column"
            >
              <MoreVertical size={11} />
            </button>
          </div>

          {header.resizeHandler && (
            <div
              onMouseDown={header.resizeHandler}
              onTouchStart={header.resizeHandler}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onAutoFitColumn(colName);
              }}
              onClick={(e) => e.stopPropagation()}
              title="Drag to resize · Double-click to auto-fit"
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)]/60 transition-colors"
            />
          )}
        </div>
      );
    })}
  </div>
);
