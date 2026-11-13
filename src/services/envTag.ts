import type { ConnectionEnvironment, DatabaseEngine } from '../types/database';

export interface EnvironmentMeta {
  value: ConnectionEnvironment;
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotClass: string;
  badgeVariant: 'success' | 'warning' | 'error';
}

const ENV_MAP: Record<ConnectionEnvironment, EnvironmentMeta> = {
  local: {
    value: 'local',
    label: 'Local',
    shortLabel: 'LOCAL',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    badgeVariant: 'success',
  },
  staging: {
    value: 'staging',
    label: 'Staging',
    shortLabel: 'STAGING',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-500',
    badgeVariant: 'warning',
  },
  production: {
    value: 'production',
    label: 'Production',
    shortLabel: 'PROD',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/35 font-bold',
    dotClass: 'bg-rose-500',
    badgeVariant: 'error',
  },
};

export function getEnvironmentMeta(env?: ConnectionEnvironment | null): EnvironmentMeta {
  return ENV_MAP[env || 'local'] || ENV_MAP.local;
}

export function getEngineShortLabel(engine?: DatabaseEngine | string | null): string {
  switch (engine) {
    case 'postgres':
      return 'PG';
    case 'mysql':
      return 'MySQL';
    case 'sqlite':
      return 'SQLite';
    default:
      return String(engine || 'DB').toUpperCase();
  }
}

export function getEngineDisplayName(engine?: DatabaseEngine | string | null): string {
  switch (engine) {
    case 'postgres':
      return 'PostgreSQL';
    case 'mysql':
      return 'MySQL / MariaDB';
    case 'sqlite':
      return 'SQLite';
    default:
      return String(engine || 'Database');
  }
}
