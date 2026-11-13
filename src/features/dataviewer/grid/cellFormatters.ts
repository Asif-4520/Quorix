import type { CellCoord } from './gridTypes';

export function formatCellDisplay(
  raw: string | null,
  dataType: string,
  nullDisplay: string,
  dateFormat: 'iso' | 'local' | 'relative',
): {
  text: string;
  isNull: boolean;
  kind: 'null' | 'bool' | 'num' | 'json' | 'hex' | 'text';
} {
  if (raw === null) return { text: nullDisplay, isNull: true, kind: 'null' };
  const dt = dataType.toLowerCase();
  if (dt.includes('bool') || raw === 'true' || raw === 'false') {
    if (raw === 'true' || raw === 'false') {
      return { text: raw, isNull: false, kind: 'bool' };
    }
  }
  if (raw.startsWith('0x') && (dt.includes('blob') || dt.includes('bytea'))) {
    return {
      text: raw.length > 44 ? `${raw.slice(0, 44)}… (${(raw.length - 2) / 2} B)` : raw,
      isNull: false,
      kind: 'hex',
    };
  }
  if (
    dt.includes('int') ||
    dt.includes('numeric') ||
    dt.includes('decimal') ||
    dt.includes('real') ||
    dt.includes('float') ||
    dt.includes('double')
  ) {
    return { text: raw, isNull: false, kind: 'num' };
  }
  if (dt.includes('json') || ((raw.startsWith('{') || raw.startsWith('[')) && raw.length > 2)) {
    return { text: raw, isNull: false, kind: 'json' };
  }
  if ((dt.includes('timestamp') || dt === 'date') && dateFormat !== 'iso') {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      if (dateFormat === 'local') {
        return {
          text: new Date(parsed).toLocaleString(),
          isNull: false,
          kind: 'text',
        };
      }
      if (dateFormat === 'relative') {
        const diffSec = Math.round((Date.now() - parsed) / 1000);
        const abs = Math.abs(diffSec);
        const suffix = diffSec >= 0 ? 'ago' : 'from now';
        if (abs < 60) {
          return { text: `${abs}s ${suffix}`, isNull: false, kind: 'text' };
        }
        if (abs < 3600) {
          return {
            text: `${Math.round(abs / 60)}m ${suffix}`,
            isNull: false,
            kind: 'text',
          };
        }
        if (abs < 86400) {
          return {
            text: `${Math.round(abs / 3600)}h ${suffix}`,
            isNull: false,
            kind: 'text',
          };
        }
        return {
          text: `${Math.round(abs / 86400)}d ${suffix}`,
          isNull: false,
          kind: 'text',
        };
      }
    }
  }
  return { text: raw, isNull: false, kind: 'text' };
}

export function getTabTarget(
  rowIdx: number,
  colPos: number,
  cols: string[],
  totalRows: number,
  reverse: boolean,
): CellCoord {
  if (!reverse) {
    if (colPos + 1 < cols.length) {
      return { rowIdx, colName: cols[colPos + 1] };
    }
    if (rowIdx + 1 < totalRows) {
      return { rowIdx: rowIdx + 1, colName: cols[0] };
    }
    return { rowIdx, colName: cols[colPos] };
  }
  if (colPos > 0) {
    return { rowIdx, colName: cols[colPos - 1] };
  }
  if (rowIdx > 0) {
    return { rowIdx: rowIdx - 1, colName: cols[cols.length - 1] };
  }
  return { rowIdx, colName: cols[colPos] };
}
