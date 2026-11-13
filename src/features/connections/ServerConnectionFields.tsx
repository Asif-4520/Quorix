import { Eye, EyeOff, Link2, Lock, Server, Shield, SlidersHorizontal } from 'lucide-react';
import type React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Checkbox } from '../../components/ui/Checkbox';
import { type ParsedServerUrl, SSL_MODE_OPTIONS } from './connectionFormUtils';

interface ServerSubTabsBarProps {
  detailsSubTab: 'general' | 'options';
  pgMode: 'url' | 'form';
  onDetailsSubTabChange: (tab: 'general' | 'options') => void;
  onPgModeChange: (mode: 'url' | 'form') => void;
}

export const ServerSubTabsBar: React.FC<ServerSubTabsBarProps> = ({
  detailsSubTab,
  pgMode,
  onDetailsSubTabChange,
  onPgModeChange,
}) => (
  <div className="px-6 pt-2 border-b border-[var(--border)] bg-[var(--bg-surface)]/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onDetailsSubTabChange('general')}
        className={`pb-2 text-xs font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 ${
          detailsSubTab === 'general'
            ? 'border-[var(--accent)] text-[var(--accent)]'
            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        <Server size={12} /> General
      </button>
      <button
        type="button"
        onClick={() => onDetailsSubTabChange('options')}
        className={`pb-2 text-xs font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 ${
          detailsSubTab === 'options'
            ? 'border-[var(--accent)] text-[var(--accent)]'
            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        <SlidersHorizontal size={12} /> Options &amp; Security
      </button>
    </div>

    {detailsSubTab === 'general' && (
      <div className="pb-1.5">
        <div className="inline-flex rounded-lg p-0.5 bg-[var(--bg-surface)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => onPgModeChange('url')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
              pgMode === 'url'
                ? 'bg-[var(--bg-panel)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Link2 size={11} /> Connection URL
          </button>
          <button
            type="button"
            onClick={() => onPgModeChange('form')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
              pgMode === 'form'
                ? 'bg-[var(--bg-panel)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <SlidersHorizontal size={11} /> Connection Fields
          </button>
        </div>
      </div>
    )}
  </div>
);

interface ServerConnectionFieldsProps {
  selectedEngine: 'postgres' | 'mysql';
  detailsSubTab: 'general' | 'options';
  pgMode: 'url' | 'form';
  pgUrl: string;
  parsedPgUrl: ParsedServerUrl | null;
  pgHost: string;
  pgPort: string;
  pgDb: string;
  pgUser: string;
  pgPassword: string;
  showPassword: boolean;
  pgSslMode: string;
  pgTimeout: string;
  pgReadOnly: boolean;
  pgbouncerMode: boolean;
  pgAdvancedParam: string;
  savePasswordToKeyring: boolean;
  onPgUrlChange: (value: string) => void;
  onApplyParsedUrl: () => void;
  onPgHostChange: (value: string) => void;
  onPgPortChange: (value: string) => void;
  onPgDbChange: (value: string) => void;
  onPgUserChange: (value: string) => void;
  onPgPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onPgSslModeChange: (value: string) => void;
  onPgTimeoutChange: (value: string) => void;
  onPgReadOnlyChange: (value: boolean) => void;
  onPgbouncerModeChange: (value: boolean) => void;
  onPgAdvancedParamChange: (value: string) => void;
  onSavePasswordToKeyringChange: (value: boolean) => void;
}

export const ServerConnectionFields: React.FC<ServerConnectionFieldsProps> = ({
  selectedEngine,
  detailsSubTab,
  pgMode,
  pgUrl,
  parsedPgUrl,
  pgHost,
  pgPort,
  pgDb,
  pgUser,
  pgPassword,
  showPassword,
  pgSslMode,
  pgTimeout,
  pgReadOnly,
  pgbouncerMode,
  pgAdvancedParam,
  savePasswordToKeyring,
  onPgUrlChange,
  onApplyParsedUrl,
  onPgHostChange,
  onPgPortChange,
  onPgDbChange,
  onPgUserChange,
  onPgPasswordChange,
  onToggleShowPassword,
  onPgSslModeChange,
  onPgTimeoutChange,
  onPgReadOnlyChange,
  onPgbouncerModeChange,
  onPgAdvancedParamChange,
  onSavePasswordToKeyringChange,
}) => {
  if (detailsSubTab === 'options') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Timeout (seconds)
            </label>
            <input
              type="number"
              min={2}
              max={60}
              value={pgTimeout}
              onChange={(e) => onPgTimeoutChange(e.target.value)}
              className="w-full font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              SSL Mode
            </label>
            <select
              value={pgSslMode}
              onChange={(e) => onPgSslModeChange(e.target.value)}
              className="w-full"
            >
              {SSL_MODE_OPTIONS[selectedEngine].map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedEngine === 'postgres' && (
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Startup Parameters
            </label>
            <input
              type="text"
              value={pgAdvancedParam}
              onChange={(e) => onPgAdvancedParamChange(e.target.value)}
              placeholder="statement_timeout=15000"
              className="w-full font-mono"
            />
          </div>
        )}

        <div className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] space-y-2">
          <div className="text-[11px] font-semibold text-[var(--text)] flex items-center gap-1.5">
            <Lock size={12} className="text-[var(--accent)]" /> Session Policy
          </div>
          <Checkbox
            checked={savePasswordToKeyring}
            onChange={onSavePasswordToKeyringChange}
            size="sm"
            label="Save password in OS Keyring"
          />
          <Checkbox
            checked={pgReadOnly}
            onChange={onPgReadOnlyChange}
            size="sm"
            label="Read-Only Mode"
          />
          {selectedEngine === 'postgres' && (
            <Checkbox
              checked={pgbouncerMode}
              onChange={onPgbouncerModeChange}
              size="sm"
              label="PgBouncer Mode"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {pgMode === 'url' ? (
        <div className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                Connection URI
              </label>
              {parsedPgUrl && (
                <button
                  type="button"
                  onClick={onApplyParsedUrl}
                  className="text-[10.5px] text-[var(--accent)] hover:underline font-medium"
                >
                  Fill Fields →
                </button>
              )}
            </div>
            <input
              type="text"
              value={pgUrl}
              onChange={(e) => onPgUrlChange(e.target.value)}
              placeholder={
                selectedEngine === 'mysql'
                  ? 'mysql://user:password@host:3306/database'
                  : 'postgresql://user:password@host:5432/database?sslmode=require'
              }
              className="w-full font-mono"
              autoFocus
            />
            {parsedPgUrl && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                <Badge variant="info">{parsedPgUrl.host}</Badge>
                <Badge variant="neutral">:{parsedPgUrl.port}</Badge>
                {parsedPgUrl.database && <Badge variant="success">{parsedPgUrl.database}</Badge>}
                <Badge variant="neutral">user: {parsedPgUrl.user}</Badge>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Password Override
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pgPassword}
                  onChange={(e) => onPgPasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-8"
                />
                <button
                  type="button"
                  onClick={onToggleShowPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                SSL Mode
              </label>
              <select
                value={pgSslMode}
                onChange={(e) => onPgSslModeChange(e.target.value)}
                className="w-full"
              >
                {SSL_MODE_OPTIONS[selectedEngine].map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Host
            </label>
            <input
              type="text"
              value={pgHost}
              onChange={(e) => onPgHostChange(e.target.value)}
              className="w-full font-mono"
              autoFocus
            />
          </div>
          <div className="col-span-4">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Port
            </label>
            <input
              type="number"
              value={pgPort}
              onChange={(e) => onPgPortChange(e.target.value)}
              className="w-full font-mono"
            />
          </div>
          <div className="col-span-6">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Database {selectedEngine === 'mysql' ? '(Optional)' : ''}
            </label>
            <input
              type="text"
              value={pgDb}
              onChange={(e) => onPgDbChange(e.target.value)}
              placeholder={selectedEngine === 'mysql' ? 'All schemas' : 'postgres'}
              className="w-full font-mono"
            />
          </div>
          <div className="col-span-6">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              SSL Mode
            </label>
            <select
              value={pgSslMode}
              onChange={(e) => onPgSslModeChange(e.target.value)}
              className="w-full"
            >
              {SSL_MODE_OPTIONS[selectedEngine].map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-6">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Username
            </label>
            <input
              type="text"
              value={pgUser}
              onChange={(e) => onPgUserChange(e.target.value)}
              className="w-full font-mono"
            />
          </div>
          <div className="col-span-6">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={pgPassword}
                onChange={(e) => onPgPasswordChange(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-8"
              />
              <button
                type="button"
                onClick={onToggleShowPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Checkbox
          checked={savePasswordToKeyring}
          onChange={onSavePasswordToKeyringChange}
          size="sm"
          label={
            <span className="inline-flex items-center gap-1">
              <Shield size={12} className="text-[var(--accent)]" /> Save in OS Keyring
            </span>
          }
        />
        <Checkbox
          checked={pgReadOnly}
          onChange={onPgReadOnlyChange}
          size="sm"
          label="Read-Only Mode"
        />
      </div>
    </>
  );
};
