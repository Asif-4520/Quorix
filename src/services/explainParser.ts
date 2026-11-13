export type ExplainOperatorCategory =
  | 'scan'
  | 'join'
  | 'sort'
  | 'aggregate'
  | 'modify'
  | 'subquery'
  | 'limit'
  | 'other';

export interface ExplainPlanNode {
  id: string;
  nodeType: string;
  operatorCategory: ExplainOperatorCategory;
  relation?: string;
  alias?: string;
  indexName?: string;
  joinType?: string;
  parentRelationship?: string;
  subplanName?: string;
  startupCost?: number;
  totalCost?: number;
  actualTimeMs?: number;
  selfTimeMs?: number;
  actualRows?: number;
  planRows?: number;
  rowsRemovedByFilter?: number;
  loops?: number;
  sharedHitBlocks?: number;
  sharedReadBlocks?: number;
  sharedDirtiedBlocks?: number;
  tempWrittenBlocks?: number;
  outputColumns?: string[];
  filter?: string;
  costSharePct: number;
  selfCostPct: number;
  warning?: string;
  children: ExplainPlanNode[];
  extra: Record<string, string | number | boolean>;
}

export interface ParsedExplainPlan {
  engineHint: 'postgres' | 'mysql' | 'sqlite' | 'unknown';
  totalExecutionTimeMs?: number;
  totalPlanningTimeMs?: number;
  rootNodes: ExplainPlanNode[];
  rawLines: string[];
}

export interface ExplainPlanSummary {
  nodeCount: number;
  maxDepth: number;
  warningCount: number;
  totalHitBlocks: number;
  totalReadBlocks: number;
  totalTempBlocks: number;
  hotspotNodeId?: string;
}

interface RawPgPlanNode {
  'Node Type'?: string;
  'Relation Name'?: string;
  Alias?: string;
  'Index Name'?: string;
  'Join Type'?: string;
  'Parent Relationship'?: string;
  'Subplan Name'?: string;
  'Startup Cost'?: number;
  'Total Cost'?: number;
  'Actual Total Time'?: number;
  'Actual Rows'?: number;
  'Plan Rows'?: number;
  'Rows Removed by Filter'?: number;
  'Rows Removed by Index Recheck'?: number;
  'Actual Loops'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Shared Dirtied Blocks'?: number;
  'Temp Written Blocks'?: number;
  'Sort Method'?: string;
  'Sort Space Used'?: number;
  'Sort Space Type'?: string;
  'Hash Batches'?: number;
  'Hash Buckets'?: number;
  'Peak Memory Usage'?: number;
  'Workers Planned'?: number;
  'Workers Launched'?: number;
  'Scan Direction'?: string;
  Strategy?: string;
  Output?: string[];
  Filter?: string;
  'Index Cond'?: string;
  'Hash Cond'?: string;
  'Merge Cond'?: string;
  'Join Filter'?: string;
  'Sort Key'?: string[] | string;
  'Group Key'?: string[] | string;
  Plans?: RawPgPlanNode[];
  [k: string]: unknown;
}

export function classifyOperator(nodeType: string): ExplainOperatorCategory {
  const upper = nodeType.toUpperCase();
  if (
    upper.includes('INSERT') ||
    upper.includes('UPDATE') ||
    upper.includes('DELETE') ||
    upper.includes('MERGE') ||
    upper.includes('MODIFY')
  ) {
    return 'modify';
  }
  if (upper.includes('JOIN') || upper.includes('NESTED LOOP')) {
    return 'join';
  }
  if (
    upper.includes('SCAN') ||
    upper.includes('SEARCH') ||
    upper.includes('TABLE ACCESS') ||
    upper.includes('VALUES')
  ) {
    return 'scan';
  }
  if (upper.includes('SORT') || upper.includes('ORDER')) {
    return 'sort';
  }
  if (
    upper.includes('AGGREGATE') ||
    upper.includes('GROUP') ||
    upper.includes('UNIQUE') ||
    upper.includes('WINDOW')
  ) {
    return 'aggregate';
  }
  if (
    upper.includes('SUBQUERY') ||
    upper.includes('CTE') ||
    upper.includes('INITPLAN') ||
    upper.includes('MATERIALIZE') ||
    upper.includes('HASH')
  ) {
    return 'subquery';
  }
  if (upper.includes('LIMIT') || upper.includes('LOCKROWS') || upper.includes('RESULT')) {
    return 'limit';
  }
  return 'other';
}

