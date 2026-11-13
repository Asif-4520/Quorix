import type React from 'react';
import postgresPng from '../../assets/postgres.png';
import sqlitePng from '../../assets/sqlite.png';

export interface IconProps {
  size?: number;
  className?: string;
}

export const PostgresIcon: React.FC<IconProps> = ({ size = 16, className = '' }) => (
  <img
    src={postgresPng}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    data-icon="postgres"
    draggable={false}
    style={{ width: size, height: size }}
    className={`shrink-0 object-contain select-none ${className}`}
  />
);

export const SqliteIcon: React.FC<IconProps> = ({ size = 16, className = '' }) => (
  <img
    src={sqlitePng}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    data-icon="sqlite"
    draggable={false}
    style={{ width: size, height: size }}
    className={`shrink-0 object-contain select-none ${className}`}
  />
);

export const MysqlIcon: React.FC<IconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    data-icon="mysql"
    className={`shrink-0 ${className}`}
  >
    <path d="M4 17.5c2.2-5 6.8-10 12.2-10.5 1.8-.2 3.3.4 4.3 1.4-1.5.5-2.6 1.5-2.8 2.8-.3 2-.9 3.8-2.2 5.1-2 2-5.4 2.5-8.5 1.7" />
    <path d="M10.5 8.5L13 4.5l1.2 2.8" />
    <circle cx="16.5" cy="9.7" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

export const EngineIcon: React.FC<{
  engine?: 'postgres' | 'postgresql' | 'sqlite' | 'mysql' | string;
  size?: number;
  className?: string;
}> = ({ engine, size = 14, className }) => {
  const kind = engine?.toLowerCase();
  if (kind === 'sqlite') {
    return <SqliteIcon size={size} className={className} />;
  }
  if (kind === 'mysql') {
    return <MysqlIcon size={size} className={className ?? 'text-amber-400'} />;
  }
  return <PostgresIcon size={size} className={className} />;
};

export const ErDiagramIcon: React.FC<IconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    data-icon="er-diagram"
    className={`shrink-0 ${className}`}
  >
    <rect x="2.5" y="3" width="8.5" height="7" rx="1.5" />
    <line x1="2.5" y1="6" x2="11" y2="6" />
    <rect x="13" y="14" width="8.5" height="7" rx="1.5" />
    <line x1="13" y1="17" x2="21.5" y2="17" />
    <rect x="3" y="15" width="6.5" height="5.5" rx="1.2" />
    <path d="M11 6.5h4.5a1.5 1.5 0 0 1 1.5 1.5v6" />
    <path d="M15.2 12l1.8 2 1.8-2" />
    <path d="M6.2 10v5" />
  </svg>
);

export const SqlQueryIcon: React.FC<IconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    data-icon="sql-query"
    className={`shrink-0 ${className}`}
  >
    <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
    <line x1="3" y1="8.5" x2="21" y2="8.5" />
    <polyline points="7.2 12.2 10.2 14.7 7.2 17.2" />
    <line x1="12" y1="17" x2="16.8" y2="17" />
  </svg>
);

export const RelationsIcon: React.FC<IconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    data-icon="relations"
    className={`shrink-0 ${className}`}
  >
    <rect x="2.5" y="4.5" width="6" height="5" rx="1" />
    <rect x="15.5" y="14.5" width="6" height="5" rx="1" />
    <path d="M8.5 7h4a2 2 0 0 1 2 2v6a2 2 0 0 0 1 2" />
    <path d="M13 17h2.5" />
    <path d="M13.2 14.8l2.3 2.2-2.3 2.2" />
  </svg>
);

export const FunctionIcon: React.FC<IconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.85"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    data-icon="function"
    className={`shrink-0 ${className}`}
  >
    <path d="M12.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 1-3 3" />
    <line x1="6" y1="11.5" x2="12" y2="11.5" />
    <line x1="14.5" y1="13" x2="19.5" y2="18.5" />
    <line x1="19.5" y1="13" x2="14.5" y2="18.5" />
  </svg>
);

export const GithubIcon: React.FC<IconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    data-icon="github"
    className={`shrink-0 ${className}`}
  >
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
  </svg>
);
