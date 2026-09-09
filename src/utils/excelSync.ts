import * as XLSX from 'xlsx';

const DB_NAME = 'ifc_excel_sync_v1';
const STORE = 'handles';
const HANDLE_KEY = 'primary';
const META_PREFIX = 'ifc_excel_sync_meta_';

export type ExcelSyncState = {
  connected: boolean;
  fileName?: string;
  lastFileHash?: string;
  lastExportHash?: string;
  lastImportAt?: string;
  lastExportAt?: string;
  error?: string;
};

function supported() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('تعذر فتح تخزين ربط Excel.'));
  });
}

async function putHandle(handle: FileSystemFileHandle) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('تعذر حفظ ارتباط Excel.'));
  });
  db.close();
}

async function getHandle(): Promise<FileSystemFileHandle | null> {
  if (!('indexedDB' in window)) return null;
  const db = await openDb();
  const handle = await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

async function digest(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const metaKey = (suffix: string) => `${META_PREFIX}${suffix}`;
const getMeta = (suffix: string) => localStorage.getItem(metaKey(suffix)) || '';
const setMeta = (suffix: string, value: string) => localStorage.setItem(metaKey(suffix), value);

export async function connectExcelFile(): Promise<{ handle: FileSystemFileHandle; state: ExcelSyncState }> {
  if (!supported()) throw new Error('ربط Excel التلقائي يحتاج Google Chrome أو Microsoft Edge على Windows.');
  const handle = await (window as any).showSaveFilePicker({
    suggestedName: 'IFC_Academy_AutoSync.xlsx',
    types: [{ description: 'Excel Workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
  }) as FileSystemFileHandle;
  await putHandle(handle);
  return { handle, state: { connected: true, fileName: handle.name } };
}

export async function restoreExcelHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await getHandle();
    if (!handle) return null;
    const permission = await (handle as any).queryPermission?.({ mode: 'readwrite' });
    if (permission === 'granted') return handle;
    return handle;
  } catch { return null; }
}

export async function ensureExcelPermission(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    const current = await (handle as any).queryPermission?.({ mode: 'readwrite' });
    if (current === 'granted') return true;
    const requested = await (handle as any).requestPermission?.({ mode: 'readwrite' });
    return requested === 'granted';
  } catch { return false; }
}

export async function readExcelWorkbook(handle: FileSystemFileHandle) {
  const file = await handle.getFile();
  const buffer = await file.arrayBuffer();
  const hash = await digest(buffer);
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true, raw: true });
  const sheets: Record<string, any[]> = {};
  workbook.SheetNames.forEach((name) => {
    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: true });
  });
  return { sheets, hash, lastModified: file.lastModified };
}

export async function writeExcelWorkbook(handle: FileSystemFileHandle, workbook: XLSX.WorkBook) {
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const hash = await digest(bytes);
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
  setMeta('lastExportHash', hash);
  setMeta('lastExportAt', new Date().toISOString());
  return hash;
}

export function getExcelSyncMeta(): ExcelSyncState {
  return {
    connected: getMeta('connected') === '1',
    fileName: getMeta('fileName') || undefined,
    lastFileHash: getMeta('lastFileHash') || undefined,
    lastExportHash: getMeta('lastExportHash') || undefined,
    lastImportAt: getMeta('lastImportAt') || undefined,
    lastExportAt: getMeta('lastExportAt') || undefined,
    error: getMeta('error') || undefined,
  };
}

export function markExcelConnected(name: string) {
  setMeta('connected', '1');
  setMeta('fileName', name);
  setMeta('error', '');
}

export function markExcelDisconnected() {
  setMeta('connected', '0');
}

export function markExcelFileHash(hash: string) { setMeta('lastFileHash', hash); }
export function markExcelImported() { setMeta('lastImportAt', new Date().toISOString()); }
export function markExcelError(error: string) { setMeta('error', error); }

export function buildFullExcelWorkbook(data: {
  players: any[]; payments: any[]; expenses: any[]; coaches: any[]; attendance: any[]; settings: any[]; archives?: any[];
}) {
  const workbook = XLSX.utils.book_new();
  const add = (rows: any[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(rows || []);
    const headers = rows?.length ? Object.keys(rows[0]) : [];
    ws['!cols'] = headers.map((h) => ({ wch: Math.min(42, Math.max(14, h.length + 2)) }));
    ws['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(workbook, ws, name);
  };
  add(data.players, 'اللاعبين');
  add(data.payments, 'المدفوعات');
  add(data.expenses, 'المصروفات');
  add(data.coaches, 'المدربين');
  add(data.attendance, 'الحضور');
  add(data.settings, 'الإعدادات');
  add(data.archives || [], 'الأرشيف');
  return workbook;
}
