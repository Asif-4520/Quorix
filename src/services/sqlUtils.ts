import type { DatabaseEngine } from '../types/database';

export interface DangerousSqlAnalysis {
  isUnwheredWrite: boolean;
  isDestructiveDdl: boolean;
  hasDelete: boolean;
  hasDrop: boolean;
  hasTruncate: boolean;
  hasDropOrTruncate: boolean;
  hasWriteDml: boolean;
  hasMultipleStatements: boolean;
  reasons: string[];
}

function stripLiteralsAndComments(sql: string): string {
  let out = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }

    if (ch === '#') {
      while (i < n && sql[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) {
        out += sql[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i + 1 < n) {
        out += '  ';
        i += 2;
      }
      continue;
    }

    if (ch === "'") {
      out += ' ';
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          out += '  ';
          i += 2;
          continue;
        }
        if (sql[i] === '\\' && i + 1 < n) {
          out += '  ';
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          out += ' ';
          i++;
          break;
        }
        out += sql[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }

    if (ch === '"' || ch === '`') {
      const quote = ch;
      out += quote;
      i++;
      while (i < n) {
        if (sql[i] === quote && sql[i + 1] === quote) {
          out += '  ';
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          out += quote;
          i++;
          break;
        }
        out += sql[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

export function splitTopLevelStatements(sql: string): string[] {
  const sanitized = stripLiteralsAndComments(sql);
  const statements: string[] = [];
  let start = 0;

  for (let i = 0; i < sanitized.length; i++) {
    if (sanitized[i] === ';') {
      const part = sql.slice(start, i).trim();
      if (part) statements.push(part);
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

export function analyzeDangerousSql(sql: string): DangerousSqlAnalysis {
  const statements = splitTopLevelStatements(sql);
  let isUnwheredWrite = false;
  let isDestructiveDdl = false;
  let hasDelete = false;
  let hasDrop = false;
  let hasTruncate = false;
  let hasDropOrTruncate = false;
  let hasWriteDml = false;
  const reasons: string[] = [];

  for (const rawStmt of statements) {
    const clean = stripLiteralsAndComments(rawStmt).replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const upper = clean.toUpperCase();
    const hasTrivialWhere = /\bWHERE\s+(1\s*=\s*1|TRUE)\s*$/i.test(upper);

    if (/\bDELETE\b/.test(upper)) {
      hasDelete = true;
      hasWriteDml = true;
    }
    if (
      /^(INSERT|UPDATE|MERGE|REPLACE|UPSERT)\b/.test(upper) ||
      /\bWITH\b[\s\S]*\b(INSERT|UPDATE|DELETE|MERGE)\b/.test(upper)
    ) {
      hasWriteDml = true;
    }

    if (
      (/^DELETE\b/.test(upper) || /\bWITH\b[\s\S]*\bDELETE\b/.test(upper)) &&
      (!/\bWHERE\b/.test(upper) || hasTrivialWhere)
    ) {
      isUnwheredWrite = true;
      reasons.push(
        hasTrivialWhere
          ? 'DELETE statement with an always-true WHERE clause will delete every row in the table.'
          : 'DELETE statement without a WHERE clause will delete every row in the table.',
      );
    } else if (
      (/^UPDATE\b/.test(upper) || /\bWITH\b[\s\S]*\bUPDATE\b/.test(upper)) &&
      (!/\bWHERE\b/.test(upper) || hasTrivialWhere)
    ) {
      isUnwheredWrite = true;
      reasons.push(
        hasTrivialWhere
          ? 'UPDATE statement with an always-true WHERE clause will overwrite every row in the table.'
          : 'UPDATE statement without a WHERE clause will overwrite every row in the table.',
      );
    }

    if (
      /^(DROP\s+(TABLE|DATABASE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|INDEX|FUNCTION|TRIGGER|ROLE|SEQUENCE|TYPE)|TRUNCATE\b)/.test(
        upper,
      ) ||
      /^ALTER\s+TABLE\b.*\bDROP\b/.test(upper)
    ) {
      isDestructiveDdl = true;
      hasDropOrTruncate = true;
      if (/^TRUNCATE\b/.test(upper)) {
        hasTruncate = true;
      } else {
        hasDrop = true;
      }
      reasons.push(`Destructive DDL detected (${upper.split(/\s+/).slice(0, 3).join(' ')}).`);
    }
  }

  return {
    isUnwheredWrite,
    isDestructiveDdl,
    hasDelete,
    hasDrop,
    hasTruncate,
    hasDropOrTruncate,
    hasWriteDml,
    hasMultipleStatements: statements.length > 1,
    reasons: Array.from(new Set(reasons)),
  };
}

export function extractSqlParameters(sql: string): string[] {
  const withoutComments = sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const seen = new Set<string>();
  const ordered: string[] = [];
  const regex = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
  let match: RegExpExecArray | null = regex.exec(withoutComments);
  while (match !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
    match = regex.exec(withoutComments);
  }
  return ordered;
}

export function formatSqlParamValue(raw: string, insideSingleQuotes: boolean): string {
  const trimmed = raw.trim();
  if (insideSingleQuotes) {
    return raw.replace(/'/g, "''");
  }
  if (/^null$/i.test(trimmed)) return 'NULL';
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed;
  }
  return `'${raw.replace(/'/g, "''")}'`;
}

export function substituteSqlParameters(
  sql: string,
  values: Record<string, string>,
  _engine?: DatabaseEngine,
): string {
  return sql.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_full, name, offset: number) => {
    const rawVal = values[name] ?? '';
    let inSingleQuote = false;
    for (let i = 0; i < offset; i++) {
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          i++;
          continue;
        }
        inSingleQuote = !inSingleQuote;
      }
    }
    return formatSqlParamValue(rawVal, inSingleQuote);
  });
}
