export type DatabaseEngine = 'sqlite' | 'postgres' | 'mysql';

export type ConnectionEnvironment = 'local' | 'staging' | 'production';

export interface SqliteMaintenanceInfo {
  filePath: string;
  fileSizeBytes: number;
  freelistCount: number;
  pageCount: number;
  pageSize: number;
  journalMode: string;
  synchronous: number;
  autoVacuum: number;
  foreignKeys: boolean;
  userVersion: number;
  applicationId: number;
  walSizeBytes?: number;
  walCheckpointResult?: string;
  integrityStatus?: string;
}

export interface ConnectionRequest {
  connectionId?: string;
  engine: DatabaseEngine;
  name: string;
  environment?: ConnectionEnvironment;
  path?: string;
  createIfMissing?: boolean;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  sslMode?: string;
  timeoutSeconds?: number;
  url?: string;
  readOnly: boolean;
  pgbouncerMode?: boolean;
  advancedOptions?: Record<string, string>;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  engine: string;
  engineKind: DatabaseEngine;
  environment?: ConnectionEnvironment;
  readOnly: boolean;
  location: string;
  currentDatabase?: string;
  serverVersion?: string;
  connectedAtMs: number;
}

export interface SavedConnection {
  id: string;
  name: string;
  engine: DatabaseEngine;
  environment?: ConnectionEnvironment;
  path?: string;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  sslMode?: string;
  timeoutSeconds?: number;
  url?: string;
  readOnly: boolean;
  pgbouncerMode?: boolean;
  advancedOptions?: Record<string, string>;
  hasSavedPassword?: boolean;
  lastConnected?: number;
}
