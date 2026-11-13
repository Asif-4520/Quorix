import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Flame,
  GitMerge,
  ListTree,
  Network,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import {
  type ExplainPlanNode,
  flattenExplainNodes,
  parseExplainPlan,
  summarizeExplainPlan,
} from '../../services/explainParser';
import type { ExplainResponse } from '../../types/database';
import { ExplainPlanDiagram } from './ExplainPlanDiagram';

interface ExplainPlanViewerProps {
  explainResult: ExplainResponse;
}

type ExplainViewMode = 'diagram' | 'tree' | 'bottlenecks' | 'raw';

const TreeTableRows: React.FC<{
  node: ExplainPlanNode;
  depth: number;
  selectedNodeId: string | null;
  collapsedIds: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  onSelect: (id: string) => void;
}> = ({ node, depth, selectedNodeId, collapsedIds, onToggleCollapse, onSelect }) => {
  const hasChildren = node.children.length > 0;
  const isCollapsed = Boolean(collapsedIds[node.id]);
  const isSelected = selectedNodeId === node.id;

  return (
    <>
      <tr
        onClick={() => onSelect(node.id)}
        className={`cursor-pointer border-b border-[var(--border-subtle)] text-[11.5px] transition-colors ${
          isSelected
            ? 'bg-[var(--accent-muted)]/60'
            : node.warning
              ? 'bg-amber-500/5 hover:bg-amber-500/10'
              : 'hover:bg-[var(--bg-hover)]/60'
        }`}
      >
        <td className="py-1.5 pr-3 font-medium text-[var(--text)] whitespace-nowrap">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 18 + 8}px` }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(node.id);
                }}
                className="p-0.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)]"
                aria-label={isCollapsed ? 'Expand plan subtree' : 'Collapse plan subtree'}
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
            ) : (
              <span className="w-4 inline-block shrink-0" />
            )}
            <span className="font-semibold">{node.nodeType}</span>
            {node.warning && (
              <span title={node.warning} className="text-amber-500 shrink-0 ml-1">
                <AlertTriangle size={12} />
              </span>
            )}
          </div>
        </td>
        <td className="py-1.5 px-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {node.relation && (
              <Badge variant="info" size="sm">
                {node.relation}
                {node.alias && node.alias !== node.relation ? ` (${node.alias})` : ''}
              </Badge>
            )}
            {node.indexName && (
              <Badge variant="success" size="sm">
                idx: {node.indexName}
              </Badge>
            )}
            {!node.relation && !node.indexName && (
              <span className="text-[var(--text-muted)]">—</span>
            )}
          </div>
        </td>
        <td className="py-1.5 px-2.5 font-mono text-[11px] text-right whitespace-nowrap">
          {node.actualRows !== undefined ? (
            <span>
              <strong className="text-[var(--text)]">{node.actualRows.toLocaleString()}</strong>
              {node.planRows !== undefined && (
                <span className="text-[var(--text-muted)]">
                  {' '}
                  / {node.planRows.toLocaleString()}
                </span>
              )}
            </span>
          ) : node.planRows !== undefined ? (
            <span className="text-[var(--text-secondary)]">~{node.planRows.toLocaleString()}</span>
          ) : (
            <span className="text-[var(--text-muted)]">—</span>
          )}
        </td>
        <td className="py-1.5 px-2.5 font-mono text-[11px] text-right whitespace-nowrap text-[var(--text-secondary)]">
          {node.totalCost !== undefined ? node.totalCost.toFixed(1) : '—'}
        </td>
        <td className="py-1.5 px-2.5 font-mono text-[11px] text-right whitespace-nowrap">
          {node.selfTimeMs !== undefined ? (
            <span className="text-[var(--text)] font-semibold">
              {node.selfTimeMs.toFixed(2)} ms
            </span>
          ) : node.actualTimeMs !== undefined ? (
            <span>{node.actualTimeMs.toFixed(2)} ms</span>
          ) : (
            <span className="text-[var(--text-muted)]">—</span>
          )}
        </td>
        <td className="py-1.5 pl-2.5 pr-3 w-28">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  node.warning || node.selfCostPct >= 50 ? 'bg-amber-500' : 'bg-[var(--accent)]'
                }`}
                style={{ width: `${Math.max(4, Math.min(100, node.selfCostPct))}%` }}
              />
            </div>
            <span className="font-mono text-[10.5px] font-bold w-8 text-right text-[var(--text-secondary)]">
              {node.selfCostPct}%
            </span>
          </div>
        </td>
      </tr>
      {!isCollapsed &&
        node.children.map((child) => (
          <TreeTableRows
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedNodeId={selectedNodeId}
            collapsedIds={collapsedIds}
            onToggleCollapse={onToggleCollapse}
            onSelect={onSelect}
          />
        ))}
    </>
  );
};

