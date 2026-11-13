import { create } from 'zustand';
import {
  addRecentSqliteFile,
  deleteSavedConnection,
  getRecentSqliteFiles,
  getSavedConnections,
  saveConnectionProfile,
} from '../services/storage';
import {
  connectDatabase,
  deleteCredential,
  disconnectDatabase,
  getCredential,
  getDatabaseOverview,
  introspectSchema,
  listActiveConnections,
  listSchemaObjects,
  listSchemas,
  setActiveConnection,
} from '../services/tauri';
import type {
  ConnectionRequest,
  ConnectionSummary,
  DatabaseOverviewResponse,
  SavedConnection,
  SchemaInfo,
  SchemaIntrospection,
  SchemaObjectsResponse,
} from '../types/database';

interface ConnectionState {
  activeConnections: ConnectionSummary[];
  activeConnectionId: string | null;
  savedConnections: SavedConnection[];
  recentSqliteFiles: string[];
  overviews: Record<string, DatabaseOverviewResponse>;
  schemasByConn: Record<string, SchemaInfo[]>;
  objectsByConnSchema: Record<string, SchemaObjectsResponse>;
  introspectionsByConn: Record<string, SchemaIntrospection>;
  loadingSchemas: Record<string, boolean>;
  loadingObjects: Record<string, boolean>;
  connectingId: string | null;

