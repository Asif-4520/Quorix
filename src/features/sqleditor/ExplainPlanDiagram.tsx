import dagre from '@dagrejs/dagre';
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeftRight,
  Database,
  Flame,
  GitBranch,
  KeyRound,
  LocateFixed,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ExplainOperatorCategory,
  type ExplainPlanNode,
  flattenExplainNodes,
} from '../../services/explainParser';

const PLAN_NODE_WIDTH = 276;
const PLAN_NODE_HEIGHT = 122;

const CATEGORY_STYLE: Record<
  ExplainOperatorCategory,
  { accent: string; pillBg: string; pillText: string; label: string }
> = {
  scan: {
    accent: '#3b82f6',
    pillBg: 'rgba(59,130,246,0.14)',
    pillText: '#60a5fa',
    label: 'SCAN',
  },
  join: {
    accent: '#8b5cf6',
    pillBg: 'rgba(139,92,246,0.14)',
    pillText: '#a78bfa',
    label: 'JOIN',
  },
  sort: {
    accent: '#06b6d4',
    pillBg: 'rgba(6,182,212,0.14)',
    pillText: '#22d3ee',
    label: 'SORT',
  },
  aggregate: {
    accent: '#10b981',
    pillBg: 'rgba(16,185,129,0.14)',
    pillText: '#34d399',
    label: 'AGG',
  },
  modify: {
    accent: '#f43f5e',
    pillBg: 'rgba(244,63,94,0.14)',
    pillText: '#fb7185',
    label: 'WRITE',
  },
  subquery: {
    accent: '#eab308',
    pillBg: 'rgba(234,179,8,0.14)',
    pillText: '#facc15',
    label: 'SUB/HASH',
  },
  limit: {
    accent: '#64748b',
    pillBg: 'rgba(100,116,139,0.16)',
    pillText: '#94a3b8',
    label: 'CTRL',
  },
  other: {
    accent: 'var(--accent)',
    pillBg: 'var(--accent-muted)',
    pillText: 'var(--accent)',
    label: 'STEP',
  },
};

export interface ExplainFlowNodeData extends Record<string, unknown> {
  planNode: ExplainPlanNode;
  direction: 'TB' | 'LR';
  isSelected: boolean;
  isHotspot: boolean;
}

