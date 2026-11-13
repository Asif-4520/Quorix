import { ArrowLeft, CheckCircle2, Copy, Loader2, Plug, Trash2, X, XCircle } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Badge } from '../../components/ui/Badge';
import { EngineIcon } from '../../components/ui/DatabaseIcons';
import { getEngineDisplayName, getEnvironmentMeta } from '../../services/envTag';
import { EngineSelectorStep } from './EngineSelectorStep';
import { SavedConnectionsSidebar } from './SavedConnectionsSidebar';
import { ServerConnectionFields, ServerSubTabsBar } from './ServerConnectionFields';
import { SqliteConnectionFields } from './SqliteConnectionFields';
import { useConnectionForm } from './useConnectionForm';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  onShowToast,
}) => {
  const form = useConnectionForm({ isOpen, onClose, onConnected, onShowToast });
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<{
    id: string;
    name: string;
  } | null>(null);
  if (!isOpen) return null;

  const envMeta = getEnvironmentMeta(form.environment);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[840px] h-[570px] max-h-[88vh] bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-11 px-4 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Plug size={15} className="text-[var(--accent)] shrink-0" />
            <span className="text-[13px] font-semibold text-[var(--text)] truncate">
              Connections
            </span>
            {form.activeConnections.length > 0 && (
              <Badge variant="success">{form.activeConnections.length} active</Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close Connection Manager"
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <SavedConnectionsSidebar
            savedConnections={form.savedConnections}
            filteredSaved={form.filteredSaved}
            activeConnections={form.activeConnections}
            editingId={form.editingId}
            connectingProfileId={form.connectingProfileId}
            savedFilter={form.savedFilter}
            onSavedFilterChange={form.setSavedFilter}
            onNewConnection={() => {
              form.resetForms();
              form.setConfigureStep('select-engine');
            }}
            onLoadForEdit={(conn) => void form.handleLoadForEdit(conn)}
            onConnectProfileDirect={(conn) => void form.handleConnectProfileDirect(conn)}
            onDisconnect={form.disconnect}
          />

          <main className="flex-1 min-w-0 flex flex-col bg-[var(--bg-panel)]">
            {!form.editingId && form.configureStep === 'select-engine' && (
              <EngineSelectorStep
                selectedEngine={form.selectedEngine}
                onSelectEngine={form.switchConfiguredEngine}
                onAdvance={form.advanceToEngineDetails}
                onCancel={onClose}
              />
            )}

            {(Boolean(form.editingId) || form.configureStep === 'details') && (
              <>
                <div className={`h-[2px] w-full shrink-0 ${envMeta.dotClass}`} />

                <div className="px-6 pt-3.5 pb-3 border-b border-[var(--border)] bg-[var(--bg-surface)]/35 space-y-3 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!form.editingId && (
                        <button
                          type="button"
                          onClick={() => {
                            form.setTestResult(null);
                            form.setConfigureStep('select-engine');
                          }}
                          title="Back to supported databases"
                          className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-[11px] font-medium inline-flex items-center gap-1 text-[var(--text-secondary)]"
                        >
                          <ArrowLeft size={12} /> Supported DBs
                        </button>
                      )}
                      <EngineIcon engine={form.selectedEngine} size={17} className="shrink-0" />
                      <span className="text-xs font-semibold text-[var(--text)] truncate">
                        {getEngineDisplayName(form.selectedEngine)}
                      </span>
                      <Badge variant="info">
                        {form.editingId ? 'Saved Profile' : 'Step 2 of 2'}
                      </Badge>
                    </div>

                    {form.editingProfile && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (form.editingProfile) {
                              void form.handleDuplicate(form.editingProfile);
                            }
                          }}
                          title="Duplicate profile"
                          className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text-secondary)] inline-flex items-center gap-1"
                        >
                          <Copy size={11} /> Clone
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const profile = form.editingProfile;
                            if (!profile) return;
                            setConfirmDeleteProfile({ id: profile.id, name: profile.name });
                          }}
                          title="Delete profile"
                          className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--error)]/10 hover:text-[var(--error)] text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-7">
                      <input
                        type="text"
                        aria-label="Connection Name"
                        value={form.selectedEngine === 'sqlite' ? form.sqliteName : form.pgName}
                        onChange={(e) =>
                          form.selectedEngine === 'sqlite'
                            ? form.setSqliteName(e.target.value)
                            : form.setPgName(e.target.value)
                        }
                        placeholder="Connection name (optional)"
                        className="w-full text-xs"
                      />
                    </div>

                    <div className="sm:col-span-5">
                      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)]">
                        {(['local', 'staging', 'production'] as const).map((envVal) => {
                          const meta = getEnvironmentMeta(envVal);
                          const selected = form.environment === envVal;
                          return (
                            <button
                              key={envVal}
                              type="button"
                              onClick={() => form.setEnvironment(envVal)}
                              className={`px-2 py-1 rounded-md text-[10.5px] font-medium inline-flex items-center justify-center gap-1 transition-colors ${
                                selected
                                  ? meta.badgeClass
                                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {(form.selectedEngine === 'postgres' || form.selectedEngine === 'mysql') && (
                  <ServerSubTabsBar
                    detailsSubTab={form.detailsSubTab}
                    pgMode={form.pgMode}
                    onDetailsSubTabChange={form.setDetailsSubTab}
                    onPgModeChange={form.setPgMode}
                  />
                )}

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
                  {(form.selectedEngine === 'postgres' || form.selectedEngine === 'mysql') && (
                    <ServerConnectionFields
                      selectedEngine={form.selectedEngine}
                      detailsSubTab={form.detailsSubTab}
                      pgMode={form.pgMode}
                      pgUrl={form.pgUrl}
                      parsedPgUrl={form.parsedPgUrl}
                      pgHost={form.pgHost}
                      pgPort={form.pgPort}
                      pgDb={form.pgDb}
                      pgUser={form.pgUser}
                      pgPassword={form.pgPassword}
                      showPassword={form.showPassword}
                      pgSslMode={form.pgSslMode}
                      pgTimeout={form.pgTimeout}
                      pgReadOnly={form.pgReadOnly}
                      pgbouncerMode={form.pgbouncerMode}
                      pgAdvancedParam={form.pgAdvancedParam}
                      savePasswordToKeyring={form.savePasswordToKeyring}
                      onPgUrlChange={form.setPgUrl}
                      onApplyParsedUrl={form.applyParsedUrlToFields}
                      onPgHostChange={form.setPgHost}
                      onPgPortChange={form.setPgPort}
                      onPgDbChange={form.setPgDb}
                      onPgUserChange={form.setPgUser}
                      onPgPasswordChange={form.setPgPassword}
                      onToggleShowPassword={() => form.setShowPassword((s) => !s)}
                      onPgSslModeChange={form.setPgSslMode}
                      onPgTimeoutChange={form.setPgTimeout}
                      onPgReadOnlyChange={form.setPgReadOnly}
                      onPgbouncerModeChange={form.setPgbouncerMode}
                      onPgAdvancedParamChange={form.setPgAdvancedParam}
                      onSavePasswordToKeyringChange={form.setSavePasswordToKeyring}
                    />
                  )}

                  {form.selectedEngine === 'sqlite' && (
                    <SqliteConnectionFields
                      sqlitePath={form.sqlitePath}
                      sqliteCreateMissing={form.sqliteCreateMissing}
                      sqliteReadOnly={form.sqliteReadOnly}
                      recentSqliteFiles={form.recentSqliteFiles}
                      onSqlitePathChange={form.setSqlitePath}
                      onSqliteCreateMissingChange={form.setSqliteCreateMissing}
                      onSqliteReadOnlyChange={form.setSqliteReadOnly}
                      onBrowseLocalFile={form.handleBrowseLocalFile}
                      onCreateLocalFile={form.handleCreateLocalFile}
                      onSelectRecentFile={form.handleSelectRecentSqlite}
                    />
                  )}

                  {form.testResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                        form.testResult.ok
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {form.testResult.ok ? (
                        <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={15} className="shrink-0 mt-0.5" />
                      )}
                      <span className="break-words">{form.testResult.message}</span>
                    </div>
                  )}
                </div>

                <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {!form.editingId && (
                      <button
                        type="button"
                        disabled={form.testing || form.connecting}
                        onClick={() => {
                          form.setTestResult(null);
                          form.setConfigureStep('select-engine');
                        }}
                        className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <ArrowLeft size={12} /> Back
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={form.testing || form.connecting}
                      onClick={form.handleTest}
                      className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {form.testing && <Loader2 size={12} className="animate-spin" />}
                      Test Connection
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={form.connecting}
                      onClick={form.handleSaveProfileOnly}
                      className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium"
                    >
                      Save Profile
                    </button>
                    <button
                      type="button"
                      disabled={form.connecting}
                      onClick={form.handleConnectSubmit}
                      className="px-4 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {form.connecting && <Loader2 size={12} className="animate-spin" />}
                      {form.editingId ? 'Save & Connect' : 'Connect'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(confirmDeleteProfile)}
        title="Delete Connection Profile"
        message={
          confirmDeleteProfile
            ? `Permanently delete saved profile "${confirmDeleteProfile.name}" and remove its stored credentials from your keychain?`
            : ''
        }
        confirmLabel="Delete Profile"
        onConfirm={async () => {
          if (!confirmDeleteProfile) return;
          await form.removeSavedProfile(confirmDeleteProfile.id);
          form.resetForms();
          onShowToast(`Removed "${confirmDeleteProfile.name}"`, 'info');
          setConfirmDeleteProfile(null);
        }}
        onCancel={() => setConfirmDeleteProfile(null)}
      />
    </div>
  );
};
