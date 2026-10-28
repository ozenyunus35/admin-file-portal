/** Uploaded file bytes live in IndexedDB; metadata lives in the main state. */

const DB_NAME = "atlas-portal";
const STORE = "blobs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = t.onabort = () => {
      db.close();
      reject(t.error ?? req.error);
    };
  });
}

interface Stored {
  type: string;
  data: ArrayBuffer;
}

// Stored as an ArrayBuffer rather than a Blob: WebKit can fail to persist File/Blob values in IndexedDB.
export async function putBlob(id: string, blob: Blob) {
  const value: Stored = { type: blob.type, data: await blob.arrayBuffer() };
  await tx("readwrite", (s) => s.put(value, id));
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const v = await tx<Stored | undefined>("readonly", (s) => s.get(id));
  return v ? new Blob([v.data], { type: v.type }) : undefined;
}
export const deleteBlob = (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined);
export const clearBlobs = () => tx("readwrite", (s) => s.clear()).then(() => undefined);
