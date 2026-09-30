import { useSyncExternalStore } from "react";
import type { Lang } from "./i18n";

export type Role = "phc" | "district" | "state" | "national";
export type AuditEntry = {
  id: string; ts: string; kind: "stock" | "transfer" | "attendance" | "beds";
  phcId: string; medId?: string; delta?: number; note: string;
};
export type Transfer = { id: string; ts: string; medId: string; fromId: string; toId: string; qty: number; km: number };
export type Outbreak = { on: boolean; district: string; meds: string[]; mult: number };
type State = {
  lang: Lang; role: Role;
  stockAdj: Record<string, number>;
  phcAdj: Record<string, { beds?: number; staff?: number }>;
  audit: AuditEntry[]; transfers: Transfer[]; outbreak: Outbreak;
};
const initial: State = {
  lang: "en", role: "national", stockAdj: {}, phcAdj: {}, audit: [], transfers: [],
  outbreak: { on: false, district: "Pune", meds: ["para", "ors", "zinc"], mult: 2 },
};
const LS = "swasthyagrid:v1";
let state = initial;
const subs = new Set<() => void>();
function set(fn: (s: State) => Partial<State>) {
  state = { ...state, ...fn(state) };
  try { localStorage.setItem(LS, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => sel(state), () => sel(initial),
  );
}
export function hydrateStore() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) set(() => ({ ...initial, ...JSON.parse(raw) }));
  } catch { /* ignore */ }
}
const uid = () => (crypto.randomUUID?.() ?? String(Math.random()).slice(2));
const audit = (e: Omit<AuditEntry, "id" | "ts">): AuditEntry => ({ ...e, id: uid(), ts: new Date().toISOString() });

export const actions = {
  setLang: (lang: Lang) => set(() => ({ lang })),
  setRole: (role: Role) => set(() => ({ role })),
  setOutbreak: (o: Partial<Outbreak>) => set((s) => ({ outbreak: { ...s.outbreak, ...o } })),
  adjustStock: (phcId: string, medId: string, delta: number, note: string) =>
    set((s) => {
      const k = `${phcId}|${medId}`;
      return { stockAdj: { ...s.stockAdj, [k]: (s.stockAdj[k] ?? 0) + delta }, audit: [audit({ kind: "stock", phcId, medId, delta, note }), ...s.audit] };
    }),
  setCounts: (phcId: string, staff: number, beds: number, note: string) =>
    set((s) => ({
      phcAdj: { ...s.phcAdj, [phcId]: { staff, beds } },
      audit: [audit({ kind: "attendance", phcId, note: `${note} staff=${staff}, beds=${beds}` }), ...s.audit],
    })),
  approveTransfer: (t: Omit<Transfer, "id" | "ts">) =>
    set((s) => {
      const a = `${t.fromId}|${t.medId}`, b = `${t.toId}|${t.medId}`;
      const tr: Transfer = { ...t, id: uid(), ts: new Date().toISOString() };
      return {
        stockAdj: { ...s.stockAdj, [a]: (s.stockAdj[a] ?? 0) - t.qty, [b]: (s.stockAdj[b] ?? 0) + t.qty },
        transfers: [tr, ...s.transfers],
        audit: [
          audit({ kind: "transfer", phcId: t.toId, medId: t.medId, delta: t.qty, note: `Received from ${t.fromId} (${t.km} km)` }),
          audit({ kind: "transfer", phcId: t.fromId, medId: t.medId, delta: -t.qty, note: `Sent to ${t.toId} (${t.km} km)` }),
          ...s.audit,
        ],
      };
    }),
};
