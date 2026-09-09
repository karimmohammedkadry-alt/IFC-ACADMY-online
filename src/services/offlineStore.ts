/* IFC Academy local-first storage.
 * Uses IndexedDB (not localStorage) for real offline data + an ordered mutation queue.
 */
export type SyncMutation = {
  id: string;
  method: string;
  url: string;
  body?: any;
  createdAt: string;
  epoch?: number;
};

const DB_NAME = 'ifc-academy-local-v1';
const DB_VERSION = 1;
const SNAPSHOTS = 'snapshots';
const QUEUE = 'sync_queue';
const CONFLICTS = 'sync_conflicts';

let dbPromise: Promise<IDBDatabase> | null = null;

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
    id: mutation.id || `mut-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    method: mutation.method,
    url: mutation.url,
    body: mutation.body,
    createdAt: mutation.createdAt || new Date().toISOString(),
    epoch: mutation.epoch,
  };
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

export async function removeQueuedMutation(id: string): Promise<void> {
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
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONFLICTS, 'readwrite');
      tx.objectStore(CONFLICTS).put({ ...mutation, error: String(error?.message || error || 'Unknown error'), failedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function getQueuedMutationCount(): Promise<number> {
  return (await getQueuedMutations()).length;
}
