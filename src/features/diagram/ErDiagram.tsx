import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { Columns, Download, LayoutGrid, Loader2, Maximize2, Search } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErDiagramIcon } from '../../components/ui/DatabaseIcons';
import { getErNodePositions, saveErNodePositions } from '../../services/storage';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { THEMES } from '../../theme/themes';
import type { SchemaIntrospection, TableInfo } from '../../types/database';
import { computeDagreLayout } from './erLayout';
import { buildStandaloneSvg, triggerPngDownload, triggerSvgDownload } from './erSvgExport';
import { type SchemaNodeData, schemaNodeTypes } from './SchemaNodeCard';

interface ErDiagramProps {
  connectionId: string;
  initialSchema?: string;
  onSelectTable: (table: TableInfo) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ErDiagram: React.FC<ErDiagramProps> = ({
  connectionId,
  initialSchema,
  onSelectTable,
  onShowToast,
}) => {
  const loadFullIntrospection = useConnectionStore((s) => s.loadFullIntrospection);
  const cachedIntrospection = useConnectionStore((s) => s.introspectionsByConn[connectionId]);
  const effectiveTheme = useSettingsStore((s) => s.effectiveTheme);
  const theme = THEMES[effectiveTheme] || THEMES['obsidian-dark'];

  const [introspection, setIntrospection] = useState<SchemaIntrospection | null>(
    cachedIntrospection || null,
  );
  const [loading, setLoading] = useState(!cachedIntrospection);
  const [selectedSchema, setSelectedSchema] = useState<string>(initialSchema || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showColumns, setShowColumns] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SchemaNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const flowInstanceRef = useRef<ReactFlowInstance<Node<SchemaNodeData>, Edge> | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadFullIntrospection(connectionId, false)
      .then((res) => {
        if (active) setIntrospection(res);
      })
      .catch((err) => {
        if (active) onShowToast(`Failed loading ER schema: ${err}`, 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [connectionId, loadFullIntrospection, onShowToast]);

  const availableSchemas = useMemo(() => {
    if (!introspection) return [];
    const set = new Set<string>();
    for (const t of introspection.tables) {
      if (t.schema) set.add(t.schema);
    }
    return Array.from(set);
  }, [introspection]);

  const filteredTables = useMemo(() => {
    if (!introspection) return [];
    return introspection.tables.filter((t) => {
      if (t.kind !== 'table' && t.kind !== 'partitioned_table') return false;
      if (selectedSchema !== 'all' && t.schema !== selectedSchema) return false;
      return true;
    });
  }, [introspection, selectedSchema]);

  const posStorageKey = `${connectionId}:${selectedSchema}`;

  const rebuildGraph = useCallback(
    (forceRelayout = false) => {
      if (!introspection) return;
      const savedPos = forceRelayout ? {} : getErNodePositions(posStorageKey);
      const layoutPos = computeDagreLayout(
        filteredTables,
        introspection.columns,
        introspection.foreignKeys,
        showColumns,
      );

      const tableKeySet = new Set(filteredTables.map((t) => `${t.schema || 'main'}.${t.name}`));

      const connectedNeighbors = new Set<string>();
      if (selectedNodeId) {
        connectedNeighbors.add(selectedNodeId);
        for (const fk of introspection.foreignKeys) {
          const src = `${fk.fromSchema || 'main'}.${fk.fromTable}`;
          const dst = `${fk.toSchema || 'main'}.${fk.toTable}`;
          if (src === selectedNodeId) connectedNeighbors.add(dst);
          if (dst === selectedNodeId) connectedNeighbors.add(src);
        }
      }

      const q = searchQuery.trim().toLowerCase();

      const nextNodes: Node<SchemaNodeData>[] = filteredTables.map((t) => {
        const key = `${t.schema || 'main'}.${t.name}`;
        const cols = introspection.columns[key] || introspection.columns[t.name] || [];
        const fkCols = introspection.foreignKeys
          .filter(
            (fk) => fk.fromTable === t.name && (fk.fromSchema || 'main') === (t.schema || 'main'),
          )
          .map((fk) => fk.fromColumn);

        const matchesSearch = !q || t.name.toLowerCase().includes(q);
        const matchesFocus = !selectedNodeId || connectedNeighbors.has(key);

        return {
          id: key,
          type: 'schemaNode',
          position: savedPos[key] || layoutPos[key] || { x: 0, y: 0 },
          data: {
            table: t,
            columns: cols,
            fkColumns: fkCols,
            showColumns,
            dimmed: !matchesSearch || !matchesFocus,
            highlighted: selectedNodeId === key,
            onOpenTable: onSelectTable,
          },
        };
      });

      const nextEdges: Edge[] = [];
      introspection.foreignKeys.forEach((fk, idx) => {
        const src = `${fk.fromSchema || 'main'}.${fk.fromTable}`;
        const dst = `${fk.toSchema || 'main'}.${fk.toTable}`;
        if (!tableKeySet.has(src) || !tableKeySet.has(dst)) return;
        const isHighlighted = !selectedNodeId || src === selectedNodeId || dst === selectedNodeId;
        nextEdges.push({
          id: `fk-${idx}-${src}-${fk.fromColumn}-${dst}-${fk.toColumn}`,
          source: src,
          target: dst,
          label: `${fk.fromColumn} → ${fk.toColumn} (N:1)`,
          type: 'smoothstep',
          animated: selectedNodeId !== null && isHighlighted,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHighlighted ? theme.accent : theme.border,
          },
          style: {
            stroke: isHighlighted ? theme.accent : theme.border,
            strokeWidth: isHighlighted && selectedNodeId ? 2 : 1.4,
            opacity: selectedNodeId && !isHighlighted ? 0.2 : 1,
          },
          labelStyle: {
            fontSize: 10,
            fill: theme.textMuted,
          },
          labelBgStyle: {
            fill: theme.bgPanel,
            fillOpacity: 0.9,
          },
        });
      });

      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [
      introspection,
      posStorageKey,
      filteredTables,
      showColumns,
      selectedNodeId,
      searchQuery,
      onSelectTable,
      theme,
      setNodes,
      setEdges,
    ],
  );

  useEffect(() => {
    rebuildGraph(false);
  }, [rebuildGraph]);

  const handleNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const current = getErNodePositions(posStorageKey);
      current[node.id] = node.position;
      saveErNodePositions(posStorageKey, current);
    },
    [posStorageKey],
  );

  const handleExportSvg = async () => {
    const svg = buildStandaloneSvg(nodes, edges, theme);
    if (!svg) return;
    const res = await triggerSvgDownload(svg, selectedSchema);
    if (!res.saved) return;
    if (res.path && !res.inBrowserDownloads) {
      onShowToast(`Exported ER Diagram to ${res.path}`, 'success');
    } else {
      onShowToast(`Saved ${res.path || 'ER Diagram'} to your browser Downloads folder`, 'success');
    }
  };

  const handleExportPng = async () => {
    const svg = buildStandaloneSvg(nodes, edges, theme);
    if (!svg) return;
    const res = await triggerPngDownload(svg, selectedSchema);
    if (!res.saved) return;
    if (res.path && !res.inBrowserDownloads) {
      onShowToast(`Exported ER Diagram to ${res.path}`, 'success');
    } else {
      onShowToast(`Saved ${res.path || 'ER Diagram'} to your browser Downloads folder`, 'success');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] gap-2">
        <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
        <span>Building Entity-Relationship Diagram…</span>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-[var(--bg)]"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && selectedNodeId) {
          const found = nodes.find((n) => n.id === selectedNodeId);
          if (found) onSelectTable(found.data.table);
        }
      }}
    >
      <div className="h-10 shrink-0 px-3 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <ErDiagramIcon size={15} className="text-[var(--accent)]" />
          <span className="font-semibold text-[var(--text)]">ER Diagram</span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {filteredTables.length} tables · {edges.length} relationships
          </span>
        </div>

        <div className="flex items-center gap-2">
          {availableSchemas.length > 1 && (
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="py-1 px-2 text-[11.5px]"
            >
              <option value="all">All Schemas</option>
              {availableSchemas.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <div className="relative w-44">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find table…"
              className="w-full pl-6 pr-2 py-1 text-[11px]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowColumns((s) => !s)}
            title="Toggle between all columns and key columns only"
            className={`px-2 py-1 rounded border text-[11px] inline-flex items-center gap-1 ${
              showColumns
                ? 'bg-[var(--accent-muted)] border-[var(--accent)]/40 text-[var(--accent)]'
                : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)]'
            }`}
          >
            <Columns size={11} /> {showColumns ? 'All Columns' : 'Keys Only'}
          </button>

          <button
            type="button"
            onClick={() => {
              rebuildGraph(true);
              setTimeout(() => flowInstanceRef.current?.fitView({ padding: 0.15 }), 40);
            }}
            title="Arrange table cards automatically"
            className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] inline-flex items-center gap-1"
          >
            <LayoutGrid size={11} /> Auto-Layout
          </button>

          <button
            type="button"
            onClick={() => flowInstanceRef.current?.fitView({ padding: 0.15 })}
            className="p-1.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]"
            title="Fit to Screen"
          >
            <Maximize2 size={12} />
          </button>

          <button
            type="button"
            onClick={handleExportSvg}
            title="Export ER diagram as SVG"
            className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] inline-flex items-center gap-1"
          >
            <Download size={11} /> SVG
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            title="Export ER diagram as PNG"
            className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] inline-flex items-center gap-1"
          >
            <Download size={11} /> PNG
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {filteredTables.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
            No tables available to visualize in this schema.
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={schemaNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) =>
              setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
            }
            onPaneClick={() => setSelectedNodeId(null)}
            onNodeDragStop={handleNodeDragStop}
            onInit={(inst) => {
              flowInstanceRef.current = inst;
            }}
            fitView
            minZoom={0.15}
            maxZoom={2}
          >
            <Background color={theme.borderSubtle} gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeColor={theme.bgSurface}
              maskColor={theme.isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)'}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};