const NodeInspectorDrawer: React.FC<{
  node: ExplainPlanNode;
  onClose: () => void;
}> = ({ node, onClose }) => {
  const extraEntries = Object.entries(node.extra);
  return (
    <aside className="w-full lg:w-[320px] shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3 space-y-3 text-xs overflow-y-auto max-h-full self-stretch">
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Operator Inspector
          </div>
          <h4 className="font-semibold text-[var(--text)] text-sm truncate">{node.nodeType}</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
          title="Close inspector"
        >
          <X size={13} />
        </button>
      </div>

      {node.warning && (
        <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/35 text-amber-400 flex items-start gap-2 text-[11px] leading-relaxed">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>{node.warning}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
        <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <div className="text-[9.5px] uppercase text-[var(--text-muted)]">Self Cost Share</div>
          <div className="font-bold text-[var(--text)] mt-0.5">
            {node.selfCostPct}%{' '}
            <span className="text-[var(--text-muted)] font-normal">
              (total {node.costSharePct}%)
            </span>
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <div className="text-[9.5px] uppercase text-[var(--text-muted)]">Cost Range</div>
          <div className="font-semibold text-[var(--text)] mt-0.5">
            {node.startupCost !== undefined ? node.startupCost.toFixed(1) : '0.0'} ..{' '}
            {node.totalCost !== undefined ? node.totalCost.toFixed(1) : '—'}
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <div className="text-[9.5px] uppercase text-[var(--text-muted)]">Rows (Act / Est)</div>
          <div className="font-semibold text-[var(--text)] mt-0.5">
            {node.actualRows !== undefined ? node.actualRows.toLocaleString() : '—'} /{' '}
            {node.planRows !== undefined ? node.planRows.toLocaleString() : '—'}
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <div className="text-[9.5px] uppercase text-[var(--text-muted)]">Timing (Self / Tot)</div>
          <div className="font-semibold text-[var(--text)] mt-0.5">
            {node.selfTimeMs !== undefined ? `${node.selfTimeMs.toFixed(2)} ms` : '—'} /{' '}
            {node.actualTimeMs !== undefined ? `${node.actualTimeMs.toFixed(2)} ms` : '—'}
          </div>
        </div>
      </div>

      {(node.loops !== undefined || node.rowsRemovedByFilter !== undefined) && (
        <div className="flex flex-wrap gap-3 text-[11px] font-mono text-[var(--text-secondary)]">
          {node.loops !== undefined && <span>Loops: {node.loops}</span>}
          {node.rowsRemovedByFilter !== undefined && (
            <span className="text-amber-400">
              Filtered out: {node.rowsRemovedByFilter.toLocaleString()} rows
            </span>
          )}
        </div>
      )}

      {(node.sharedHitBlocks !== undefined ||
        node.sharedReadBlocks !== undefined ||
        node.tempWrittenBlocks !== undefined) && (
        <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
          <div className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            I/O & Buffer Blocks
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--text-secondary)]">
            {node.sharedHitBlocks !== undefined && <span>Hit: {node.sharedHitBlocks}</span>}
            {node.sharedReadBlocks !== undefined && <span>Read: {node.sharedReadBlocks}</span>}
            {node.sharedDirtiedBlocks !== undefined && (
              <span>Dirtied: {node.sharedDirtiedBlocks}</span>
            )}
            {node.tempWrittenBlocks !== undefined && (
              <span className="text-amber-400">Temp Written: {node.tempWrittenBlocks}</span>
            )}
          </div>
        </div>
      )}

      {node.filter && (
        <div className="space-y-1">
          <div className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Predicate / Filter
          </div>
          <pre className="p-2 rounded bg-[var(--code-bg)] border border-[var(--border-subtle)] font-mono text-[10.5px] text-[var(--text)] whitespace-pre-wrap break-all">
            {node.filter}
          </pre>
        </div>
      )}

      {extraEntries.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Execution Attributes
          </div>
          <div className="divide-y divide-[var(--border-subtle)] rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {extraEntries.map(([k, v]) => (
              <div key={k} className="px-2 py-1 flex items-start justify-between gap-2 text-[11px]">
                <span className="text-[var(--text-muted)] shrink-0">{k}</span>
                <span className="font-mono text-[var(--text)] text-right break-all">
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {node.outputColumns && node.outputColumns.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Output Columns ({node.outputColumns.length})
          </div>
          <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[10.5px] text-[var(--text-secondary)] break-all">
            {node.outputColumns.join(', ')}
          </div>
        </div>
      )}
    </aside>
  );
};

