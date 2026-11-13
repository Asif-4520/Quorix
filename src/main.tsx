import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { SettingsWindowApp } from './app/SettingsWindowApp';
import { ShortcutsWindowApp } from './app/ShortcutsWindowApp';
import { getStudioWindowKind } from './services/tauri';
import './styles/index.css';

const windowKind = getStudioWindowKind();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {windowKind === 'shortcuts' ? (
      <ShortcutsWindowApp />
    ) : windowKind === 'settings' ? (
      <SettingsWindowApp />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
