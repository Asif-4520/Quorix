import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { parseTooltipContent } from '../components/ui/TooltipHost';
import { ExplainPlanViewer } from '../features/sqleditor/ExplainPlanViewer';
import { formatColumnTypeMeta } from '../services/columnTypeFormat';
import { getEngineDisplayName, getEngineShortLabel, getEnvironmentMeta } from '../services/envTag';
import { parseExplainPlan, summarizeExplainPlan } from '../services/explainParser';
import { computeSchemaDiff } from '../services/schemaDiff';
import {
  analyzeDangerousSql,
  extractSqlParameters,
  splitTopLevelStatements,
  substituteSqlParameters,
} from '../services/sqlUtils';
import { sanitizePgUrlForStorage } from '../services/storage';
import { useSettingsStore } from '../stores/settingsStore';
import type { ColumnInfo, SchemaIntrospection } from '../types/database';

function makeCol(name: string, dataType: string, overrides: Partial<ColumnInfo> = {}): ColumnInfo {
  return {
    name,
    dataType,
    nullable: true,
    primaryKey: false,
    isUnique: false,
    isIdentity: false,
    isGenerated: false,
    autoIncrement: false,
    ordinalPosition: 1,
    enumValues: [],
    ...overrides,
  };
}

describe('SQL Safety & Parameterized Snippets', () => {
  it('flags un-WHERE UPDATE/DELETE and destructive DDL while ignoring strings/comments', () => {
    const safe = analyzeDangerousSql(
      "-- DELETE FROM users;\nSELECT 'UPDATE users SET a=1';\nDELETE FROM users WHERE id = 10;",
    );
    expect(safe.isUnwheredWrite).toBe(false);
    expect(safe.isDestructiveDdl).toBe(false);

    const dangerousWrite = analyzeDangerousSql('UPDATE orders SET status = "paid";');
    expect(dangerousWrite.isUnwheredWrite).toBe(true);
    expect(dangerousWrite.isDestructiveDdl).toBe(false);

    const dangerousDdl = analyzeDangerousSql('DROP TABLE legacy_events;');
    expect(dangerousDdl.isDestructiveDdl).toBe(true);
  });

  it('splits statements safely and extracts/substitutes {{param}} placeholders', () => {
    const stmts = splitTopLevelStatements("SELECT 'a;b' AS x; SELECT 2;");
    expect(stmts).toEqual(["SELECT 'a;b' AS x", 'SELECT 2']);

    const sql =
      "SELECT * FROM users WHERE tenant_id = {{tenant_id}} AND email = '{{email}}' AND active = {{is_active}};";
    expect(extractSqlParameters(sql)).toEqual(['tenant_id', 'email', 'is_active']);

    const rendered = substituteSqlParameters(sql, {
      tenant_id: '42',
      email: "o'connor@example.com",
      is_active: 'true',
    });
    expect(rendered).toBe(
      "SELECT * FROM users WHERE tenant_id = 42 AND email = 'o''connor@example.com' AND active = TRUE;",
    );
  });
});

describe('Visual EXPLAIN Plan Parser', () => {
  it('parses PostgreSQL EXPLAIN JSON with execution timing and seq scan warning', () => {
    const json = JSON.stringify([
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Relation Name': 'events',
          'Startup Cost': 0,
          'Total Cost': 142.5,
          'Actual Total Time': 12.4,
          'Actual Rows': 1500,
          'Plan Rows': 1500,
        },
        'Execution Time': 13.1,
        'Planning Time': 0.8,
      },
    ]);
    const parsed = parseExplainPlan([json]);
    expect(parsed.engineHint).toBe('postgres');
    expect(parsed.totalExecutionTimeMs).toBe(13.1);
    expect(parsed.rootNodes).toHaveLength(1);
    expect(parsed.rootNodes[0].warning).toMatch(/Sequential Scan/);
  });

  it('parses MySQL EXPLAIN JSON and SQLite text plans', () => {
    const mysqlJson = JSON.stringify({
      query_block: {
        table: {
          table_name: 'users',
          access_type: 'ALL',
          rows_examined_per_scan: 1200,
          cost_info: { read_cost: '10.0', eval_cost: '5.0' },
        },
      },
    });
    const mysqlParsed = parseExplainPlan([mysqlJson]);
    expect(mysqlParsed.engineHint).toBe('mysql');
    expect(mysqlParsed.rootNodes[0].nodeType).toBe('Query Block');
    expect(mysqlParsed.rootNodes[0].children[0].relation).toBe('users');
    expect(mysqlParsed.rootNodes[0].children[0].warning).toMatch(/Full Table Scan/i);

    const sqliteParsed = parseExplainPlan(['SCAN users']);
    expect(sqliteParsed.engineHint).toBe('sqlite');
    expect(sqliteParsed.rootNodes[0].nodeType).toBe('Table Scan');
    expect(sqliteParsed.rootNodes[0].warning).toMatch(/Full table scan/);
  });
});

