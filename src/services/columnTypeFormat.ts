export type ColumnTypeCategory =
  | 'text'
  | 'number'
  | 'bool'
  | 'date'
  | 'json'
  | 'uuid'
  | 'blob'
  | 'other';

export interface ColumnTypeMeta {
  shortLabel: string;
  fullType: string;
  category: ColumnTypeCategory;
  badgeClass: string;
}

const CATEGORY_CLASSES: Record<ColumnTypeCategory, string> = {
  text: 'bg-sky-500/12 text-sky-600 dark:text-sky-300 border-sky-500/25',
  number: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  bool: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25',
  date: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
  json: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
  uuid: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
  blob: 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]',
  other: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]',
};

export function formatColumnTypeMeta(rawType?: string | null): ColumnTypeMeta {
  const fullType = (rawType || 'text').trim() || 'text';
  const base = fullType
    .toLowerCase()
    .replace(/\(.*\)$/, '')
    .trim();

  let shortLabel = base;
  let category: ColumnTypeCategory = 'other';

  if (
    base === 'text' ||
    base === 'citext' ||
    base === 'clob' ||
    base === 'character varying' ||
    base === 'varchar' ||
    base === 'nvarchar' ||
    base === 'character' ||
    base === 'char' ||
    base === 'bpchar' ||
    base === 'tinytext' ||
    base === 'mediumtext' ||
    base === 'longtext'
  ) {
    shortLabel = 'text';
    category = 'text';
  } else if (base === 'uuid') {
    shortLabel = 'uuid';
    category = 'uuid';
  } else if (base === 'boolean' || base === 'bool') {
    shortLabel = 'bool';
    category = 'bool';
  } else if (base === 'bigint' || base === 'int8' || base === 'bigserial') {
    shortLabel = 'bigint';
    category = 'number';
  } else if (
    base === 'integer' ||
    base === 'int' ||
    base === 'int4' ||
    base === 'int2' ||
    base === 'smallint' ||
    base === 'mediumint' ||
    base === 'tinyint' ||
    base === 'serial' ||
    base === 'smallserial'
  ) {
    shortLabel = 'int';
    category = 'number';
  } else if (
    base === 'numeric' ||
    base === 'decimal' ||
    base === 'real' ||
    base === 'float' ||
    base === 'float4' ||
    base === 'float8' ||
    base === 'double' ||
    base === 'double precision' ||
    base === 'money'
  ) {
    shortLabel = base === 'numeric' || base === 'decimal' ? 'numeric' : 'float';
    category = 'number';
  } else if (base === 'jsonb' || base === 'json') {
    shortLabel = base;
    category = 'json';
  } else if (base === 'timestamptz' || base === 'timestamp with time zone') {
    shortLabel = 'timestamptz';
    category = 'date';
  } else if (
    base === 'timestamp' ||
    base === 'timestamp without time zone' ||
    base === 'datetime'
  ) {
    shortLabel = base === 'datetime' ? 'datetime' : 'timestamp';
    category = 'date';
  } else if (base === 'date') {
    shortLabel = 'date';
    category = 'date';
  } else if (
    base === 'time' ||
    base === 'timetz' ||
    base === 'time with time zone' ||
    base === 'time without time zone' ||
    base === 'interval'
  ) {
    shortLabel = base === 'interval' ? 'interval' : 'time';
    category = 'date';
  } else if (
    base === 'bytea' ||
    base === 'blob' ||
    base === 'binary' ||
    base === 'varbinary' ||
    base === 'tinyblob' ||
    base === 'mediumblob' ||
    base === 'longblob'
  ) {
    shortLabel = 'blob';
    category = 'blob';
  } else {
    shortLabel = base.length > 12 ? `${base.slice(0, 11)}…` : base;
  }

  return {
    shortLabel,
    fullType,
    category,
    badgeClass: CATEGORY_CLASSES[category],
  };
}
