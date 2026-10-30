// Tiny IndexedDB queue for ride frames captured with no / low network.
const DB = "gg-offline", ST = "frames";
const open = () => new Promise<IDBDatabase>((ok, no) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: "t" }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const tx = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => { const db = await open();
  return new Promise<T>((ok, no) => { const q = f(db.transaction(ST, mode).objectStore(ST)); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); };
export type Frame = { t: number; blob: Blob; lat?: number; lng?: number };
export const queue = {
  add: (f: Frame) => tx("readwrite", s => s.put(f)),
  all: () => tx<Frame[]>("readonly", s => s.getAll() as IDBRequest<Frame[]>),
  count: () => tx<number>("readonly", s => s.count()),
  clear: () => tx("readwrite", s => s.clear()),
};
