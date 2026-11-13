import { create } from 'zustand';
import {
  addQueryHistoryItem,
  addRecentObject,
  clearQueryHistory,
  deleteSavedQuery,
  getFavorites,
  getQueryHistory,
  getRecentObjects,
  getSavedQueries,
  getWorkspaceSession,
  saveQueryItem,
  saveWorkspaceSession,
  toggleFavoriteObject,
} from '../services/storage';
import type {
  FavoriteObject,
  FilterRule,
  InspectorTarget,
  QueryHistoryItem,
  RecentObject,
  SavedQuery,
  TabItem,
  TableInfo,
  TableSubTab,
} from '../types/database';
import { useSettingsStore } from './settingsStore';

interface WorkspaceState {
  tabs: TabItem[];
  activeTabId: string;
  closedTabs: TabItem[];
  sidebarOpen: boolean;
  sidebarWidth: number;
  inspectorOpen: boolean;
  inspectorWidth: number;
  inspectorTarget: InspectorTarget | null;

  favorites: FavoriteObject[];
  recentObjects: RecentObject[];
  savedQueries: SavedQuery[];
  queryHistory: QueryHistoryItem[];

  runningQueries: Record<string, { connectionId: string; label: string; startedAt: number }>;
  activeStatusMetrics: {
    rowsInfo?: string;
    cellInfo?: string;
    durationMs?: number;
    txState?: string;
  };

  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setSidebarWidth: (width: number) => void;
  setInspectorOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setInspectorWidth: (width: number) => void;
  setInspectorTarget: (target: InspectorTarget | null, openPanel?: boolean) => void;

  openTableTab: (
    table: TableInfo,
    connectionId: string,
    connectionName?: string,
    subTab?: TableSubTab,
    initialFilters?: FilterRule[],
  ) => void;
  openSqlTab: (opts?: {
    title?: string;
    sql?: string;
    connectionId?: string;
    savedQueryId?: string;
  }) => string;
  openErDiagramTab: (connectionId: string, schema?: string) => void;
  openDatabaseInfoTab: (connectionId: string, title: string) => void;
  openSchemaInfoTab: (connectionId: string, schema: string) => void;
  openSchemaDiffTab: (sourceConnectionId?: string, targetConnectionId?: string) => void;

  setActiveTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<TabItem>) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllUnpinnedTabs: () => void;
  reopenClosedTab: () => void;
  togglePinTab: (id: string) => void;
  cycleTab: (direction: 1 | -1) => void;
  closeTabsForConnection: (connectionId: string) => void;

  toggleFavorite: (item: Omit<FavoriteObject, 'addedAt'>) => void;
  saveQuery: (
    query: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => SavedQuery;
  removeSavedQuery: (id: string) => void;
  recordQueryHistory: (item: Omit<QueryHistoryItem, 'id'>) => void;
  clearHistory: () => void;

  registerRunningQuery: (queryId: string, connectionId: string, label: string) => void;
  unregisterRunningQuery: (queryId: string) => void;
  setStatusMetrics: (metrics: WorkspaceState['activeStatusMetrics']) => void;
  persistSession: () => void;
}

const savedSession = useSettingsStore.getState().settings.restoreWorkspace
  ? getWorkspaceSession()
  : null;