  hydrateConnections: () => Promise<ConnectionSummary | null>;
  connectWithRequest: (
    request: ConnectionRequest,
    saveProfile?: SavedConnection,
  ) => Promise<ConnectionSummary>;
  connectSavedProfile: (profile: SavedConnection) => Promise<ConnectionSummary>;
  disconnect: (connectionId?: string) => Promise<void>;
  switchActiveConnection: (connectionId: string) => Promise<void>;
  refreshConnectionTree: (connectionId: string) => Promise<void>;
  loadSchemaObjects: (
    connectionId: string,
    schema: string,
    force?: boolean,
  ) => Promise<SchemaObjectsResponse>;
  loadFullIntrospection: (connectionId: string, force?: boolean) => Promise<SchemaIntrospection>;
  saveProfileOnly: (profile: SavedConnection) => void;
  removeSavedProfile: (id: string) => Promise<void>;
  addRecentSqlite: (path: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  activeConnections: [],
  activeConnectionId: null,
  savedConnections: getSavedConnections(),
  recentSqliteFiles: getRecentSqliteFiles(),
  overviews: {},
  schemasByConn: {},
  objectsByConnSchema: {},
  introspectionsByConn: {},
  loadingSchemas: {},
  loadingObjects: {},
  connectingId: null,

  hydrateConnections: async () => {
    try {
      const list = await listActiveConnections();
      const first = list[0] ?? null;
      set({
        activeConnections: list,
        activeConnectionId: first?.id ?? null,
      });
      if (first) {
        await get().refreshConnectionTree(first.id);
      }
      return first;
    } catch {
      return null;
    }
  },

  connectWithRequest: async (request, saveProfile) => {
    const connId = request.connectionId || saveProfile?.id;
    set({ connectingId: connId ?? '__connecting__' });
    try {
      const summary = await connectDatabase({ ...request, connectionId: connId });
      if (saveProfile) {
        const nextSaved = saveConnectionProfile({
          ...saveProfile,
          id: summary.id,
          lastConnected: Date.now(),
        });
        set({ savedConnections: nextSaved });
      }
      if (request.engine === 'sqlite' && request.path) {
        set({ recentSqliteFiles: addRecentSqliteFile(request.path) });
      }

      const existing = get().activeConnections.filter((c) => c.id !== summary.id);
      set({
        activeConnections: [summary, ...existing],
        activeConnectionId: summary.id,
      });
      await get().refreshConnectionTree(summary.id);
      return summary;
    } finally {
      set({ connectingId: null });
    }
  },

  connectSavedProfile: async (profile) => {
    set({ connectingId: profile.id });
    try {
      let pwd = '';
      if (profile.hasSavedPassword) {
        pwd = (await getCredential(profile.id)) || '';
      }
      const req: ConnectionRequest = {
        connectionId: profile.id,
        engine: profile.engine,
        name: profile.name,
        path: profile.path,
        createIfMissing: false,
        host: profile.host,
        port: profile.port,
        database: profile.database,
        user: profile.user,
        password: pwd,
        sslMode: profile.sslMode,
        timeoutSeconds: profile.timeoutSeconds || 10,
        url: profile.url,
        readOnly: profile.readOnly,
        pgbouncerMode: profile.pgbouncerMode,
        advancedOptions: profile.advancedOptions,
      };
      return await get().connectWithRequest(req, profile);
    } finally {
      set({ connectingId: null });
    }
  },

  disconnect: async (connectionId) => {
    const targetId = connectionId ?? get().activeConnectionId ?? undefined;
    await disconnectDatabase(targetId);
    const remaining = get().activeConnections.filter((c) => c.id !== targetId);
    const nextActive =
      get().activeConnectionId === targetId ? (remaining[0]?.id ?? null) : get().activeConnectionId;

    if (nextActive) {
      await setActiveConnection(nextActive).catch(() => {});
    }

    set((state) => {
      const nextObjects = { ...state.objectsByConnSchema };
      if (targetId) {
        for (const key of Object.keys(nextObjects)) {
          if (key.startsWith(`${targetId}:`)) {
            delete nextObjects[key];
          }
        }
      }
      const nextSchemas = { ...state.schemasByConn };
      const nextOverviews = { ...state.overviews };
      const nextIntro = { ...state.introspectionsByConn };
      if (targetId) {
        delete nextSchemas[targetId];
        delete nextOverviews[targetId];
        delete nextIntro[targetId];
      }
      return {
        activeConnections: remaining,
        activeConnectionId: nextActive,
        schemasByConn: nextSchemas,
        overviews: nextOverviews,
        objectsByConnSchema: nextObjects,
        introspectionsByConn: nextIntro,
      };
    });
  },

  switchActiveConnection: async (connectionId) => {
    await setActiveConnection(connectionId);
    set({ activeConnectionId: connectionId });
    if (!get().schemasByConn[connectionId]) {
      await get().refreshConnectionTree(connectionId);
    }
  },

  refreshConnectionTree: async (connectionId) => {
    set((s) => ({
      loadingSchemas: { ...s.loadingSchemas, [connectionId]: true },
    }));
    try {
      const [overview, schemas] = await Promise.all([
        getDatabaseOverview(connectionId),
        listSchemas(connectionId),
      ]);

      const primarySchema =
        schemas.find((s) => s.name === 'public') ||
        schemas.find((s) => s.name === 'main') ||
        schemas.find((s) => !s.isSystem);

      let primaryObjects: SchemaObjectsResponse | null = null;
      if (primarySchema) {
        primaryObjects = await listSchemaObjects(primarySchema.name, connectionId);
      }

      introspectSchema(connectionId)
        .then((intro) => {
          set((s) => ({
            introspectionsByConn: { ...s.introspectionsByConn, [connectionId]: intro },
          }));
        })
        .catch(() => {});

      set((s) => {
        const nextObjects = { ...s.objectsByConnSchema };
        for (const k of Object.keys(nextObjects)) {
          if (k.startsWith(`${connectionId}:`)) delete nextObjects[k];
        }
        if (primarySchema && primaryObjects) {
          nextObjects[`${connectionId}:${primarySchema.name}`] = primaryObjects;
        }
        return {
          overviews: { ...s.overviews, [connectionId]: overview },
          schemasByConn: { ...s.schemasByConn, [connectionId]: schemas },
          objectsByConnSchema: nextObjects,
        };
      });
    } finally {
      set((s) => ({
        loadingSchemas: { ...s.loadingSchemas, [connectionId]: false },
      }));
    }
  },

  loadSchemaObjects: async (connectionId, schema, force = false) => {
    const cacheKey = `${connectionId}:${schema}`;
    const cached = get().objectsByConnSchema[cacheKey];
    if (cached && !force) return cached;

    set((s) => ({
      loadingObjects: { ...s.loadingObjects, [cacheKey]: true },
    }));
    try {
      const objects = await listSchemaObjects(schema, connectionId);
      set((s) => ({
        objectsByConnSchema: { ...s.objectsByConnSchema, [cacheKey]: objects },
      }));
      return objects;
    } finally {
      set((s) => ({
        loadingObjects: { ...s.loadingObjects, [cacheKey]: false },
      }));
    }
  },

  loadFullIntrospection: async (connectionId, force = false) => {
    const cached = get().introspectionsByConn[connectionId];
    if (cached && !force) return cached;
    const intro = await introspectSchema(connectionId);
    set((s) => ({
      introspectionsByConn: { ...s.introspectionsByConn, [connectionId]: intro },
    }));
    return intro;
  },

  saveProfileOnly: (profile) => {
    const next = saveConnectionProfile(profile);
    set({ savedConnections: next });
  },

  removeSavedProfile: async (id) => {
    await deleteCredential(id);
    const next = deleteSavedConnection(id);
    set({ savedConnections: next });
  },

  addRecentSqlite: (path) => {
    set({ recentSqliteFiles: addRecentSqliteFile(path) });
  },
}));