export const ExplainPlanViewer: React.FC<ExplainPlanViewerProps> = ({ explainResult }) => {
  const [viewMode, setViewMode] = useState<ExplainViewMode>('diagram');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const [copiedRaw, setCopiedRaw] = useState(false);

  const parsed = useMemo(() => parseExplainPlan(explainResult.plan), [explainResult.plan]);
  const summary = useMemo(() => summarizeExplainPlan(parsed), [parsed]);
  const flatNodes = useMemo(() => flattenExplainNodes(parsed.rootNodes), [parsed.rootNodes]);

  useEffect(() => {
    setSelectedNodeId(summary.hotspotNodeId ?? flatNodes[0]?.node.id ?? null);
    setCollapsedIds({});
  }, [summary.hotspotNodeId, flatNodes]);

  const selectedNode = useMemo(
    () => flatNodes.find((item) => item.node.id === selectedNodeId)?.node ?? null,
    [flatNodes, selectedNodeId],
  );

  const bottleneckNodes = useMemo(
    () =>
      [...flatNodes].sort(
        (a, b) =>
          (b.node.warning ? 1 : 0) - (a.node.warning ? 1 : 0) ||
          (b.node.selfTimeMs ?? b.node.selfCostPct) - (a.node.selfTimeMs ?? a.node.selfCostPct),
      ),
    [flatNodes],
  );

  const rawText = useMemo(() => {
    const joined = explainResult.plan.join('\n').trim();
    if (joined.startsWith('[') || joined.startsWith('{')) {
      try {
        return JSON.stringify(JSON.parse(joined), null, 2);
      } catch {}
    }
    return joined;
  }, [explainResult.plan]);
  const isAnalyzeMode = explainResult.mode === 'analyze';

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1600);
    } catch {}
  };

  return (
    <div className="h-full flex flex-col min-h-0 p-3 space-y-2.5 overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[var(--text-muted)] font-mono">
          <span className="inline-flex items-center gap-1.5 text-[var(--text)] font-sans font-semibold text-xs">
            <GitMerge size={13} className="text-[var(--accent)]" />
            Execution Plan ({parsed.engineHint.toUpperCase()})
          </span>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-sans font-semibold border ${
              isAnalyzeMode
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}
          >
            {isAnalyzeMode ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
            {isAnalyzeMode ? 'Safe Analyze (Read-Only Rollback)' : 'Estimate Only (Zero Execution)'}
          </span>

          <span>Steps: {summary.nodeCount}</span>
          <span>Depth: {summary.maxDepth}</span>
          <span>Computed: {explainResult.durationMs} ms</span>
          {parsed.totalExecutionTimeMs !== undefined && (
            <span className="inline-flex items-center gap-1 text-[var(--success)]">
              <CheckCircle2 size={11} />
              Exec: {parsed.totalExecutionTimeMs.toFixed(2)} ms
            </span>
          )}
          {parsed.totalPlanningTimeMs !== undefined && (
            <span>Plan: {parsed.totalPlanningTimeMs.toFixed(2)} ms</span>
          )}
          {summary.warningCount > 0 && (
            <button
              type="button"
              onClick={() => setViewMode('bottlenecks')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-sans font-semibold hover:bg-amber-500/25 transition-colors"
            >
              <AlertTriangle size={11} />
              {summary.warningCount} warning{summary.warningCount === 1 ? '' : 's'}
            </button>
          )}
        </div>

        <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden text-[11px]">
          {(
            [
              { id: 'diagram', label: 'Diagram', icon: Network },
              { id: 'tree', label: 'Tree Table', icon: ListTree },
              { id: 'bottlenecks', label: 'Bottlenecks', icon: Flame },
              { id: 'raw', label: 'Raw Plan', icon: Code2 },
            ] as const
          ).map((tab, idx) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`px-2.5 py-1 inline-flex items-center gap-1 ${
                  idx > 0 ? 'border-l border-[var(--border)]' : ''
                } ${
                  viewMode === tab.id
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)] font-semibold'
                    : 'bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon size={11} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {explainResult.safetyNotice && (
        <div className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/8 text-amber-300 text-[11.5px] flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0 text-amber-400" />
          <span>{explainResult.safetyNotice}</span>
        </div>
      )}

      {viewMode === 'raw' || parsed.rootNodes.length === 0 ? (
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => void handleCopyRaw()}
            className="absolute top-2.5 right-2.5 z-10 px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-[11px] inline-flex items-center gap-1 shadow-sm"
          >
            <Copy size={11} />
            {copiedRaw ? 'Copied' : 'Copy'}
          </button>
          <pre className="flex-1 p-3 rounded-lg bg-[var(--code-bg)] border border-[var(--border)] font-mono text-xs whitespace-pre-wrap text-[var(--text)] overflow-auto">
            {rawText}
          </pre>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 items-stretch overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
            {viewMode === 'diagram' && (
              <ExplainPlanDiagram
                rootNodes={parsed.rootNodes}
                selectedNodeId={selectedNodeId}
                hotspotNodeId={summary.hotspotNodeId}
                onSelectNode={setSelectedNodeId}
              />
            )}

            {viewMode === 'tree' && (
              <div className="flex-1 min-h-0 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-surface)] text-[10.5px] uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-2 pl-3 pr-3 font-semibold">Operation</th>
                      <th className="py-2 px-2.5 font-semibold">Target / Index</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Rows (Act / Est)</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Cost</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Self Time</th>
                      <th className="py-2 pl-2.5 pr-3 font-semibold">Self %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rootNodes.map((root) => (
                      <TreeTableRows
                        key={root.id}
                        node={root}
                        depth={0}
                        selectedNodeId={selectedNodeId}
                        collapsedIds={collapsedIds}
                        onToggleCollapse={(id) =>
                          setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }))
                        }
                        onSelect={setSelectedNodeId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === 'bottlenecks' && (
              <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
                {bottleneckNodes.map(({ node }) => {
                  const active = node.id === selectedNodeId;
                  return (
                    <button
                      type="button"
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        active
                          ? 'bg-[var(--accent-muted)]/40 border-[var(--accent)]'
                          : node.warning
                            ? 'bg-amber-500/8 border-amber-500/35 hover:bg-amber-500/12'
                            : 'bg-[var(--bg-panel)] border-[var(--border)] hover:bg-[var(--bg-hover)]/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[var(--text)]">
                            {node.nodeType}
                          </span>
                          {node.relation && (
                            <Badge variant="info" size="sm">
                              {node.relation}
                            </Badge>
                          )}
                          {node.indexName && (
                            <Badge variant="success" size="sm">
                              idx: {node.indexName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-secondary)]">
                          {node.selfTimeMs !== undefined && (
                            <span className="font-semibold text-[var(--text)]">
                              {node.selfTimeMs.toFixed(2)} ms self
                            </span>
                          )}
                          <span>Self {node.selfCostPct}%</span>
                        </div>
                      </div>
                      {node.warning && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-400">
                          <AlertTriangle size={12} className="shrink-0" />
                          <span>{node.warning}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedNode && (
            <NodeInspectorDrawer node={selectedNode} onClose={() => setSelectedNodeId(null)} />
          )}
        </div>
      )}
    </div>
  );
};