function buildPgNode(
  raw: RawPgPlanNode,
  rootCost: number,
  rootTimeMs: number,
  path: string,
): ExplainPlanNode {
  const nodeType = raw['Node Type'] || 'Plan Node';
  const totalCost = typeof raw['Total Cost'] === 'number' ? raw['Total Cost'] : undefined;
  const actualRows = typeof raw['Actual Rows'] === 'number' ? raw['Actual Rows'] : undefined;
  const planRows = typeof raw['Plan Rows'] === 'number' ? raw['Plan Rows'] : undefined;
  const loops = typeof raw['Actual Loops'] === 'number' ? raw['Actual Loops'] : undefined;
  const rawActualTime =
    typeof raw['Actual Total Time'] === 'number' ? raw['Actual Total Time'] : undefined;
  const actualTimeMs =
    rawActualTime !== undefined ? rawActualTime * Math.max(1, loops ?? 1) : undefined;
  const rowsRemovedByFilter =
    typeof raw['Rows Removed by Filter'] === 'number'
      ? raw['Rows Removed by Filter']
      : typeof raw['Rows Removed by Index Recheck'] === 'number'
        ? raw['Rows Removed by Index Recheck']
        : undefined;
  const tempWrittenBlocks =
    typeof raw['Temp Written Blocks'] === 'number' ? raw['Temp Written Blocks'] : undefined;
  const filter =
    raw.Filter || raw['Index Cond'] || raw['Hash Cond'] || raw['Merge Cond'] || raw['Join Filter'];

  const children = (raw.Plans || []).map((child, idx) =>
    buildPgNode(child, rootCost, rootTimeMs, `${path}.${idx}`),
  );

  const childCostMax = children.reduce(
    (max, ch) => (ch.totalCost !== undefined ? Math.max(max, ch.totalCost) : max),
    0,
  );
  const selfCost = totalCost !== undefined ? Math.max(0, totalCost - childCostMax) : undefined;
  const costSharePct =
    totalCost !== undefined && rootCost > 0
      ? Math.min(100, Math.round((totalCost / rootCost) * 100))
      : 0;
  const selfCostPct =
    selfCost !== undefined && rootCost > 0
      ? Math.min(100, Math.round((selfCost / rootCost) * 100))
      : costSharePct;

  const childTimeMax = children.reduce(
    (max, ch) => (ch.actualTimeMs !== undefined ? Math.max(max, ch.actualTimeMs) : max),
    0,
  );
  const selfTimeMs =
    actualTimeMs !== undefined ? Math.max(0, actualTimeMs - childTimeMax) : undefined;

  const warnings: string[] = [];
  if (nodeType === 'Seq Scan' && (actualRows ?? planRows ?? 0) >= 500) {
    warnings.push('Sequential Scan on >=500 rows — consider adding an index');
  }
  if (
    rowsRemovedByFilter !== undefined &&
    rowsRemovedByFilter >= 200 &&
    rowsRemovedByFilter > Math.max(1, actualRows ?? 0) * 2
  ) {
    warnings.push(
      `High filter selectivity drop (${rowsRemovedByFilter.toLocaleString()} rows discarded) — composite/partial index may help`,
    );
  }
  if (
    actualRows !== undefined &&
    planRows !== undefined &&
    planRows > 0 &&
    (actualRows / planRows >= 10 || planRows / Math.max(1, actualRows) >= 10)
  ) {
    warnings.push(`Row estimate skew (est ${planRows} vs actual ${actualRows}) — run ANALYZE`);
  }
  if (
    (tempWrittenBlocks !== undefined && tempWrittenBlocks > 0) ||
    (raw['Sort Method'] && String(raw['Sort Method']).toLowerCase().includes('external'))
  ) {
    warnings.push(
      'Disk spill detected — increasing work_mem or adding an index may avoid temp I/O',
    );
  }

  const extra: Record<string, string | number | boolean> = {};
  if (raw.Strategy) extra.Strategy = String(raw.Strategy);
  if (raw['Scan Direction']) extra['Scan Direction'] = String(raw['Scan Direction']);
  if (raw['Join Type']) extra['Join Type'] = String(raw['Join Type']);
  if (raw['Index Cond']) extra['Index Cond'] = String(raw['Index Cond']);
  if (raw['Hash Cond']) extra['Hash Cond'] = String(raw['Hash Cond']);
  if (raw['Merge Cond']) extra['Merge Cond'] = String(raw['Merge Cond']);
  if (raw['Join Filter']) extra['Join Filter'] = String(raw['Join Filter']);
  if (raw['Sort Key']) {
    extra['Sort Key'] = Array.isArray(raw['Sort Key'])
      ? raw['Sort Key'].join(', ')
      : String(raw['Sort Key']);
  }
  if (raw['Group Key']) {
    extra['Group Key'] = Array.isArray(raw['Group Key'])
      ? raw['Group Key'].join(', ')
      : String(raw['Group Key']);
  }
  if (raw['Sort Method']) extra['Sort Method'] = String(raw['Sort Method']);
  if (typeof raw['Sort Space Used'] === 'number') {
    extra['Sort Space'] = `${raw['Sort Space Used']} kB (${raw['Sort Space Type'] || 'Memory'})`;
  }
  if (typeof raw['Hash Batches'] === 'number') extra['Hash Batches'] = raw['Hash Batches'];
  if (typeof raw['Hash Buckets'] === 'number') extra['Hash Buckets'] = raw['Hash Buckets'];
  if (typeof raw['Peak Memory Usage'] === 'number') {
    extra['Peak Memory'] = `${raw['Peak Memory Usage']} kB`;
  }
  if (typeof raw['Workers Planned'] === 'number') {
    extra.Workers = `${raw['Workers Launched'] ?? 0}/${raw['Workers Planned']}`;
  }

  return {
    id: `pg-${path}`,
    nodeType,
    operatorCategory: classifyOperator(nodeType),
    relation: raw['Relation Name'],
    alias: raw.Alias,
    indexName: raw['Index Name'],
    joinType: raw['Join Type'],
    parentRelationship: raw['Parent Relationship'],
    subplanName: raw['Subplan Name'],
    startupCost: typeof raw['Startup Cost'] === 'number' ? raw['Startup Cost'] : undefined,
    totalCost,
    actualTimeMs,
    selfTimeMs,
    actualRows,
    planRows,
    rowsRemovedByFilter,
    loops,
    sharedHitBlocks:
      typeof raw['Shared Hit Blocks'] === 'number' ? raw['Shared Hit Blocks'] : undefined,
    sharedReadBlocks:
      typeof raw['Shared Read Blocks'] === 'number' ? raw['Shared Read Blocks'] : undefined,
    sharedDirtiedBlocks:
      typeof raw['Shared Dirtied Blocks'] === 'number' ? raw['Shared Dirtied Blocks'] : undefined,
    tempWrittenBlocks,
    outputColumns: Array.isArray(raw.Output) ? raw.Output.map(String) : undefined,
    filter: filter ? String(filter) : undefined,
    costSharePct,
    selfCostPct,
    warning: warnings[0],
    children,
    extra,
  };
}

