import type { SavedConnection } from '../../types/database';
import { STORAGE_KEYS } from './storageKeys';

export function sanitizePgUrlForStorage(rawUrl?: string): string | undefined {
  if (!rawUrl) return rawUrl;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(
    /^((?:postgres(?:ql)?|mysql|mariadb):\/\/[^:/?#\s]+):([^@#/?\s]+)@/i,
    '$1@',
  );
}

export function sanitizeConnectionProfile(conn: SavedConnection): SavedConnection {
  return {
    ...conn,
    url: sanitizePgUrlForStorage(conn.url),
  };
}

export function getSavedConnections(): SavedConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_CONNECTIONS);
    const list: SavedConnection[] = raw ? JSON.parse(raw) : [];
    return list.map(sanitizeConnectionProfile);
  } catch {
    return [];
  }
}

export function saveConnectionProfile(conn: SavedConnection): SavedConnection[] {
  const sanitized = sanitizeConnectionProfile(conn);
  const list = getSavedConnections();
  const idx = list.findIndex((c) => c.id === sanitized.id);
  if (idx >= 0) {
    list[idx] = sanitized;
  } else {
    list.unshift(sanitized);
  }
  localStorage.setItem(STORAGE_KEYS.SAVED_CONNECTIONS, JSON.stringify(list));
  return list;
}

export function deleteSavedConnection(id: string): SavedConnection[] {
  const list = getSavedConnections().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.SAVED_CONNECTIONS, JSON.stringify(list));
  return list;
}

export function getRecentSqliteFiles(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_FILES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentSqliteFile(path: string): string[] {
  const list = getRecentSqliteFiles().filter((p) => p !== path);
  list.unshift(path);
  const next = list.slice(0, 12);
  localStorage.setItem(STORAGE_KEYS.RECENT_FILES, JSON.stringify(next));
  return next;
}
