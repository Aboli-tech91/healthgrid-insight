// Offline-tolerant save queue backed by IndexedDB.
import { actions } from "./store";

export type Change =
  | { type: "stock"; phcId: string; medId: string; delta: number; note: string }
  | { type: "counts"; phcId: string; staff: number; beds: number; note: string };

const DB = "swasthyagrid", STORE = "queue";
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { autoIncrement: true });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function apply(c: Change) {
  if (c.type === "stock") actions.adjustStock(c.phcId, c.medId, c.delta, c.note);
  else actions.setCounts(c.phcId, c.staff, c.beds, c.note);
}
const listeners = new Set<(n: number) => void>();
export const onPending = (f: (n: number) => void) => { listeners.add(f); return () => listeners.delete(f); };
export async function pendingCount() {
  const d = await db();
  return new Promise<number>((res) => { const r = d.transaction(STORE).objectStore(STORE).count(); r.onsuccess = () => res(r.result); });
}
const notify = async () => { const n = await pendingCount(); listeners.forEach((f) => f(n)); };

export async function saveChange(c: Change): Promise<"saved" | "queued"> {
  if (navigator.onLine) { apply(c); return "saved"; }
  const d = await db();
  await new Promise<void>((res, rej) => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).add(c); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  notify();
  return "queued";
}
export async function flush() {
  const d = await db();
  const items = await new Promise<Change[]>((res) => { const r = d.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => res(r.result as Change[]); });
  items.forEach(apply);
  await new Promise<void>((res) => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).clear(); tx.oncomplete = () => res(); });
  notify();
}