function buildMysqlNodes(obj: Record<string, unknown>, path = '0'): ExplainPlanNode[] {
  const nodes: ExplainPlanNode[] = [];
  if (obj.query_block && typeof obj.query_block === 'object') {
    const qb = obj.query_block as Record<string, unknown>;
    const costInfo = qb.cost_info as Record<string, unknown> | undefined;
    const totalCost = costInfo?.query_cost ? Number(costInfo.query_cost) : undefined;
    const children: ExplainPlanNode[] = [];

    if (qb.table && typeof qb.table === 'object') {
      children.push(
        ...buildMysqlTableNode(qb.table as Record<string, unknown>, totalCost || 100, `${path}.t`),
      );
    }
    if (Array.isArray(qb.nested_loop)) {
      qb.nested_loop.forEach((entry, idx) => {
        if (entry && typeof entry === 'object' && 'table' in entry) {
          children.push(
            ...buildMysqlTableNode(
              (entry as { table: Record<string, unknown> }).table,
              totalCost || 100,
              `${path}.nl${idx}`,
            ),
          );
        }
      });
    }
    if (qb.ordering_operation && typeof qb.ordering_operation === 'object') {
      children.push(...buildMysqlNodes({ query_block: qb.ordering_operation }, `${path}.ord`));
    }
    if (qb.grouping_operation && typeof qb.grouping_operation === 'object') {
      children.push(...buildMysqlNodes({ query_block: qb.grouping_operation }, `${path}.grp`));
    }

    const nodeType = qb.using_filesort
      ? 'Sort (Filesort)'
      : qb.using_temporary_table
        ? 'Temp Table / Group'
        : 'Query Block';
    const childCostMax = children.reduce(
      (max, c) => (c.totalCost !== undefined ? Math.max(max, c.totalCost) : max),
      0,
    );
    const selfCostPct =
      totalCost && totalCost > 0
        ? Math.max(5, Math.min(100, Math.round(((totalCost - childCostMax) / totalCost) * 100)))
        : 20;

    nodes.push({
      id: `mysql-qb-${path}`,
      nodeType,
      operatorCategory: classifyOperator(nodeType),
      totalCost,
      costSharePct: 100,
      selfCostPct,
      children,
      extra: qb.select_id ? { 'Select ID': Number(qb.select_id) } : {},
    });
  }
  return nodes;
}