describe('Schema Diff & Migration Generator', () => {
  const baseIntrospection = (
    tables: SchemaIntrospection['tables'],
    columns: SchemaIntrospection['columns'],
  ): SchemaIntrospection => ({
    schemas: [{ name: 'public', isSystem: false, tableCount: tables.length, viewCount: 0 }],
    tables,
    columns,
    indexes: [],
    foreignKeys: [],
    triggers: [],
    functions: [],
    sequences: [],
    enumTypes: [],
    extensions: [],
  });

  it('generates CREATE, ALTER ADD COLUMN, and DROP statements across schemas', () => {
    const source = baseIntrospection(
      [
        {
          name: 'users',
          schema: 'public',
          kind: 'table',
          hasPrimaryKey: true,
          isStrict: false,
          withoutRowid: false,
        },
        {
          name: 'audit_log',
          schema: 'public',
          kind: 'table',
          hasPrimaryKey: true,
          isStrict: false,
          withoutRowid: false,
        },
      ],
      {
        'public.users': [
          makeCol('id', 'bigint', { primaryKey: true, nullable: false }),
          makeCol('email', 'text', { nullable: false }),
          makeCol('role', 'text', { defaultValue: "'member'" }),
        ],
        'public.audit_log': [makeCol('id', 'bigint', { primaryKey: true, nullable: false })],
      },
    );

    const target = baseIntrospection(
      [
        {
          name: 'users',
          schema: 'public',
          kind: 'table',
          hasPrimaryKey: true,
          isStrict: false,
          withoutRowid: false,
        },
        {
          name: 'obsolete_tmp',
          schema: 'public',
          kind: 'table',
          hasPrimaryKey: true,
          isStrict: false,
          withoutRowid: false,
        },
      ],
      {
        'public.users': [
          makeCol('id', 'bigint', { primaryKey: true, nullable: false }),
          makeCol('email', 'text', { nullable: false }),
        ],
        'public.obsolete_tmp': [makeCol('id', 'bigint', { primaryKey: true, nullable: false })],
      },
    );

    const diff = computeSchemaDiff(source, target, {
      sourceSchema: 'public',
      targetSchema: 'public',
      targetEngine: 'postgres',
    });

    expect(
      diff.operations.some(
        (op) => op.severity === 'create' && op.sql.includes('CREATE TABLE "public"."audit_log"'),
      ),
    ).toBe(true);
    expect(
      diff.operations.some(
        (op) => op.severity === 'create' && op.sql.includes('ADD COLUMN "role"'),
      ),
    ).toBe(true);
    expect(
      diff.operations.some(
        (op) =>
          op.severity === 'drop' &&
          op.enabled === false &&
          op.sql.includes('DROP TABLE "public"."obsolete_tmp"'),
      ),
    ).toBe(true);
  });
});

