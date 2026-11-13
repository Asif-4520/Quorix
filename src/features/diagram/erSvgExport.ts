import type { Edge, Node } from '@xyflow/react';
import {
  promptSaveBinaryFile,
  promptSaveTextFile,
  type SaveExportResult,
} from '../../services/tauri';
import type { THEMES } from '../../theme/themes';
import { NODE_WIDTH, type SchemaNodeData } from './SchemaNodeCard';

type ThemePalette = (typeof THEMES)[keyof typeof THEMES];

export function buildStandaloneSvg(
  nodes: Node<SchemaNodeData>[],
  edges: Edge[],
  theme: ThemePalette,
): string {
  if (nodes.length === 0) return '';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const nodeHeights = new Map<string, number>();
  for (const n of nodes) {
    const cols = n.data.showColumns
      ? n.data.columns
      : n.data.columns.filter((c) => c.primaryKey || n.data.fkColumns.includes(c.name));
    const h = 36 + Math.max(1, cols.length) * 22 + 8;
    nodeHeights.set(n.id, h);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.position.y + h);
  }

  const pad = 48;
  const width = Math.max(400, maxX - minX + pad * 2);
  const height = Math.max(300, maxY - minY + pad * 2);
  const ox = -minX + pad;
  const oy = -minY + pad;

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgePaths = edges
    .map((e) => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) return '';
      const x1 = s.position.x + ox + NODE_WIDTH;
      const y1 = s.position.y + oy + (nodeHeights.get(s.id) || 80) / 2;
      const x2 = t.position.x + ox;
      const y2 = t.position.y + oy + (nodeHeights.get(t.id) || 80) / 2;
      const dx = Math.max(40, Math.abs(x2 - x1) * 0.45);
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      return `<path d="${d}" fill="none" stroke="${theme.accent}" stroke-width="1.6" marker-end="url(#quorix-arrow)" />`;
    })
    .join('\n');

  const nodeBoxes = nodes
    .map((n) => {
      const x = n.position.x + ox;
      const y = n.position.y + oy;
      const h = nodeHeights.get(n.id) || 80;
      const cols = n.data.showColumns
        ? n.data.columns
        : n.data.columns.filter((c) => c.primaryKey || n.data.fkColumns.includes(c.name));
      const colRows = cols
        .map((c, i) => {
          const cy = y + 36 + i * 22 + 15;
          const prefix = c.primaryKey ? 'PK ' : n.data.fkColumns.includes(c.name) ? 'FK ' : '';
          return `<text x="${x + 10}" y="${cy}" font-family="monospace" font-size="11" fill="${theme.text}">${escapeXml(prefix + c.name)}</text>
                    <text x="${x + NODE_WIDTH - 10}" y="${cy}" text-anchor="end" font-family="monospace" font-size="10" fill="${theme.textMuted}">${escapeXml(c.dataType)}</text>`;
        })
        .join('\n');

      return `<g>
          <rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${h}" rx="8" fill="${theme.bgPanel}" stroke="${theme.border}" stroke-width="1.2" />
          <rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="32" rx="8" fill="${theme.bgSurface}" />
          <text x="${x + 12}" y="${y + 20}" font-family="sans-serif" font-size="12" font-weight="600" fill="${theme.text}">${escapeXml(n.data.table.name)}</text>
          ${colRows}
        </g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <marker id="quorix-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="${theme.accent}" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="${theme.bg}" />
      ${edgePaths}
      ${nodeBoxes}
    </svg>`;
}

export async function triggerSvgDownload(
  svg: string,
  selectedSchema: string,
): Promise<SaveExportResult> {
  const fileName = `quorix-erd-${selectedSchema}.svg`;
  return promptSaveTextFile(fileName, 'svg', svg);
}

export async function triggerPngDownload(
  svg: string,
  selectedSchema: string,
): Promise<SaveExportResult> {
  const fileName = `quorix-erd-${selectedSchema}.png`;
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  return new Promise((resolve) => {
    img.onload = async () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve({ saved: false });
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(async (pngBlob) => {
        URL.revokeObjectURL(url);
        if (!pngBlob) {
          resolve({ saved: false });
          return;
        }
        const buffer = await pngBlob.arrayBuffer();
        const res = await promptSaveBinaryFile(fileName, 'png', new Uint8Array(buffer));
        resolve(res);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ saved: false });
    };
    img.src = url;
  });
}