function buildMysqlTableNode(
  t: Record<string, unknown>,
  rootCost: number,
  path: string,
): ExplainPlanNode[] {
  const accessType = String(t.access_type || 'ALL');
  const rowsExamined =
    typeof t.rows_examined_per_scan === 'number' ? t.rows_examined_per_scan : undefined;
  const costInfo = t.cost_info as Record<string, unknown> | undefined;
  const cost = costInfo?.read_cost ? Number(costInfo.read_cost) : undefined;
  const warning =
    accessType === 'ALL' && (rowsExamined ?? 0) >= 200
      ? 'Full Table Scan (access_type = ALL) — consider indexing filter columns'
      : undefined;
  const share = cost && rootCost > 0 ? Math.min(100, Math.round((cost / rootCost) * 100)) : 50;

  return [
    {
      id: `mysql-tbl-${path}`,
      nodeType: `Table Access (${accessType})`,
      operatorCategory: 'scan',
      relation: t.table_name ? String(t.table_name) : undefined,
      indexName: t.key ? String(t.key) : undefined,
      totalCost: cost,
      planRows: rowsExamined,
      filter: t.attached_condition ? String(t.attached_condition) : undefined,
      costSharePct: share,
      selfCostPct: share,
      warning,
      children: [],
      extra: {
        'Access Type': accessType,
        ...(t.possible_keys ? { 'Possible Keys': String(t.possible_keys) } : {}),
        ...(t.filtered ? { Filtered: `${t.filtered}%` } : {}),
      },
    },
  ];
}