describe('Engine Metadata & Sanitization', () => {
  it('formats environment tags, engine labels, and sanitizes mysql/postgres URLs', () => {
    expect(getEnvironmentMeta('production').shortLabel).toBe('PROD');
    expect(getEngineShortLabel('mysql')).toBe('MySQL');
    expect(getEngineDisplayName('postgres')).toBe('PostgreSQL');
    expect(getEngineDisplayName('sqlite')).toBe('SQLite');

    expect(sanitizePgUrlForStorage('mysql://admin:supersecret@db.host:3306/app')).toBe(
      'mysql://admin@db.host:3306/app',
    );
    expect(sanitizePgUrlForStorage('mariadb://u:p@127.0.0.1:3306/db')).toBe(
      'mariadb://u@127.0.0.1:3306/db',
    );
  });

  it('setGlobalFontSize scales UI, SQL editor, Data Grid, and CSS scale variables uniformly', () => {
    const store = useSettingsStore.getState();
    store.setGlobalFontSize(16);

    const updated = useSettingsStore.getState().settings;
    expect(updated.globalFontSize).toBe(16);
    expect(updated.uiFontSize).toBe(16);
    expect(updated.editorFontSize).toBe(16);
    expect(updated.gridFontSize).toBe(16);

    const rootStyle = document.documentElement.style;
    expect(rootStyle.fontSize).toBe('16px');
    expect(rootStyle.getPropertyValue('--quorix-ui-font-size')).toBe('16px');
    expect(rootStyle.getPropertyValue('--quorix-editor-font-size')).toBe('16px');
    expect(rootStyle.getPropertyValue('--quorix-grid-font-size')).toBe('16px');
    expect(Number(rootStyle.getPropertyValue('--quorix-font-scale'))).toBeCloseTo(16 / 13, 3);

    store.setGlobalFontSize(13);
  });

  it('normalizes verbose SQL column types into concise grid header chips', () => {
    expect(formatColumnTypeMeta('character varying(255)')).toMatchObject({
      shortLabel: 'text',
      category: 'text',
    });
    expect(formatColumnTypeMeta('integer')).toMatchObject({
      shortLabel: 'int',
      category: 'number',
    });
    expect(formatColumnTypeMeta('timestamp with time zone')).toMatchObject({
      shortLabel: 'timestamptz',
      category: 'date',
    });
    expect(formatColumnTypeMeta('boolean')).toMatchObject({
      shortLabel: 'bool',
      category: 'bool',
    });
    expect(formatColumnTypeMeta('jsonb')).toMatchObject({
      shortLabel: 'jsonb',
      category: 'json',
    });
  });

  it('parses trailing keyboard shortcuts inside tooltips without stripping regular parentheticals', () => {
    expect(parseTooltipContent('Command Palette (Ctrl+Shift+P)')).toEqual({
      text: 'Command Palette',
      shortcuts: ['Ctrl+Shift+P'],
    });
    expect(parseTooltipContent('Inspect Row (Space / F4)')).toEqual({
      text: 'Inspect Row',
      shortcuts: ['Space', 'F4'],
    });
    expect(parseTooltipContent('role (character varying)')).toEqual({
      text: 'role (character varying)',
      shortcuts: [],
    });
    expect(parseTooltipContent('PgBouncer Pooling (PostgreSQL)')).toEqual({
      text: 'PgBouncer Pooling (PostgreSQL)',
      shortcuts: [],
    });
  });

  it('detects writable CTE deletes, trivial WHERE clauses, DROP/TRUNCATE, and multi-statement SQL', () => {
    const wcte = analyzeDangerousSql(
      'WITH doomed AS (DELETE FROM audit_logs RETURNING id) SELECT * FROM doomed;',
    );
    expect(wcte.hasDelete).toBe(true);
    expect(wcte.hasWriteDml).toBe(true);
    expect(wcte.isUnwheredWrite).toBe(true);

    const trivialWhere = analyzeDangerousSql('DELETE FROM users WHERE 1 = 1;');
    expect(trivialWhere.hasDelete).toBe(true);
    expect(trivialWhere.isUnwheredWrite).toBe(true);

    const dropStmt = analyzeDangerousSql('TRUNCATE TABLE sessions; SELECT 1;');
    expect(dropStmt.hasTruncate).toBe(true);
    expect(dropStmt.hasDrop).toBe(false);
    expect(dropStmt.hasMultipleStatements).toBe(true);
  });

  it('builds hierarchical SQLite query plans and renders DataGrip-style ExplainPlanViewer views cleanly', () => {
    const sqliteHierarchical = parseExplainPlan([
      '2 | 0 | 0 | SEARCH u USING INDEX idx_users_email (email=?)',
      '5 | 2 | 0 | SCAN o',
      '9 | 0 | 0 | USE TEMP B-TREE FOR ORDER BY',
    ]);
    expect(sqliteHierarchical.engineHint).toBe('sqlite');
    expect(sqliteHierarchical.rootNodes).toHaveLength(2);
    expect(sqliteHierarchical.rootNodes[0].children).toHaveLength(1);
    expect(sqliteHierarchical.rootNodes[0].children[0].nodeType).toBe('Table Scan');
    expect(summarizeExplainPlan(sqliteHierarchical)).toMatchObject({
      nodeCount: 3,
      maxDepth: 2,
      warningCount: 2,
    });

    const pgJoinJson = JSON.stringify([
      {
        Plan: {
          'Node Type': 'Hash Join',
          'Join Type': 'Inner',
          'Startup Cost': 15.0,
          'Total Cost': 120.0,
          'Actual Total Time': 14.5,
          'Actual Rows': 250,
          'Plan Rows': 240,
          'Hash Cond': '(o.user_id = u.id)',
          Plans: [
            {
              'Node Type': 'Seq Scan',
              'Relation Name': 'orders',
              Alias: 'o',
              'Startup Cost': 0,
              'Total Cost': 95.0,
              'Actual Total Time': 11.2,
              'Actual Rows': 1800,
              'Plan Rows': 1800,
            },
            {
              'Node Type': 'Index Scan',
              'Relation Name': 'users',
              Alias: 'u',
              'Index Name': 'users_pkey',
              'Startup Cost': 0.29,
              'Total Cost': 12.0,
              'Actual Total Time': 1.1,
              'Actual Rows': 250,
              'Plan Rows': 250,
            },
          ],
        },
        'Execution Time': 15.2,
        'Planning Time': 0.9,
      },
    ]);

    render(
      createElement(ExplainPlanViewer, {
        explainResult: {
          plan: [pgJoinJson],
          durationMs: 18,
          mode: 'analyze',
          safetyNotice:
            'Executed EXPLAIN ANALYZE inside a READ ONLY transaction with automatic ROLLBACK.',
        },
      }),
    );

    expect(screen.getByText(/Safe Analyze \(Read-Only Rollback\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Executed EXPLAIN ANALYZE inside a READ ONLY transaction/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Operator Inspector')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tree Table/i }));
    expect(screen.getByText('Hash Join')).toBeInTheDocument();
    expect(screen.getAllByText('Seq Scan').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Bottlenecks/i }));
    expect(screen.getAllByText(/Sequential Scan on >=500 rows/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /Raw Plan/i }));
    expect(screen.getByText(/"Execution Time": 15\.2/)).toBeInTheDocument();
  });
});