function persistFromState(state: WorkspaceState) {
  if (!useSettingsStore.getState().settings.restoreWorkspace) return;
  saveWorkspaceSession({
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    sidebarOpen: state.sidebarOpen,
    sidebarWidth: state.sidebarWidth,
    inspectorOpen: state.inspectorOpen,
    inspectorWidth: state.inspectorWidth,
  });
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: savedSession?.tabs ?? [],
  activeTabId: savedSession?.activeTabId ?? '',
  closedTabs: [],
  sidebarOpen: savedSession?.sidebarOpen ?? true,
  sidebarWidth: savedSession?.sidebarWidth ?? 272,
  inspectorOpen: savedSession?.inspectorOpen ?? false,
  inspectorWidth: savedSession?.inspectorWidth ?? 340,
  inspectorTarget: null,

  favorites: getFavorites(),
  recentObjects: getRecentObjects(),
  savedQueries: getSavedQueries(),
  queryHistory: getQueryHistory(),

  runningQueries: {},
  activeStatusMetrics: {},

  setSidebarOpen: (open) => {
    set((s) => {
      const next = typeof open === 'function' ? open(s.sidebarOpen) : open;
      return { sidebarOpen: next };
    });
    persistFromState(get());
  },

  setSidebarWidth: (width) => {
    set({ sidebarWidth: Math.max(200, Math.min(480, width)) });
    persistFromState(get());
  },

  setInspectorOpen: (open) => {
    set((s) => {
      const next = typeof open === 'function' ? open(s.inspectorOpen) : open;
      return { inspectorOpen: next };
    });
    persistFromState(get());
  },

  setInspectorWidth: (width) => {
    set({ inspectorWidth: Math.max(260, Math.min(560, width)) });
    persistFromState(get());
  },

  setInspectorTarget: (target, openPanel) => {
    set((s) => ({
      inspectorTarget: target,
      inspectorOpen: openPanel !== undefined ? openPanel : s.inspectorOpen,
    }));
    persistFromState(get());
  },

  openTableTab: (table, connectionId, connectionName = '', subTab = 'data', initialFilters) => {
    const reuse = useSettingsStore.getState().settings.reuseExistingTableTab;
    const schemaName = table.schema || 'main';
    if (reuse && !initialFilters?.length) {
      const existing = get().tabs.find(
        (t) =>
          t.type === 'table' &&
          t.connectionId === connectionId &&
          t.tableName === table.name &&
          (t.schema || 'main') === schemaName,
      );
      if (existing) {
        set((s) => ({
          activeTabId: existing.id,
          tabs: s.tabs.map((t) =>
            t.id === existing.id ? { ...t, activeSubTab: subTab ?? t.activeSubTab } : t,
          ),
        }));
        persistFromState(get());
        return;
      }
    }

    const newId = `table-${connectionId}-${schemaName}-${table.name}-${Date.now()}`;
    const newTab: TabItem = {
      id: newId,
      title: table.name,
      type: 'table',
      connectionId,
      tableName: table.name,
      schema: table.schema,
      tableKind: table.kind,
      activeSubTab: subTab,
      initialFilters,
    };

    const nextRecent = addRecentObject({
      id: `${connectionId}:${schemaName}.${table.name}`,
      connectionId,
      connectionName,
      schema: table.schema,
      name: table.name,
      kind: table.kind,
    });

    set((s) => ({
      tabs: [...s.tabs, newTab],
      activeTabId: newId,
      recentObjects: nextRecent,
    }));
    persistFromState(get());
  },

  openSqlTab: (opts) => {
    const nextNum = get().tabs.filter((t) => t.type === 'sql').length + 1;
    const id = `sql-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tab: TabItem = {
      id,
      title: opts?.title || `Query ${nextNum}`,
      type: 'sql',
      connectionId: opts?.connectionId,
      sqlContent: opts?.sql ?? '-- SQL Workspace\nSELECT 1;\n',
      savedQueryId: opts?.savedQueryId,
      isDirty: false,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    persistFromState(get());
    return id;
  },

  openErDiagramTab: (connectionId, schema) => {
    const existing = get().tabs.find(
      (t) =>
        t.type === 'er-diagram' &&
        t.connectionId === connectionId &&
        (schema === undefined || t.schema === schema),
    );
    if (existing) {
      set({ activeTabId: existing.id });
      persistFromState(get());
      return;
    }
    const id = `erd-${connectionId}-${schema || 'all'}-${Date.now()}`;
    const tab: TabItem = {
      id,
      title: schema ? `ERD · ${schema}` : 'ER Diagram',
      type: 'er-diagram',
      connectionId,
      schema,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    persistFromState(get());
  },

  openDatabaseInfoTab: (connectionId, title) => {
    const existing = get().tabs.find(
      (t) => t.type === 'database-info' && t.connectionId === connectionId,
    );
    if (existing) {
      set({ activeTabId: existing.id });
      persistFromState(get());
      return;
    }
    const id = `dbinfo-${connectionId}-${Date.now()}`;
    set((s) => ({
      tabs: [...s.tabs, { id, title: `${title} · Overview`, type: 'database-info', connectionId }],
      activeTabId: id,
    }));
    persistFromState(get());
  },

  openSchemaInfoTab: (connectionId, schema) => {
    const existing = get().tabs.find(
      (t) => t.type === 'schema-info' && t.connectionId === connectionId && t.schema === schema,
    );
    if (existing) {
      set({ activeTabId: existing.id });
      persistFromState(get());
      return;
    }
    const id = `schemainfo-${connectionId}-${schema}-${Date.now()}`;
    set((s) => ({
      tabs: [
        ...s.tabs,
        { id, title: `Schema · ${schema}`, type: 'schema-info', connectionId, schema },
      ],
      activeTabId: id,
    }));
    persistFromState(get());
  },

  openSchemaDiffTab: (sourceConnectionId, targetConnectionId) => {
    const existing = get().tabs.find((t) => t.type === 'schema-diff');
    if (existing) {
      set((s) => ({
        activeTabId: existing.id,
        tabs: s.tabs.map((t) =>
          t.id === existing.id
            ? {
                ...t,
                sourceConnectionId: sourceConnectionId ?? t.sourceConnectionId,
                targetConnectionId: targetConnectionId ?? t.targetConnectionId,
              }
            : t,
        ),
      }));
      persistFromState(get());
      return;
    }
    const id = `schemadiff-${Date.now()}`;
    set((s) => ({
      tabs: [
        ...s.tabs,
        {
          id,
          title: 'Schema Diff & Sync',
          type: 'schema-diff',
          sourceConnectionId,
          targetConnectionId,
        },
      ],
      activeTabId: id,
    }));
    persistFromState(get());
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
    persistFromState(get());
  },

  updateTab: (id, patch) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    persistFromState(get());
  },

  closeTab: (id) => {
    const target = get().tabs.find((t) => t.id === id);
    if (!target) return;
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const remaining = s.tabs.filter((t) => t.id !== id);
      let nextActive = s.activeTabId;
      if (s.activeTabId === id) {
        nextActive = remaining[Math.min(idx, remaining.length - 1)]?.id ?? '';
      }
      return {
        tabs: remaining,
        activeTabId: nextActive,
        closedTabs: [target, ...s.closedTabs].slice(0, 20),
      };
    });
    persistFromState(get());
  },

  closeOtherTabs: (id) => {
    set((s) => {
      const kept = s.tabs.filter((t) => t.id === id || t.pinned);
      const closed = s.tabs.filter((t) => t.id !== id && !t.pinned);
      return {
        tabs: kept,
        activeTabId: id,
        closedTabs: [...closed, ...s.closedTabs].slice(0, 20),
      };
    });
    persistFromState(get());
  },

  closeAllUnpinnedTabs: () => {
    set((s) => {
      const pinned = s.tabs.filter((t) => t.pinned);
      const closed = s.tabs.filter((t) => !t.pinned);
      const nextActive = pinned.some((t) => t.id === s.activeTabId)
        ? s.activeTabId
        : (pinned[0]?.id ?? '');
      return {
        tabs: pinned,
        activeTabId: nextActive,
        closedTabs: [...closed, ...s.closedTabs].slice(0, 20),
      };
    });
    persistFromState(get());
  },

  reopenClosedTab: () => {
    const [latest, ...rest] = get().closedTabs;
    if (!latest) return;
    const restored = { ...latest, id: `${latest.id}-r-${Date.now()}` };
    set((s) => ({
      tabs: [...s.tabs, restored],
      activeTabId: restored.id,
      closedTabs: rest,
    }));
    persistFromState(get());
  },

  togglePinTab: (id) => {
    set((s) => {
      const updated = s.tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t));
      const pinned = updated.filter((t) => t.pinned);
      const unpinned = updated.filter((t) => !t.pinned);
      return { tabs: [...pinned, ...unpinned] };
    });
    persistFromState(get());
  },

  cycleTab: (direction) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    const currentIndex = Math.max(
      0,
      tabs.findIndex((t) => t.id === activeTabId),
    );
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    set({ activeTabId: tabs[nextIndex].id });
    persistFromState(get());
  },

  closeTabsForConnection: (connectionId) => {
    set((s) => {
      const remaining = s.tabs.filter((t) => t.connectionId !== connectionId);
      const nextActive = remaining.some((t) => t.id === s.activeTabId)
        ? s.activeTabId
        : (remaining[remaining.length - 1]?.id ?? '');
      return { tabs: remaining, activeTabId: nextActive };
    });
    persistFromState(get());
  },

  toggleFavorite: (item) => {
    set({ favorites: toggleFavoriteObject(item) });
  },

  saveQuery: (query) => {
    const item = saveQueryItem(query);
    set({ savedQueries: getSavedQueries() });
    return item;
  },

  removeSavedQuery: (id) => {
    set({ savedQueries: deleteSavedQuery(id) });
  },

  recordQueryHistory: (item) => {
    const limit = useSettingsStore.getState().settings.historyRetentionLimit;
    set({ queryHistory: addQueryHistoryItem(item, limit) });
  },

  clearHistory: () => {
    clearQueryHistory();
    set({ queryHistory: [] });
  },

  registerRunningQuery: (queryId, connectionId, label) => {
    set((s) => ({
      runningQueries: {
        ...s.runningQueries,
        [queryId]: { connectionId, label, startedAt: Date.now() },
      },
    }));
  },

  unregisterRunningQuery: (queryId) => {
    set((s) => {
      const next = { ...s.runningQueries };
      delete next[queryId];
      return { runningQueries: next };
    });
  },

  setStatusMetrics: (metrics) => {
    set({ activeStatusMetrics: metrics });
  },

  persistSession: () => {
    persistFromState(get());
  },
}));
