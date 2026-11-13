import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { EngineIcon } from '../../components/ui/DatabaseIcons';
import { getEngineShortLabel, getEnvironmentMeta } from '../../services/envTag';
import { formatShortcutForDisplay, getEffectiveShortcut } from '../../services/shortcuts';
import type { ConnectionSummary, SavedConnection } from '../../types/database';

interface ConnectionSwitcherDropdownProps {
  currentConnection: ConnectionSummary | null;
  activeConnections: ConnectionSummary[];
  savedConnections: SavedConnection[];
  isConnecting: boolean;
  onSwitchActiveConnection: (id: string) => void;
  onSelectSavedConnection: (conn: SavedConnection) => void;
  onOpenNewConnectionModal: () => void;
  onDisconnect: (id?: string) => void;
}

export const ConnectionSwitcherDropdown: React.FC<ConnectionSwitcherDropdownProps> = ({
  currentConnection,
  activeConnections,
  savedConnections,
  isConnecting,
  onSwitchActiveConnection,
  onSelectSavedConnection,
  onOpenNewConnectionModal,
  onDisconnect,
}) => {
  const [showConnMenu, setShowConnMenu] = useState(false);
  const [connFilter, setConnFilter] = useState('');
  const connMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (connMenuRef.current && !connMenuRef.current.contains(e.target as Node)) {
        setShowConnMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredSaved = savedConnections.filter(
    (c) =>
      c.name.toLowerCase().includes(connFilter.toLowerCase()) ||
      (c.database || c.path || '').toLowerCase().includes(connFilter.toLowerCase()),
  );
  const recentSaved = filteredSaved
    .filter((c) => typeof c.lastConnected === 'number' && c.lastConnected > 0)
    .sort((a, b) => (b.lastConnected ?? 0) - (a.lastConnected ?? 0));
  const otherSaved = filteredSaved
    .filter((c) => !c.lastConnected)
    .sort((a, b) => a.name.localeCompare(b.name));
  const savedSections = [
    { key: 'recent', title: 'Recent Connections', items: recentSaved },
    { key: 'saved', title: 'Saved Profiles', items: otherSaved },
  ].filter((sec) => sec.items.length > 0);

  return (
    <div className="connection-switcher-relative" ref={connMenuRef}>
      <button
        type="button"
        className={`connection-selector-pill titlebar-conn-pill ${currentConnection ? 'connected' : ''}`}
        onClick={() => setShowConnMenu((prev) => !prev)}
        title={
          currentConnection
            ? `${currentConnection.name}${currentConnection.currentDatabase ? ` · ${currentConnection.currentDatabase}` : ''} (${currentConnection.location}) — Click to switch (${formatShortcutForDisplay(getEffectiveShortcut('switch-connection'))})`
            : `Select or Connect Database (${formatShortcutForDisplay(getEffectiveShortcut('switch-connection'))})`
        }
      >
        <span className={`status-indicator ${currentConnection ? 'connected' : ''}`} />
        {currentConnection ? (
          <>
            <EngineIcon
              engine={currentConnection.engineKind}
              size={13}
              className={
                currentConnection.engineKind === 'sqlite'
                  ? 'text-[var(--success)] shrink-0'
                  : 'text-[var(--info)] shrink-0'
              }
            />
            <span className="connection-display-name">
              {currentConnection.name}
              {currentConnection.currentDatabase &&
              currentConnection.currentDatabase !== currentConnection.name
                ? ` · ${currentConnection.currentDatabase}`
                : ''}
            </span>
            <span className="engine-tag">{getEngineShortLabel(currentConnection.engineKind)}</span>
            {currentConnection.environment && currentConnection.environment !== 'local' && (
              <span
                className={`text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded border ${getEnvironmentMeta(currentConnection.environment).badgeClass}`}
              >
                {getEnvironmentMeta(currentConnection.environment).shortLabel}
              </span>
            )}
          </>
        ) : (
          <span className="text-[var(--text-muted)] font-medium">No Connection</span>
        )}
        <ChevronDown size={11} className="text-[var(--text-muted)] shrink-0" />
      </button>

      {showConnMenu && (
        <div className="connection-dropdown-menu centered">
          <div className="dropdown-search-wrap">
            <Search size={12} className="text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filter recent or saved connections…"
              value={connFilter}
              onChange={(e) => setConnFilter(e.target.value)}
              className="dropdown-search-input"
              autoFocus
            />
          </div>

          <div className="dropdown-list">
            {activeConnections.length > 0 && (
              <>
                <div className="dropdown-section-title">Active Sessions</div>
                {activeConnections.map((conn) => (
                  <div
                    key={`active-${conn.id}`}
                    className={`dropdown-conn-item ${currentConnection?.id === conn.id ? 'current' : ''}`}
                    onClick={() => {
                      onSwitchActiveConnection(conn.id);
                      setShowConnMenu(false);
                    }}
                  >
                    <span className={`mini-engine-badge ${conn.engineKind}`}>
                      {getEngineShortLabel(conn.engineKind)}
                    </span>
                    <div className="item-details">
                      <span className="item-name">{conn.name}</span>
                      <span className="item-sub">{conn.location}</span>
                    </div>
                    {conn.environment === 'production' && (
                      <span
                        className={`text-[9px] uppercase px-1 rounded border ${getEnvironmentMeta(conn.environment).badgeClass}`}
                      >
                        PROD
                      </span>
                    )}
                    {currentConnection?.id === conn.id && (
                      <Check size={12} className="text-[var(--accent)]" />
                    )}
                  </div>
                ))}
                <div className="menubar-separator" />
              </>
            )}

            {savedSections.length === 0 ? (
              <>
                <div className="dropdown-section-title">Saved Profiles</div>
                <div className="dropdown-empty">No matching profiles</div>
              </>
            ) : (
              savedSections.map((sec, secIdx) => (
                <div key={sec.key}>
                  {secIdx > 0 && <div className="menubar-separator" />}
                  <div className="dropdown-section-title">{sec.title}</div>
                  {sec.items.map((conn) => (
                    <div
                      key={`${sec.key}-${conn.id}`}
                      className={`dropdown-conn-item ${currentConnection?.id === conn.id ? 'current' : ''}`}
                      onClick={() => {
                        onSelectSavedConnection(conn);
                        setShowConnMenu(false);
                      }}
                    >
                      <EngineIcon
                        engine={conn.engine}
                        size={13}
                        className={
                          conn.engine === 'sqlite'
                            ? 'text-[var(--success)] shrink-0'
                            : 'text-[var(--info)] shrink-0'
                        }
                      />
                      <span className={`mini-engine-badge ${conn.engine}`}>
                        {getEngineShortLabel(conn.engine)}
                      </span>
                      <div className="item-details">
                        <span className="item-name">{conn.name}</span>
                        <span className="item-sub">
                          {conn.engine === 'sqlite'
                            ? conn.path
                            : `${conn.host || 'localhost'}:${conn.port || (conn.engine === 'mysql' ? 3306 : 5432)}/${conn.database || ''}`}
                        </span>
                      </div>
                      {currentConnection?.id === conn.id && (
                        <Check size={12} className="text-[var(--accent)]" />
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="dropdown-footer">
            <button
              type="button"
              className="dropdown-footer-btn primary"
              disabled={isConnecting}
              onClick={() => {
                setShowConnMenu(false);
                onOpenNewConnectionModal();
              }}
            >
              <Plus size={12} /> Manage / New
            </button>
            {currentConnection && (
              <button
                type="button"
                className="dropdown-footer-btn danger"
                onClick={() => {
                  setShowConnMenu(false);
                  onDisconnect(currentConnection.id);
                }}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