const ExplainNodeCard: React.FC<NodeProps<Node<ExplainFlowNodeData>>> = ({ data }) => {
  const { planNode, direction, isSelected, isHotspot } = data;
  const cat = CATEGORY_STYLE[planNode.operatorCategory] || CATEGORY_STYLE.other;
  const hasWarn = Boolean(planNode.warning);
  const borderColor = isSelected
    ? 'var(--accent)'
    : hasWarn
      ? '#f59e0b'
      : isHotspot
        ? 'rgba(244,63,94,0.65)'
        : 'var(--border)';

  const targetPos = direction === 'TB' ? Position.Top : Position.Left;
  const sourcePos = direction === 'TB' ? Position.Bottom : Position.Right;

  return (
    <div
      style={{
        width: PLAN_NODE_WIDTH,
        minHeight: PLAN_NODE_HEIGHT - 8,
        borderColor,
        boxShadow: isSelected
          ? '0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent), 0 10px 24px -10px rgba(0,0,0,0.45)'
          : '0 6px 18px -10px rgba(0,0,0,0.35)',
      }}
      className="rounded-lg border bg-[var(--bg-panel)] text-[var(--text)] overflow-hidden transition-all select-none"
    >
      <Handle
        type="target"
        position={targetPos}
        style={{
          background: cat.accent,
          borderColor: 'var(--bg-panel)',
          width: 7,
          height: 7,
        }}
      />

      <div className="h-1 w-full" style={{ background: hasWarn ? '#f59e0b' : cat.accent }} />

      <div className="p-2.5 space-y-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase shrink-0"
                style={{ backgroundColor: cat.pillBg, color: cat.pillText }}
              >
                {cat.label}
              </span>
              <span className="text-[12px] font-semibold truncate" title={planNode.nodeType}>
                {planNode.nodeType}
              </span>
            </div>
            {planNode.subplanName && (
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate mt-0.5">
                {planNode.subplanName}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isHotspot && (
              <span
                title="Primary Cost/Time Bottleneck"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[9.5px] font-bold"
              >
                <Flame size={10} />
              </span>
            )}
            {hasWarn && (
              <span
                title={planNode.warning}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9.5px] font-bold"
              >
                <AlertTriangle size={10} />
              </span>
            )}
          </div>
        </div>

        {(planNode.relation || planNode.indexName) && (
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
            {planNode.relation && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] max-w-[140px] truncate">
                <Database size={9} className="shrink-0 text-[var(--text-muted)]" />
                {planNode.relation}
                {planNode.alias && planNode.alias !== planNode.relation
                  ? ` (${planNode.alias})`
                  : ''}
              </span>
            )}
            {planNode.indexName && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 max-w-[140px] truncate">
                <KeyRound size={9} className="shrink-0" />
                {planNode.indexName}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-[10px] font-mono">
          <div className="px-1.5 py-1 rounded bg-[var(--bg-surface)]/80">
            <div className="text-[9px] text-[var(--text-muted)] uppercase">Rows</div>
            <div className="font-semibold text-[var(--text)] truncate">
              {planNode.actualRows !== undefined
                ? planNode.actualRows.toLocaleString()
                : planNode.planRows !== undefined
                  ? `~${planNode.planRows.toLocaleString()}`
                  : '—'}
            </div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[var(--bg-surface)]/80">
            <div className="text-[9px] text-[var(--text-muted)] uppercase">
              {planNode.actualTimeMs !== undefined ? 'Time' : 'Cost'}
            </div>
            <div className="font-semibold text-[var(--text)] truncate">
              {planNode.actualTimeMs !== undefined
                ? `${planNode.actualTimeMs.toFixed(2)} ms`
                : planNode.totalCost !== undefined
                  ? planNode.totalCost.toFixed(1)
                  : '—'}
            </div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[var(--bg-surface)]/80">
            <div className="text-[9px] text-[var(--text-muted)] uppercase">Self %</div>
            <div
              className={`font-bold ${
                hasWarn || planNode.selfCostPct >= 50 ? 'text-amber-400' : 'text-[var(--accent)]'
              }`}
            >
              {planNode.selfCostPct}%
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(4, Math.min(100, planNode.selfCostPct || planNode.costSharePct))}%`,
              background: hasWarn ? '#f59e0b' : cat.accent,
            }}
          />
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePos}
        style={{
          background: cat.accent,
          borderColor: 'var(--bg-panel)',
          width: 7,
          height: 7,
        }}
      />
    </div>
  );
};

const explainNodeTypes = {
  explainStep: ExplainNodeCard,
};

function computePlanGraphLayout(
  rootNodes: ExplainPlanNode[],
  direction: 'TB' | 'LR',
  selectedNodeId: string | null,
  hotspotNodeId?: string,
): { nodes: Node<ExplainFlowNodeData>[]; edges: Edge[] } {
  const flat = flattenExplainNodes(rootNodes);
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    ranksep: direction === 'TB' ? 62 : 76,
    nodesep: direction === 'TB' ? 38 : 34,
    marginx: 28,
    marginy: 28,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const { node } of flat) {
    g.setNode(node.id, { width: PLAN_NODE_WIDTH, height: PLAN_NODE_HEIGHT });
    if (node.parentRelationship) {
      // Child edges flow downward in AST from parent to child, with upward data-flow arrow visually indicated
    }
  }

  for (const { node, parentId } of flat) {
    if (parentId) {
      g.setEdge(parentId, node.id);
    }
  }

  dagre.layout(g);

  const nodes: Node<ExplainFlowNodeData>[] = flat.map(({ node }) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      type: 'explainStep',
      position: pos
        ? {
            x: Math.round(pos.x - PLAN_NODE_WIDTH / 2),
            y: Math.round(pos.y - PLAN_NODE_HEIGHT / 2),
          }
        : { x: 0, y: 0 },
      data: {
        planNode: node,
        direction,
        isSelected: node.id === selectedNodeId,
        isHotspot: node.id === hotspotNodeId,
      },
    };
  });

  const edges: Edge[] = [];
  for (const { node, parentId } of flat) {
    if (!parentId) continue;
    const rowVal = node.actualRows ?? node.planRows;
    const label =
      rowVal !== undefined
        ? `${rowVal.toLocaleString()} row${rowVal === 1 ? '' : 's'}${
            node.parentRelationship && node.parentRelationship !== 'Outer'
              ? ` · ${node.parentRelationship}`
              : ''
          }`
        : node.parentRelationship;
    const isHeavy = node.costSharePct >= 45 || Boolean(node.warning);
    const stroke = node.warning ? '#f59e0b' : isHeavy ? 'var(--accent)' : 'var(--border)';

    edges.push({
      id: `edge-${parentId}->${node.id}`,
      source: parentId,
      target: node.id,
      type: 'smoothstep',
      animated: Boolean(node.warning),
      label,
      labelStyle: {
        fill: 'var(--text-secondary)',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: 'var(--bg)',
        fillOpacity: 0.9,
      },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
      markerStart: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 14,
        height: 14,
      },
      style: {
        stroke,
        strokeWidth: isHeavy ? 2 : 1.4,
      },
    });
  }

  return { nodes, edges };
}

interface ExplainPlanDiagramProps {
  rootNodes: ExplainPlanNode[];
  selectedNodeId: string | null;
  hotspotNodeId?: string;
  onSelectNode: (nodeId: string) => void;
}

export const ExplainPlanDiagram: React.FC<ExplainPlanDiagramProps> = ({
  rootNodes,
  selectedNodeId,
  hotspotNodeId,
  onSelectNode,
}) => {
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  const flowRef = useRef<ReactFlowInstance<Node<ExplainFlowNodeData>, Edge> | null>(null);

  const layout = useMemo(
    () => computePlanGraphLayout(rootNodes, direction, selectedNodeId, hotspotNodeId),
    [rootNodes, direction, selectedNodeId, hotspotNodeId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ExplainFlowNodeData>>(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(layout.edges);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
    const timer = setTimeout(() => {
      flowRef.current?.fitView({ padding: 0.18, duration: 240 });
    }, 60);
    return () => clearTimeout(timer);
  }, [layout, setNodes, setEdges]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      flowRef.current?.fitView({ padding: 0.18, duration: 150 });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleFitView = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.18, duration: 220 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[380px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
    >
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-[var(--bg-panel)]/95 backdrop-blur-sm border border-[var(--border)] rounded-md p-1 shadow-sm text-[11px]">
        <button
          type="button"
          onClick={() => setDirection('TB')}
          title="Top-to-Bottom Execution Tree (DataGrip style)"
          className={`px-2 py-0.5 rounded inline-flex items-center gap-1 transition-colors ${
            direction === 'TB'
              ? 'bg-[var(--accent-muted)] text-[var(--accent)] font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <ArrowDownUp size={11} /> Top-Down
        </button>
        <button
          type="button"
          onClick={() => setDirection('LR')}
          title="Left-to-Right Pipeline Flow"
          className={`px-2 py-0.5 rounded inline-flex items-center gap-1 transition-colors ${
            direction === 'LR'
              ? 'bg-[var(--accent-muted)] text-[var(--accent)] font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <ArrowLeftRight size={11} /> Left-Right
        </button>
        <div className="w-px h-3.5 bg-[var(--border)]" />
        <button
          type="button"
          onClick={handleFitView}
          title="Center and fit execution plan diagram"
          className="px-2 py-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text)] inline-flex items-center gap-1"
        >
          <LocateFixed size={11} /> Fit View
        </button>
      </div>

      <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-panel)]/90 border border-[var(--border)] text-[10px] text-[var(--text-muted)] shadow-xs">
        <GitBranch size={11} className="text-[var(--accent)]" />
        <span>Data flows upward into parent operators · Click a node to inspect</span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={explainNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(inst) => {
          flowRef.current = inst;
          requestAnimationFrame(() => inst.fitView({ padding: 0.18 }));
        }}
        onNodeClick={(_e, node) => onSelectNode(node.id)}
        fitView
        minZoom={0.2}
        maxZoom={1.8}
        nodesDraggable
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Background color="var(--border-subtle)" gap={18} size={1} />
        <Controls showInteractive={false} />
        {nodes.length > 5 && (
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              const d = n.data as ExplainFlowNodeData | undefined;
              return d?.planNode.warning ? '#f59e0b' : 'var(--accent)';
            }}
            maskColor="rgba(0,0,0,0.35)"
            style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              width: 130,
              height: 82,
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
};