function parseSqliteDetailNode(id: string, detail: string, share: number): ExplainPlanNode {
  const isScan = /\bSCAN\b/i.test(detail) && !/USING (?:COVERING )?INDEX/i.test(detail);
  const isTempBtree = /USE TEMP B-TREE/i.test(detail);
  const tblMatch = detail.match(/\b(?:SCAN|SEARCH)\s+([^\s(]+)/i);
  const idxMatch = detail.match(/USING (?:COVERING )?INDEX\s+([^\s(]+)/i);

  let nodeType = 'Plan Step';
  if (/USING COVERING INDEX/i.test(detail)) {
    nodeType = 'Covering Index Scan';
  } else if (/USING INDEX/i.test(detail)) {
    nodeType = 'Index Scan';
  } else if (/USING INTEGER PRIMARY KEY/i.test(detail)) {
    nodeType = 'Primary Key Lookup';
  } else if (/USE TEMP B-TREE/i.test(detail)) {
    nodeType = 'Temp B-Tree Sort';
  } else if (/^\s*SCAN\b/i.test(detail)) {
    nodeType = 'Table Scan';
  } else if (/^\s*SEARCH\b/i.test(detail)) {
    nodeType = 'Table Search';
  } else if (/COMPOUND|UNION|INTERSECT|EXCEPT/i.test(detail)) {
    nodeType = 'Compound Query';
  } else if (/CO-ROUTINE/i.test(detail)) {
    nodeType = 'Subquery Coroutine';
  }

  return {
    id,
    nodeType,
    operatorCategory: classifyOperator(nodeType),
    relation: tblMatch?.[1],
    indexName: idxMatch?.[1],
    filter: detail,
    costSharePct: share,
    selfCostPct: share,
    warning: isScan
      ? 'Full table scan (no index used)'
      : isTempBtree
        ? 'Temporary B-Tree created for ORDER BY / GROUP BY — consider an index'
        : undefined,
    children: [],
    extra: {},
  };
}

function buildSqliteOrTextPlan(lines: string[]): ExplainPlanNode[] {
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return [];

  // Detect SQLite EXPLAIN QUERY PLAN pipe format: `id | parent | notused | detail`
  const structuredRows = nonEmpty.map((line, i) => {
    const match = line.match(/^(\d+)\s*\|\s*(\d+)\s*\|\s*\d+\s*\|\s*(.+)$/);
    if (!match) return null;
    return {
      nodeId: match[1],
      parentId: match[2],
      detail: match[3].trim(),
      index: i,
    };
  });

  if (structuredRows.every((r) => r !== null)) {
    const share = Math.round(100 / Math.max(1, structuredRows.length));
    const nodeMap = new Map<string, ExplainPlanNode>();
    const roots: ExplainPlanNode[] = [];

    for (const row of structuredRows) {
      if (!row) continue;
      nodeMap.set(row.nodeId, parseSqliteDetailNode(`sqlite-${row.nodeId}`, row.detail, share));
    }

    for (const row of structuredRows) {
      if (!row) continue;
      const node = nodeMap.get(row.nodeId);
      if (!node) continue;
      const parent = row.parentId !== '0' ? nodeMap.get(row.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    if (roots.length > 0) return roots;
  }

  const share = Math.round(100 / Math.max(1, nonEmpty.length));
  return nonEmpty.map((line, i) => parseSqliteDetailNode(`line-${i}`, line, share));
}

export function flattenExplainNodes(
  nodes: ExplainPlanNode[],
  depth = 0,
): Array<{ node: ExplainPlanNode; depth: number; parentId?: string }> {
  const out: Array<{ node: ExplainPlanNode; depth: number; parentId?: string }> = [];
  const walk = (node: ExplainPlanNode, d: number, parentId?: string) => {
    out.push({ node, depth: d, parentId });
    for (const child of node.children) {
      walk(child, d + 1, node.id);
    }
  };
  for (const root of nodes) {
    walk(root, depth);
  }
  return out;
}

export function summarizeExplainPlan(parsed: ParsedExplainPlan): ExplainPlanSummary {
  const flat = flattenExplainNodes(parsed.rootNodes);
  let maxDepth = 0;
  let warningCount = 0;
  let totalHitBlocks = 0;
  let totalReadBlocks = 0;
  let totalTempBlocks = 0;
  let hotspotNode: ExplainPlanNode | undefined;

  for (const { node, depth } of flat) {
    if (depth + 1 > maxDepth) maxDepth = depth + 1;
    if (node.warning) warningCount += 1;
    totalHitBlocks += node.sharedHitBlocks ?? 0;
    totalReadBlocks += node.sharedReadBlocks ?? 0;
    totalTempBlocks += node.tempWrittenBlocks ?? 0;
    if (
      !hotspotNode ||
      (node.selfTimeMs ?? node.selfCostPct) > (hotspotNode.selfTimeMs ?? hotspotNode.selfCostPct)
    ) {
      hotspotNode = node;
    }
  }

  return {
    nodeCount: flat.length,
    maxDepth,
    warningCount,
    totalHitBlocks,
    totalReadBlocks,
    totalTempBlocks,
    hotspotNodeId: hotspotNode?.id,
  };
}

export function parseExplainPlan(rawLines: string[]): ParsedExplainPlan {
  const joined = rawLines.join('\n').trim();
  if (!joined) {
    return { engineHint: 'unknown', rootNodes: [], rawLines };
  }

  if (joined.startsWith('[') || joined.startsWith('{')) {
    try {
      const parsed = JSON.parse(joined) as unknown;

      if (
        Array.isArray(parsed) &&
        parsed[0] &&
        typeof parsed[0] === 'object' &&
        'Plan' in parsed[0]
      ) {
        const entry = parsed[0] as {
          Plan: RawPgPlanNode;
          'Execution Time'?: number;
          'Planning Time'?: number;
        };
        const rootCost = entry.Plan['Total Cost'] || 1;
        const rootTimeMs = entry['Execution Time'] || entry.Plan['Actual Total Time'] || 0;
        return {
          engineHint: 'postgres',
          totalExecutionTimeMs: entry['Execution Time'],
          totalPlanningTimeMs: entry['Planning Time'],
          rootNodes: [buildPgNode(entry.Plan, rootCost, rootTimeMs, '0')],
          rawLines,
        };
      }

      if (parsed && typeof parsed === 'object' && 'query_block' in parsed) {
        return {
          engineHint: 'mysql',
          rootNodes: buildMysqlNodes(parsed as Record<string, unknown>),
          rawLines,
        };
      }
    } catch {}
  }

  return {
    engineHint:
      joined.toUpperCase().includes('SCAN') || /\d+\|\d+\|\d+\|/.test(joined.replace(/\s+/g, ''))
        ? 'sqlite'
        : 'unknown',
    rootNodes: buildSqliteOrTextPlan(rawLines),
    rawLines,
  };
}
