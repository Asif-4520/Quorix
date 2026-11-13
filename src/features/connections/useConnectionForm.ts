import { useEffect, useMemo, useState } from 'react';
import {
  createSqliteFileDialog,
  getCredential,
  selectSqliteFile,
  storeCredential,
  testDatabaseConnection,
} from '../../services/tauri';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type {
  ConnectionEnvironment,
  ConnectionRequest,
  DatabaseEngine,
  SavedConnection,
} from '../../types/database';
import {
  buildSavedProfile,
  parseAdvancedOptionsString,
  parseServerUrlParts,
} from './connectionFormUtils';

interface UseConnectionFormParams {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function useConnectionForm({
  isOpen,
  onClose,
  onConnected,
  onShowToast,
}: UseConnectionFormParams) {
  const savedConnections = useConnectionStore((s) => s.savedConnections);
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const recentSqliteFiles = useConnectionStore((s) => s.recentSqliteFiles);
  const connectWithRequest = useConnectionStore((s) => s.connectWithRequest);
  const connectSavedProfile = useConnectionStore((s) => s.connectSavedProfile);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const saveProfileOnly = useConnectionStore((s) => s.saveProfileOnly);
  const removeSavedProfile = useConnectionStore((s) => s.removeSavedProfile);
  const settings = useSettingsStore((s) => s.settings);

  const [configureStep, setConfigureStep] = useState<'select-engine' | 'details'>('select-engine');
  const [detailsSubTab, setDetailsSubTab] = useState<'general' | 'options'>('general');
  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngine>('postgres');
  const [environment, setEnvironment] = useState<ConnectionEnvironment>('local');
  const [savedFilter, setSavedFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [sqliteName, setSqliteName] = useState('');
  const [sqlitePath, setSqlitePath] = useState('');
  const [sqliteCreateMissing, setSqliteCreateMissing] = useState(false);
  const [sqliteReadOnly, setSqliteReadOnly] = useState(false);

  const [pgMode, setPgMode] = useState<'url' | 'form'>('form');
  const [pgName, setPgName] = useState('');
  const [pgHost, setPgHost] = useState('localhost');
  const [pgPort, setPgPort] = useState('5432');
  const [pgDb, setPgDb] = useState('postgres');
  const [pgUser, setPgUser] = useState('postgres');
  const [pgPassword, setPgPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pgUrl, setPgUrl] = useState('');
  const [pgSslMode, setPgSslMode] = useState('prefer');
  const [pgTimeout, setPgTimeout] = useState(String(settings.connectionTimeout || 10));
  const [pgReadOnly, setPgReadOnly] = useState(false);
  const [pgbouncerMode, setPgbouncerMode] = useState(settings.pgbouncerDefault);
  const [pgAdvancedParam, setPgAdvancedParam] = useState('');
  const [savePasswordToKeyring, setSavePasswordToKeyring] = useState(true);

  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectingProfileId, setConnectingProfileId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const filteredSaved = useMemo(() => {
    const q = savedFilter.trim().toLowerCase();
    return savedConnections.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.engine.toLowerCase().includes(q) ||
        (c.database || c.host || c.path || '').toLowerCase().includes(q)
      );
    });
  }, [savedConnections, savedFilter]);

  const resetForms = () => {
    setEditingId(null);
    setConfigureStep('select-engine');
    setDetailsSubTab('general');
    setEnvironment('local');
    setSqliteName('');
    setSqlitePath('');
    setSqliteCreateMissing(false);
    setSqliteReadOnly(false);
    setPgMode('form');
    setPgName('');
    setPgHost('localhost');
    setPgPort('5432');
    setPgDb('postgres');
    setPgUser('postgres');
    setPgPassword('');
    setPgUrl('');
    setPgSslMode('prefer');
    setPgTimeout(String(settings.connectionTimeout || 10));
    setPgReadOnly(false);
    setPgbouncerMode(settings.pgbouncerDefault);
    setPgAdvancedParam('');
    setTestResult(null);
  };

  const switchConfiguredEngine = (engine: DatabaseEngine) => {
    setSelectedEngine(engine);
    setTestResult(null);
    if (editingId) return;
    if (engine === 'mysql') {
      if (pgPort === '5432') setPgPort('3306');
      if (pgUser === 'postgres') setPgUser('root');
      if (pgDb === 'postgres') setPgDb('');
      if (pgSslMode === 'prefer') setPgSslMode('preferred');
    } else if (engine === 'postgres') {
      if (pgPort === '3306') setPgPort('5432');
      if (pgUser === 'root') setPgUser('postgres');
      if (!pgDb) setPgDb('postgres');
      if (pgSslMode === 'preferred') setPgSslMode('prefer');
    }
  };

  const parsedPgUrl = pgUrl.trim() ? parseServerUrlParts(pgUrl, selectedEngine) : null;

  const applyParsedUrlToFields = () => {
    if (!parsedPgUrl) return;
    setPgHost(parsedPgUrl.host);
    setPgPort(String(parsedPgUrl.port));
    setPgDb(parsedPgUrl.database);
    setPgUser(parsedPgUrl.user);
    if (parsedPgUrl.password) setPgPassword(parsedPgUrl.password);
    if (parsedPgUrl.sslMode) setPgSslMode(parsedPgUrl.sslMode);
    if (!pgName.trim()) setPgName(`${parsedPgUrl.database}@${parsedPgUrl.host}`);
    setPgMode('form');
  };

  const buildRequest = (engineOverride?: DatabaseEngine): ConnectionRequest => {
    const eng = engineOverride ?? selectedEngine;
    const id = editingId || `conn_${Date.now()}`;
    if (eng === 'sqlite') {
      const trimmedPath = sqlitePath.trim();
      const fileBase = trimmedPath.split(/[/\\]/).pop() || 'SQLite Database';
      return {
        connectionId: id,
        engine: eng,
        name: sqliteName.trim() || fileBase,
        path: trimmedPath,
        createIfMissing: sqliteCreateMissing,
        readOnly: sqliteReadOnly,
        timeoutSeconds: Number(pgTimeout) || 8,
        environment,
      };
    }

    const defaultPort = eng === 'mysql' ? 3306 : 5432;
    const engineLabel = eng === 'mysql' ? 'MySQL' : 'PostgreSQL';
    const advancedOptions = parseAdvancedOptionsString(pgAdvancedParam);

    if (pgMode === 'url') {
      const parsed = parseServerUrlParts(pgUrl, eng);
      const effectivePassword = pgPassword || parsed?.password || '';
      return {
        connectionId: id,
        engine: eng,
        name: pgName.trim() || (parsed ? `${parsed.database || eng}@${parsed.host}` : engineLabel),
        url: pgUrl.trim(),
        host: parsed?.host,
        port: parsed?.port,
        user: parsed?.user,
        database: parsed?.database,
        password: effectivePassword,
        sslMode: pgSslMode || parsed?.sslMode || (eng === 'mysql' ? 'preferred' : 'prefer'),
        timeoutSeconds: Number(pgTimeout) || 10,
        readOnly: pgReadOnly,
        pgbouncerMode: eng === 'postgres' ? pgbouncerMode : false,
        advancedOptions,
        environment,
      };
    }

    return {
      connectionId: id,
      engine: eng,
      name: pgName.trim() || `${pgDb || eng}@${pgHost}`,
      host: pgHost.trim(),
      port: Number(pgPort) || defaultPort,
      database: pgDb.trim(),
      user: pgUser.trim(),
      password: pgPassword,
      sslMode: pgSslMode,
      timeoutSeconds: Number(pgTimeout) || 10,
      readOnly: pgReadOnly,
      pgbouncerMode: eng === 'postgres' ? pgbouncerMode : false,
      advancedOptions,
      environment,
    };
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const t0 = performance.now();
    try {
      const req = buildRequest();
      const summary = await testDatabaseConnection(req);
      const latencyMs = Math.round(performance.now() - t0);
      setTestResult({
        ok: true,
        message: `Connected (${summary.serverVersion || summary.engine}) in ${latencyMs} ms`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveProfileOnly = async () => {
    const req = buildRequest();
    const id = req.connectionId || `conn_${Date.now()}`;
    let hasPwd = false;
    if (
      (req.engine === 'postgres' || req.engine === 'mysql') &&
      savePasswordToKeyring &&
      req.password
    ) {
      await storeCredential(id, req.password);
      hasPwd = true;
    } else if (editingId) {
      hasPwd = Boolean(savedConnections.find((c) => c.id === editingId)?.hasSavedPassword);
    }
    saveProfileOnly(buildSavedProfile({ ...req, connectionId: id }, hasPwd));
    setEditingId(id);
    onShowToast(`Saved profile "${req.name}"`, 'success');
  };

  const handleConnectSubmit = async () => {
    setConnecting(true);
    try {
      const req = buildRequest();
      const id = req.connectionId || `conn_${Date.now()}`;
      let hasPwd = false;
      if (
        (req.engine === 'postgres' || req.engine === 'mysql') &&
        savePasswordToKeyring &&
        req.password
      ) {
        await storeCredential(id, req.password);
        hasPwd = true;
      } else if (editingId) {
        const existing = savedConnections.find((c) => c.id === editingId);
        if (existing?.hasSavedPassword && !req.password) {
          req.password = (await getCredential(id)) || '';
          hasPwd = true;
        }
      }

      const profile = buildSavedProfile({ ...req, connectionId: id }, hasPwd);
      const summary = await connectWithRequest({ ...req, connectionId: id }, profile);
      onShowToast(`Connected to ${summary.name}`, 'success');
      resetForms();
      onConnected?.();
      onClose();
    } catch (err) {
      onShowToast(`Connection failed: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectProfileDirect = async (conn: SavedConnection) => {
    setConnectingProfileId(conn.id);
    try {
      const summary = await connectSavedProfile(conn);
      onShowToast(`Connected to ${summary.name}`, 'success');
      onConnected?.();
      onClose();
    } catch (err) {
      onShowToast(`Connect failed: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setConnectingProfileId(null);
    }
  };

  const handleLoadForEdit = async (conn: SavedConnection) => {
    setEditingId(conn.id);
    setTestResult(null);
    setSelectedEngine(conn.engine);
    setEnvironment(conn.environment || 'local');
    setDetailsSubTab('general');
    setConfigureStep('details');
    if (conn.engine === 'sqlite') {
      setSqliteName(conn.name);
      setSqlitePath(conn.path || '');
      setSqliteReadOnly(conn.readOnly);
      setSqliteCreateMissing(false);
    } else {
      const isMysql = conn.engine === 'mysql';
      setPgName(conn.name);
      setPgHost(conn.host || 'localhost');
      setPgPort(String(conn.port || (isMysql ? 3306 : 5432)));
      setPgDb(conn.database || (isMysql ? '' : 'postgres'));
      setPgUser(conn.user || (isMysql ? 'root' : 'postgres'));
      setPgSslMode(conn.sslMode || (isMysql ? 'preferred' : 'prefer'));
      setPgTimeout(String(conn.timeoutSeconds || 10));
      setPgReadOnly(conn.readOnly);
      setPgbouncerMode(Boolean(conn.pgbouncerMode));
      setPgUrl(conn.url || '');
      setPgMode(conn.url ? 'url' : 'form');
      setPgAdvancedParam(
        conn.advancedOptions
          ? Object.entries(conn.advancedOptions)
              .map(([k, v]) => `${k}=${v}`)
              .join('; ')
          : '',
      );
      if (conn.hasSavedPassword) {
        const stored = await getCredential(conn.id);
        setPgPassword(stored || '');
      } else {
        setPgPassword('');
      }
    }
  };

  const handleDuplicate = async (conn: SavedConnection) => {
    const newId = `conn_${Date.now()}`;
    if (conn.hasSavedPassword) {
      const pwd = await getCredential(conn.id);
      if (pwd) await storeCredential(newId, pwd);
    }
    saveProfileOnly({
      ...conn,
      id: newId,
      name: `${conn.name} (Copy)`,
      lastConnected: undefined,
    });
    onShowToast(`Duplicated "${conn.name}"`, 'info');
  };

  const handleBrowseLocalFile = async () => {
    const selected = await selectSqliteFile();
    if (selected) {
      setSqlitePath(selected);
      setSqliteCreateMissing(false);
      if (!sqliteName) {
        setSqliteName(selected.split(/[/\\]/).pop() || 'SQLite DB');
      }
    }
  };

  const handleCreateLocalFile = async () => {
    const selected = await createSqliteFileDialog();
    if (selected) {
      setSqlitePath(selected);
      setSqliteCreateMissing(true);
      if (!sqliteName) {
        setSqliteName(selected.split(/[/\\]/).pop() || 'New SQLite DB');
      }
    }
  };

  const advanceToEngineDetails = (engine: DatabaseEngine = selectedEngine) => {
    switchConfiguredEngine(engine);
    setDetailsSubTab('general');
    setConfigureStep('details');
  };

  const handleSelectRecentSqlite = (filePath: string) => {
    setSqlitePath(filePath);
    setSqliteCreateMissing(false);
    if (!sqliteName) {
      setSqliteName(filePath.split(/[/\\]/).pop() || 'SQLite');
    }
  };

  const editingProfile = editingId
    ? savedConnections.find((c) => c.id === editingId) || null
    : null;

  return {
    savedConnections,
    activeConnections,
    recentSqliteFiles,
    filteredSaved,
    editingProfile,
    configureStep,
    setConfigureStep,
    detailsSubTab,
    setDetailsSubTab,
    selectedEngine,
    environment,
    setEnvironment,
    savedFilter,
    setSavedFilter,
    editingId,
    sqliteName,
    setSqliteName,
    sqlitePath,
    setSqlitePath,
    sqliteCreateMissing,
    setSqliteCreateMissing,
    sqliteReadOnly,
    setSqliteReadOnly,
    pgMode,
    setPgMode,
    pgName,
    setPgName,
    pgHost,
    setPgHost,
    pgPort,
    setPgPort,
    pgDb,
    setPgDb,
    pgUser,
    setPgUser,
    pgPassword,
    setPgPassword,
    showPassword,
    setShowPassword,
    pgUrl,
    setPgUrl,
    parsedPgUrl,
    pgSslMode,
    setPgSslMode,
    pgTimeout,
    setPgTimeout,
    pgReadOnly,
    setPgReadOnly,
    pgbouncerMode,
    setPgbouncerMode,
    pgAdvancedParam,
    setPgAdvancedParam,
    savePasswordToKeyring,
    setSavePasswordToKeyring,
    testing,
    connecting,
    connectingProfileId,
    testResult,
    setTestResult,
    resetForms,
    switchConfiguredEngine,
    applyParsedUrlToFields,
    handleTest,
    handleSaveProfileOnly,
    handleConnectSubmit,
    handleConnectProfileDirect,
    handleLoadForEdit,
    handleDuplicate,
    handleBrowseLocalFile,
    handleCreateLocalFile,
    handleSelectRecentSqlite,
    advanceToEngineDetails,
    disconnect,
    removeSavedProfile,
  };
}
