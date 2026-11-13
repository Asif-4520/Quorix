import type {
  FavoriteObject,
  QueryHistoryItem,
  RecentObject,
  SavedQuery,
} from '../../types/database';
import { STORAGE_KEYS } from './storageKeys';

export function getQueryHistory(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUERY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addQueryHistoryItem(
  item: Omit<QueryHistoryItem, 'id'>,
  retentionLimit = 250,
): QueryHistoryItem[] {
  const list = getQueryHistory();
  const fullItem: QueryHistoryItem = {
    ...item,
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  list.unshift(fullItem);
  const trimmed = list.slice(0, Math.max(10, retentionLimit));
  localStorage.setItem(STORAGE_KEYS.QUERY_HISTORY, JSON.stringify(trimmed));
  return trimmed;
}

export function clearQueryHistory(): void {
  localStorage.removeItem(STORAGE_KEYS.QUERY_HISTORY);
}

export function getSavedQueries(): SavedQuery[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_QUERIES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQueryItem(
  query: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): SavedQuery {
  const list = getSavedQueries();
  const now = Date.now();
  let item: SavedQuery;

  if (query.id) {
    const idx = list.findIndex((q) => q.id === query.id);
    if (idx >= 0) {
      item = {
        ...list[idx],
        ...query,
        updatedAt: now,
      };
      list[idx] = item;
    } else {
      item = {
        id: query.id,
        title: query.title,
        sql: query.sql,
        folder: query.folder,
        favorite: query.favorite,
        connectionId: query.connectionId,
        createdAt: now,
        updatedAt: now,
      };
      list.unshift(item);
    }
  } else {
    item = {
      id: `query_${now}_${Math.random().toString(36).slice(2, 7)}`,
      title: query.title,
      sql: query.sql,
      folder: query.folder,
      favorite: query.favorite,
      connectionId: query.connectionId,
      createdAt: now,
      updatedAt: now,
    };
    list.unshift(item);
  }

  localStorage.setItem(STORAGE_KEYS.SAVED_QUERIES, JSON.stringify(list));
  return item;
}

export function deleteSavedQuery(id: string): SavedQuery[] {
  const list = getSavedQueries().filter((q) => q.id !== id);
  localStorage.setItem(STORAGE_KEYS.SAVED_QUERIES, JSON.stringify(list));
  return list;
}

export function getFavorites(): FavoriteObject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteObject(item: Omit<FavoriteObject, 'addedAt'>): FavoriteObject[] {
  const list = getFavorites();
  const exists = list.some((f) => f.id === item.id);
  const next = exists
    ? list.filter((f) => f.id !== item.id)
    : [{ ...item, addedAt: Date.now() }, ...list].slice(0, 50);
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(next));
  return next;
}

export function getRecentObjects(): RecentObject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_OBJECTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentObject(item: Omit<RecentObject, 'openedAt'>): RecentObject[] {
  const list = getRecentObjects().filter((r) => r.id !== item.id);
  const next = [{ ...item, openedAt: Date.now() }, ...list].slice(0, 25);
  localStorage.setItem(STORAGE_KEYS.RECENT_OBJECTS, JSON.stringify(next));
  return next;
}
