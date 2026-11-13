import dagre from '@dagrejs/dagre';
import type { ColumnInfo, SchemaIntrospection, TableInfo } from '../../types/database';
import { NODE_WIDTH } from './SchemaNodeCard';

export function computeDagreLayout(
  tables: TableInfo[],
  columnsMap: Record<string, ColumnInfo[]>,
  fks: SchemaIntrospection['foreignKeys'],
  showColumns: boolean,
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 110, nodesep: 48, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const tableKeys = new Set<string>();
  for (const t of tables) {
    const key = `${t.schema || 'main'}.${t.name}`;
    tableKeys.add(key);
    const cols = columnsMap[key] || columnsMap[t.name] || [];
    const visibleCount = showColumns
      ? Math.min(cols.length, 10)
      : Math.min(cols.filter((c) => c.primaryKey).length + 2, 6);
    const height = 40 + Math.max(1, visibleCount) * 24;
    g.setNode(key, { width: NODE_WIDTH, height });
  }

  for (const fk of fks) {
    const src = `${fk.fromSchema || 'main'}.${fk.fromTable}`;
    const dst = `${fk.toSchema || 'main'}.${fk.toTable}`;
    if (tableKeys.has(src) && tableKeys.has(dst) && src !== dst) {
      g.setEdge(src, dst);
    }
  }

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const key of tableKeys) {
    const n = g.node(key);
    if (n) {
      positions[key] = {
        x: Math.round(n.x - n.width / 2),
        y: Math.round(n.y - n.height / 2),
      };
    }
  }
  return positions;
}
