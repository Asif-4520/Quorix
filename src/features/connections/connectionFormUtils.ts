import { sanitizePgUrlForStorage } from '../../services/storage';
import type { ConnectionRequest, DatabaseEngine, SavedConnection } from '../../types/database';

export const SSL_MODE_OPTIONS: Record<'postgres' | 'mysql', string[]> = {
  postgres: ['prefer', 'require', 'verify-ca', 'verify-full', 'allow', 'disable'],
  mysql: ['preferred', 'required', 'verify-ca', 'verify-identity', 'disabled'],
};

export const SUPPORTED_DB_ENGINES: Array<{
  id: DatabaseEngine;
  name: string;
  subtitle: string;
  tag: string;
}> = [
  {
    id: 'postgres',
    name: 'PostgreSQL',
    subtitle: 'URL or Host / Port · Port 5432',
    tag: 'URL · Form',
  },
  {
    id: 'mysql',
    name: 'MySQL / MariaDB',
    subtitle: 'URL or Host / Port · Port 3306',
    tag: 'URL · Form',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    subtitle: 'Local .db / .sqlite file',
    tag: 'Local File',
  },
];

export interface ParsedServerUrl {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslMode?: string;
}

export function parseServerUrlParts(
  rawUrl: string,
  engine: DatabaseEngine,
): ParsedServerUrl | null {
  try {
    const normalized = rawUrl
      .trim()
      .replace(/^postgresql:\/\//i, 'postgres://')
      .replace(/^mariadb:\/\//i, 'mysql://');
    const url = new URL(normalized);
    const isMysql = engine === 'mysql' || url.protocol === 'mysql:';
    return {
      host: url.hostname || 'localhost',
      port: url.port ? Number(url.port) : isMysql ? 3306 : 5432,
      user: decodeURIComponent(url.username || (isMysql ? 'root' : 'postgres')),
      password: decodeURIComponent(url.password || ''),
      database: decodeURIComponent(url.pathname.replace(/^\//, '') || (isMysql ? '' : 'postgres')),
      sslMode: url.searchParams.get('sslmode') || url.searchParams.get('ssl-mode') || undefined,
    };
  } catch {
    return null;
  }
}

export function parseAdvancedOptionsString(rawParam: string): Record<string, string> | undefined {
  const trimmed = rawParam.trim();
  if (!trimmed) return undefined;
  const out: Record<string, string> = {};
  for (const pair of trimmed.split(/[;\n]/)) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (k && v) out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildSavedProfile(req: ConnectionRequest, hasPassword: boolean): SavedConnection {
  return {
    id: req.connectionId || `conn_${Date.now()}`,
    name: req.name,
    engine: req.engine,
    environment: req.environment || 'local',
    path: req.path,
    host: req.host,
    port: req.port,
    user: req.user,
    database: req.database,
    sslMode: req.sslMode,
    timeoutSeconds: req.timeoutSeconds,
    url: sanitizePgUrlForStorage(req.url),
    readOnly: req.readOnly,
    pgbouncerMode: req.pgbouncerMode,
    advancedOptions: req.advancedOptions,
    hasSavedPassword: hasPassword,
    lastConnected: Date.now(),
  };
}
