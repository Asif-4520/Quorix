import type {
  ColumnInfo,
  DatabaseEngine,
  IndexInfo,
  SchemaIntrospection,
  TableInfo,
} from '../types/database';

export type DiffSeverity = 'create' | 'alter' | 'drop' | 'info';

export interface MigrationOperation {
  id: string;
  tableName: string;
  summary: string;
  severity: DiffSeverity;
  sql: string;
  enabled: boolean;
}

export interface TableDiffEntry {
  tableName: string;
  status: 'missing_in_target' | 'extra_in_target' | 'modified';
  addedColumns: ColumnInfo[];
  removedColumns: ColumnInfo[];
  changedColumns: Array<{
    name: string;
    sourceCol: ColumnInfo;
    targetCol: ColumnInfo;
    changes: string[];
  }>;
  addedIndexes: IndexInfo[];
  removedIndexes: IndexInfo[];
}

export interface SchemaDiffResult {
  tableDiffs: TableDiffEntry[];
  operations: MigrationOperation[];
  identicalTables: number;
}

function quoteId(name: string, engine: DatabaseEngine): string {
  if (engine === 'mysql') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function qualTable(schema: string | undefined, name: string, engine: DatabaseEngine): string {
  const qt = quoteId(name, engine);
  if (!schema?.trim()) return qt;
  return `${quoteId(schema.trim(), engine)}.${qt}`;
}

function normalizeType(dataType: string): string {
  return dataType.trim().toUpperCase().replace(/\s+/g, ' ');
}

function buildColumnSqlDef(col: ColumnInfo, engine: DatabaseEngine): string {
  const parts = [quoteId(col.name, engine), col.dataType || 'TEXT'];
  if (!col.nullable) parts.push('NOT NULL');
  if (col.defaultValue?.trim()) {
    parts.push(`DEFAULT ${col.defaultValue.trim()}`);
  }
  return parts.join(' ');
}

function filterBySchema(
  introspection: SchemaIntrospection,
  schemaName?: string,
): {
  tables: Map<string, TableInfo>;
  columns: Map<string, ColumnInfo[]>;
  indexes: Map<string, IndexInfo[]>;
} {
  const tables = new Map<string, TableInfo>();
  const columns = new Map<string, ColumnInfo[]>();
  const indexes = new Map<string, IndexInfo[]>();

  for (const tbl of introspection.tables) {
    if (schemaName && (tbl.schema || 'main') !== schemaName) continue;
    tables.set(tbl.name, tbl);
    const key = `${tbl.schema || 'main'}.${tbl.name}`;
    columns.set(tbl.name, introspection.columns[key] || introspection.columns[tbl.name] || []);
  }

  for (const idx of introspection.indexes) {
    if (schemaName && (idx.schema || 'main') !== schemaName) continue;
    const list = indexes.get(idx.tableName) || [];
    list.push(idx);
    indexes.set(idx.tableName, list);
  }

  return { tables, columns, indexes };
}

export function computeSchemaDiff(
  source: SchemaIntrospection,
  target: SchemaIntrospection,
  options: {
    sourceSchema?: string;
    targetSchema?: string;
    targetEngine: DatabaseEngine;
  },
): SchemaDiffResult {
  const src = filterBySchema(source, options.sourceSchema);
  const tgt = filterBySchema(target, options.targetSchema);
  const eng = options.targetEngine;

  const tableDiffs: TableDiffEntry[] = [];
  const operations: MigrationOperation[] = [];
  let identicalTables = 0;

  for (const [name, _srcTbl] of src.tables.entries()) {
    if (!tgt.tables.has(name)) {
      const cols = src.columns.get(name) || [];
      const pks = cols.filter((c) => c.primaryKey).map((c) => quoteId(c.name, eng));
      const colLines = cols.map((c) => `  ${buildColumnSqlDef(c, eng)}`);
      if (pks.length > 0) {
        colLines.push(`  PRIMARY KEY (${pks.join(', ')})`);
      }
      const sql = `CREATE TABLE ${qualTable(options.targetSchema, name, eng)} (\n${colLines.join(',\n')}\n);`;
      tableDiffs.push({
        tableName: name,
        status: 'missing_in_target',
        addedColumns: cols,
        removedColumns: [],
        changedColumns: [],
        addedIndexes: [],
        removedIndexes: [],
      });
      operations.push({
        id: `create-${name}`,
        tableName: name,
        summary: `Create missing table "${name}" (${cols.length} columns)`,
        severity: 'create',
        sql,
        enabled: true,
      });
      continue;
    }

    const sCols = src.columns.get(name) || [];
    const tCols = tgt.columns.get(name) || [];
    const sMap = new Map(sCols.map((c) => [c.name, c]));
    const tMap = new Map(tCols.map((c) => [c.name, c]));

    const addedColumns: ColumnInfo[] = [];
    const removedColumns: ColumnInfo[] = [];
    const changedColumns: TableDiffEntry['changedColumns'] = [];

    for (const sc of sCols) {
      const tc = tMap.get(sc.name);
      if (!tc) {
        addedColumns.push(sc);
        const qt = qualTable(options.targetSchema, name, eng);
        operations.push({
          id: `addcol-${name}-${sc.name}`,
          tableName: name,
          summary: `Add column ${name}.${sc.name} (${sc.dataType})`,
          severity: 'create',
          sql: `ALTER TABLE ${qt} ADD COLUMN ${buildColumnSqlDef(sc, eng)};`,
          enabled: true,
        });
      } else {
        const diffs: string[] = [];
        if (normalizeType(sc.dataType) !== normalizeType(tc.dataType)) {
          diffs.push(`type ${tc.dataType} -> ${sc.dataType}`);
        }
        if (sc.nullable !== tc.nullable) {
          diffs.push(sc.nullable ? 'NULLABLE' : 'NOT NULL');
        }
        if ((sc.defaultValue || '') !== (tc.defaultValue || '')) {
          diffs.push(`default ${tc.defaultValue || 'none'} -> ${sc.defaultValue || 'none'}`);
        }
        if (diffs.length > 0) {
          changedColumns.push({ name: sc.name, sourceCol: sc, targetCol: tc, changes: diffs });
          const qt = qualTable(options.targetSchema, name, eng);
          const qc = quoteId(sc.name, eng);
          let alterSql = '';
          if (eng === 'mysql') {
            alterSql = `ALTER TABLE ${qt} MODIFY COLUMN ${buildColumnSqlDef(sc, eng)};`;
          } else if (eng === 'sqlite') {
            alterSql = `-- SQLite requires table rebuild to alter ${name}.${sc.name} (${diffs.join(', ')})`;
          } else {
            alterSql = `ALTER TABLE ${qt} ALTER COLUMN ${qc} TYPE ${sc.dataType}${sc.nullable ? `, ALTER COLUMN ${qc} DROP NOT NULL` : `, ALTER COLUMN ${qc} SET NOT NULL`};`;
          }
          operations.push({
            id: `modcol-${name}-${sc.name}`,
            tableName: name,
            summary: `Modify ${name}.${sc.name}: ${diffs.join(', ')}`,
            severity: 'alter',
            sql: alterSql,
            enabled: eng !== 'sqlite',
          });
        }
      }
    }

    for (const tc of tCols) {
      if (!sMap.has(tc.name)) {
        removedColumns.push(tc);
        const qt = qualTable(options.targetSchema, name, eng);
        operations.push({
          id: `dropcol-${name}-${tc.name}`,
          tableName: name,
          summary: `Drop extra column ${name}.${tc.name}`,
          severity: 'drop',
          sql: `ALTER TABLE ${qt} DROP COLUMN ${quoteId(tc.name, eng)};`,
          enabled: false,
        });
      }
    }

    const sIdxs = (src.indexes.get(name) || []).filter((i) => !i.isPrimary);
    const tIdxs = (tgt.indexes.get(name) || []).filter((i) => !i.isPrimary);
    const tIdxSet = new Set(tIdxs.map((i) => i.name));
    const sIdxSet = new Set(sIdxs.map((i) => i.name));

    const addedIndexes = sIdxs.filter((i) => !tIdxSet.has(i.name));
    const removedIndexes = tIdxs.filter((i) => !sIdxSet.has(i.name));

    for (const idx of addedIndexes) {
      const qt = qualTable(options.targetSchema, name, eng);
      const colsSql = idx.columns.map((c) => quoteId(c, eng)).join(', ');
      operations.push({
        id: `addidx-${name}-${idx.name}`,
        tableName: name,
        summary: `Create missing index ${idx.name} on ${name}`,
        severity: 'create',
        sql: `CREATE ${idx.isUnique ? 'UNIQUE ' : ''}INDEX ${quoteId(idx.name, eng)} ON ${qt} (${colsSql});`,
        enabled: true,
      });
    }

    if (
      addedColumns.length === 0 &&
      removedColumns.length === 0 &&
      changedColumns.length === 0 &&
      addedIndexes.length === 0 &&
      removedIndexes.length === 0
    ) {
      identicalTables++;
    } else {
      tableDiffs.push({
        tableName: name,
        status: 'modified',
        addedColumns,
        removedColumns,
        changedColumns,
        addedIndexes,
        removedIndexes,
      });
    }
  }

  for (const name of tgt.tables.keys()) {
    if (!src.tables.has(name)) {
      tableDiffs.push({
        tableName: name,
        status: 'extra_in_target',
        addedColumns: [],
        removedColumns: [],
        changedColumns: [],
        addedIndexes: [],
        removedIndexes: [],
      });
      operations.push({
        id: `drop-${name}`,
        tableName: name,
        summary: `Drop extra table "${name}" in target`,
        severity: 'drop',
        sql: `DROP TABLE ${qualTable(options.targetSchema, name, eng)};`,
        enabled: false,
      });
    }
  }

  return { tableDiffs, operations, identicalTables };
}
