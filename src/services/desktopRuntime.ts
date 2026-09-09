import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { IFC_API_BASE_URL } from '../generated/runtimeConfig.ts';

const API_BASE_URL = String(IFC_API_BASE_URL || '').replace(/\/$/, '');

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
}

async function probeServer(): Promise<boolean> {
  if (!API_BASE_URL) return typeof navigator === 'undefined' ? true : navigator.onLine;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/api/health`, { cache: 'no-store', signal: controller.signal });
    window.clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

export function startNetworkMonitor() {
  if (!isTauriRuntime()) return () => undefined;
  let stopped = false;
  let lastState: boolean | null = null;
  const publish = (online: boolean) => {
    if (lastState === online) return;
    lastState = online;
    try { window.dispatchEvent(new CustomEvent(online ? 'ifc-network-online' : 'ifc-network-offline')); } catch {}
  };
  const tick = async () => {
    if (stopped) return;
    const online = await probeServer();
    if (!stopped) publish(online);
  };
  void tick();
  const timer = window.setInterval(tick, 10000);
  const online = () => publish(true);
  const offline = () => publish(false);
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
  };
}

let updateCheckInFlight: Promise<void> | null = null;

export async function checkAndInstallDesktopUpdate() {
  if (!isTauriRuntime()) return;
  if (updateCheckInFlight) return updateCheckInFlight;
  updateCheckInFlight = (async () => {
    try {
      const update = await check();
      if (!update) return;
      window.dispatchEvent(new CustomEvent('ifc-update-available', { detail: { version: update.version, body: update.body || '' } }));
      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      console.warn('IFC Academy auto-update check failed:', error);
    }
  })().finally(() => { updateCheckInFlight = null; });
  return updateCheckInFlight;
}

export function startDesktopUpdater() {
  if (!isTauriRuntime()) return () => undefined;
  void checkAndInstallDesktopUpdate();
  const timer = window.setInterval(() => { void checkAndInstallDesktopUpdate(); }, 30 * 60 * 1000);
  const onlineHandler = () => { window.setTimeout(() => void checkAndInstallDesktopUpdate(), 5000); };
  window.addEventListener('ifc-network-online', onlineHandler);
  window.addEventListener('online', onlineHandler);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('ifc-network-online', onlineHandler);
    window.removeEventListener('online', onlineHandler);
  };
}
