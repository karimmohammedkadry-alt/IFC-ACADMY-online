/* IFC Academy local-first storage.
 * Web: IndexedDB fallback.
 * Tauri/Windows: native SQLite file `ifc_academy.db` via @tauri-apps/plugin-sql.
 * The same API is kept for the rest of the application so Web and Windows share
 * the exact same offline queue semantics.
 */
export type SyncMutation = {
  id: string;
  method: string;
  url: string;
  body?: any;
  createdAt: string;
  epoch?: number;
  attempts?: number;
  lastError?: string;
  status?: 'pending' | 'syncing' | 'failed';
};

const DB_NAME = 'ifc-academy-local-v1';
const DB_VERSION = 1;
const SNAPSHOTS = 'snapshots';
const QUEUE = 'sync_queue';
const CONFLICTS = 'sync_conflicts';

let dbPromise: Promise<IDBDatabase> | null = null;
let nativeDbPromise: Promise<any> | null = null;

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
}

async function getNativeDb(): Promise<any> {
  if (!isTauriRuntime()) return null;
  if (nativeDbPromise) return nativeDbPromise;
  nativeDbPromise = (async () => {
    const mod = await import('@tauri-apps/plugin-sql');
    const db = await mod.default.load('sqlite:ifc_academy.db');
    await db.execute(`CREATE TABLE IF NOT EXISTS snapshots (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS sync_queue (id TEXT PRIMARY KEY, method TEXT NOT NULL, url TEXT NOT NULL, body TEXT, created_at TEXT NOT NULL, epoch INTEGER, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, status TEXT NOT NULL DEFAULT 'pending')`);
    await db.execute(`CREATE TABLE IF NOT EXISTS sync_conflicts (id TEXT PRIMARY KEY, method TEXT NOT NULL, url TEXT NOT NULL, body TEXT, created_at TEXT NOT NULL, epoch INTEGER, error TEXT, failed_at TEXT NOT NULL)`);
    for (const sql of [
      `ALTER TABLE sync_queue ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE sync_queue ADD COLUMN last_error TEXT`,
      `ALTER TABLE sync_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`,
    ]) { try { await db.execute(sql); } catch {} }
    for (const table of ['players','payments','expenses','coaches','archives','settings']) {
      await db.execute(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    }
    return db;
  })().catch((error) => {
    nativeDbPromise = null;
    throw error;
  });
  return nativeDbPromise;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB غير متاح على هذا الجهاز.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS);
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CONFLICTS)) db.createObjectStore(CONFLICTS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('تعذر فتح قاعدة البيانات المحلية.'));
  });
  return dbPromise;
}

export async function getLocalSnapshot<T>(key: string): Promise<T | null> {
  if (isTauriRuntime()) {
    try {
      const db = await getNativeDb();
      const rows = await db.select('SELECT value FROM snapshots WHERE key = $1 LIMIT 1', [key]);
      return rows?.[0]?.value ? JSON.parse(rows[0].value) as T : null;
    } catch (error) {
      console.warn('SQLite snapshot read failed:', error);
      return null;
    }
  }
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOTS, 'readonly');
      const req = tx.objectStore(SNAPSHOTS).get(key);
      req.onsuccess = () => resolve((req.result ?? null) as T | null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setLocalSnapshot<T>(key: string, value: T): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const db = await getNativeDb();
      const json = JSON.stringify(value);
      const existing = await db.select('SELECT value FROM snapshots WHERE key = $1 LIMIT 1', [key]);
      if (existing?.[0]?.value === json) return;
      const now = new Date().toISOString();
      await db.execute('INSERT INTO snapshots(key,value,updated_at) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at', [key, json, now]);
      const tableMap: Record<string,string> = { players: 'players', payments: 'payments', expenses: 'expenses', coaches: 'coaches', archives: 'archives', settings: 'settings' };
      const table = tableMap[key];
      if (table) {
        // Keep the human-inspectable mirror table in sync only when the snapshot actually changed.
        await db.execute(`DELETE FROM ${table}`);
        const rows = Array.isArray(value) ? value : [{ id: '1', ...((value && typeof value === 'object') ? value as any : {}) }];
        for (const row of rows) {
          const id = String((row as any)?.id || crypto.randomUUID?.() || Date.now());
          await db.execute(`INSERT OR REPLACE INTO ${table}(id,data,updated_at) VALUES($1,$2,$3)`, [id, JSON.stringify(row), now]);
        }
      }
      return;
    } catch (error) {
      console.warn('SQLite snapshot write failed:', error);
      throw new Error('تعذر حفظ البيانات محليًا في SQLite.');
    }
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOTS, 'readwrite');
      tx.objectStore(SNAPSHOTS).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Local snapshot write skipped:', error);
  }
}

