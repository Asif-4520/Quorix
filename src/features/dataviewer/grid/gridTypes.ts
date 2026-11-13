export const INDEX_GUTTER_WIDTH = 88;

export interface CellCoord {
  rowIdx: number;
  colName: string;
}

export interface CellRange {
  start: CellCoord;
  end: CellCoord;
}

export interface NormalizedRange {
  minRow: number;
  maxRow: number;
  minColIdx: number;
  maxColIdx: number;
  isMultiCell: boolean;
}

export interface GridRowRecord {
  __rowIndex: number;
  __rowKey: string;
  __rowid?: number;
  [colName: string]: unknown;
}

export interface GridColumnHeaderSpec {
  id: string;
  colName: string;
  size: number;
  resizeHandler?: (event: unknown) => void;
}

export interface CellMenuState {
  x: number;
  y: number;
  rowIdx: number;
  colName: string;
  value: string | null;
}

export interface HeaderMenuState {
  x: number;
  y: number;
  colName: string;
}

export interface DragState {
  mode: 'cells' | 'rows';
  anchorCell: CellCoord;
  anchorRow: number;
  crossedRows: boolean;
}
