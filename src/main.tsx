import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startNetworkMonitor, startDesktopUpdater } from './services/desktopRuntime';

// Prevent benign Vite WebSocket HMR disconnection notices from showing unhandled rejection banners
if (typeof window !== 'undefined') {
  startNetworkMonitor();
  startDesktopUpdater();
  window.addEventListener('load', () => {
    // Tauri updater replaces the application bundle itself. A persistent service-worker
    // cache inside the WebView can otherwise serve stale assets after an EXE update.
    const isTauri = Boolean((window as any).__TAURI_INTERNALS__);
    if (!isTauri && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (msg.includes('WebSocket') || msg.includes('vite') || msg.includes('failed to connect')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