export async function removeLocalSnapshot(key: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const db = await getNativeDb();
      await db.execute('DELETE FROM snapshots WHERE key = $1', [key]);
      const tableMap: Record<string,string> = { players: 'players', payments: 'payments', expenses: 'expenses', coaches: 'coaches', archives: 'archives', settings: 'settings' };
      if (tableMap[key]) await db.execute(`DELETE FROM ${tableMap[key]}`);
    } catch {}
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOTS, 'readwrite');
      tx.objectStore(SNAPSHOTS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function clearLocalSnapshots(keys: string[]): Promise<void> {
  await Promise.all(keys.map(removeLocalSnapshot));
}

export async function enqueueMutation(mutation: Omit<SyncMutation, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<SyncMutation> {
  const item: SyncMutation = {
    id: mutation.id || `mut-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`,
    method: mutation.method,
    url: mutation.url,
    body: mutation.body,
    createdAt: mutation.createdAt || new Date().toISOString(),
    epoch: mutation.epoch,
  };
  if (isTauriRuntime()) {
    try {
      await (await getNativeDb()).execute("INSERT OR REPLACE INTO sync_queue(id,method,url,body,created_at,epoch,attempts,last_error,status) VALUES($1,$2,$3,$4,$5,$6,0,NULL,'pending')", [item.id, item.method, item.url, item.body === undefined ? null : JSON.stringify(item.body), item.createdAt, item.epoch ?? null]);
      return item;
    } catch (error) {
      console.error('Failed to queue SQLite offline mutation:', error);
      throw new Error('تعذر حفظ العملية محليًا في SQLite.');
    }
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE, 'readwrite');
      tx.objectStore(QUEUE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to queue offline mutation:', error);
    throw new Error('تعذر حفظ العملية محليًا. لم يتم فقد العملية، يرجى المحاولة مرة أخرى.');
  }
  return item;
}

export async function getQueuedMutations(): Promise<SyncMutation[]> {
  if (isTauriRuntime()) {
    try {
      const rows = await (await getNativeDb()).select('SELECT id,method,url,body,created_at,epoch,attempts,last_error,status FROM sync_queue ORDER BY created_at ASC');
      return (rows || []).map((r: any) => ({ id: r.id, method: r.method, url: r.url, body: r.body ? JSON.parse(r.body) : undefined, createdAt: r.created_at, epoch: r.epoch ?? undefined, attempts: Number(r.attempts || 0), lastError: r.last_error || undefined, status: r.status || 'pending' }));
    } catch { return []; }
  }
  try {
    const db = await openDb();
    return await new Promise<SyncMutation[]>((resolve, reject) => {
      const tx = db.transaction(QUEUE, 'readonly');
      const req = tx.objectStore(QUEUE).getAll();
      req.onsuccess = () => resolve(((req.result || []) as SyncMutation[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function markQueuedMutation(id: string, status: SyncMutation['status'], error?: string): Promise<void> {
  try {
    if (isTauriRuntime()) {
      await (await getNativeDb()).execute(
        `UPDATE sync_queue SET attempts=attempts+1, status=$2, last_error=$3 WHERE id=$1`,
        [id, status || 'pending', error || null]
      );
      return;
    }
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE, 'readwrite');
      const req = tx.objectStore(QUEUE).get(id);
      req.onsuccess = () => {
        const item = req.result as SyncMutation | undefined;
        if (item) tx.objectStore(QUEUE).put({ ...item, attempts: Number(item.attempts || 0) + 1, status, lastError: error || undefined });
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function removeQueuedMutation(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await (await getNativeDb()).execute('DELETE FROM sync_queue WHERE id = $1', [id]);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE, 'readwrite');
    tx.objectStore(QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearQueuedMutations(): Promise<void> {
  try {
    if (isTauriRuntime()) { await (await getNativeDb()).execute('DELETE FROM sync_queue'); return; }
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE, 'readwrite');
      tx.objectStore(QUEUE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function saveSyncConflict(mutation: SyncMutation, error: any): Promise<void> {
  const message = String(error?.message || error || 'Unknown error');
  const failedAt = new Date().toISOString();
  try {
    if (isTauriRuntime()) {
      const db = await getNativeDb();
      await db.execute('INSERT OR REPLACE INTO sync_conflicts(id,method,url,body,created_at,epoch,error,failed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [mutation.id, mutation.method, mutation.url, mutation.body === undefined ? null : JSON.stringify(mutation.body), mutation.createdAt, mutation.epoch ?? null, message, failedAt]);
      return;
    }
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONFLICTS, 'readwrite');
      tx.objectStore(CONFLICTS).put({ ...mutation, error: message, failedAt });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function getQueuedMutationCount(): Promise<number> {
  if (isTauriRuntime()) {
    try { const rows = await (await getNativeDb()).select('SELECT COUNT(*) AS count FROM sync_queue'); return Number(rows?.[0]?.count || 0); } catch { return 0; }
  }
  return (await getQueuedMutations()).length;
}
