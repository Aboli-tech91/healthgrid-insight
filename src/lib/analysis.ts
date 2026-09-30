import { useMemo } from "react";
import { getSeed, key, MEDS, TODAY, addDays, iso, type Phc } from "./seed";
import { holtWinters, mape, riskOf, type Risk } from "./forecast";
import { useStore, type Outbreak, type Role } from "./store";

export type Cell = { phcId: string; medId: string; stock: number; demand: number; days: number; risk: Risk };
const fcCache = new Map<string, ReturnType<typeof holtWinters> & { mape?: number }>();
export function baseForecast(phcId: string, medId: string) {
  const k = key(phcId, medId);
  let f = fcCache.get(k);
  if (!f) { f = holtWinters(getSeed().consumption[k]); fcCache.set(k, f); }
  return f;
}
export function cellMape(phcId: string, medId: string) {
  const f = baseForecast(phcId, medId);
  if (f.mape === undefined) f.mape = mape(getSeed().consumption[key(phcId, medId)]);
  return f.mape;
}
export const multFor = (p: Phc, medId: string, o: Outbreak) =>
  o.on && p.district === o.district && o.meds.includes(medId) ? o.mult : 1;

export function analyze(stockAdj: Record<string, number>, o: Outbreak) {
  const { phcs, stock } = getSeed();
  const cells: Record<string, Cell> = {};
  for (const p of phcs)
    for (const m of MEDS) {
      const k = key(p.id, m.id);
      const f = baseForecast(p.id, m.id).forecast;
      const demand = Math.max(0.1, (f.reduce((a, b) => a + b, 0) / f.length) * multFor(p, m.id, o));
      const s = Math.max(0, stock[k] + (stockAdj[k] ?? 0));
      const days = s / demand;
      cells[k] = { phcId: p.id, medId: m.id, stock: s, demand, days, risk: riskOf(days) };
    }
  return cells;
}
export function useAnalysis() {
  const adj = useStore((s) => s.stockAdj);
  const o = useStore((s) => s.outbreak);
  return useMemo(() => analyze(adj, o), [adj, o]);
}
export function usePhcs() {
  const phcAdj = useStore((s) => s.phcAdj);
  return useMemo(() => getSeed().phcs.map((p) => ({
    ...p,
    staff_present_today: phcAdj[p.id]?.staff ?? p.staff_present_today,
    beds_available: phcAdj[p.id]?.beds ?? p.beds_available,
  })), [phcAdj]);
}
export const DEFAULT_PHC = "khed";
export const inScope = (role: Role, p: Phc) =>
  role === "phc" ? p.id === DEFAULT_PHC : role === "district" ? p.district === "Pune" : role === "state" ? p.state === "Maharashtra" : true;
export const worstRisk = (rs: Risk[]): Risk => (rs.includes("red") ? "red" : rs.includes("amber") ? "amber" : "green");
export const stockoutDate = (days: number) => iso(addDays(TODAY, Math.floor(days)));

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Move = { medId: string; fromId: string; toId: string; qty: number; km: number; hours: number; beforeStockout: boolean; toDays: number };
// Greedy cost-minimising matching: most urgent deficit first, nearest surplus with spare stock.
export function redistribute(cells: Record<string, Cell>, phcs: Phc[]): Move[] {
  const byId = Object.fromEntries(phcs.map((p) => [p.id, p]));
  const moves: Move[] = [];
  for (const m of MEDS) {
    const list = Object.values(cells).filter((c) => c.medId === m.id);
    const spare = new Map(list.filter((c) => c.days > 45).map((c) => [c.phcId, Math.floor(c.stock - 30 * c.demand)]));
    for (const d of list.filter((c) => c.days < 7).sort((a, b) => a.days - b.days)) {
      let need = Math.ceil(21 * d.demand - d.stock);
      const cands = [...spare.entries()].filter(([, q]) => q > 0)
        .map(([id, q]) => ({ id, q, km: haversine(byId[id], byId[d.phcId]) })).sort((a, b) => a.km - b.km);
      for (const c of cands) {
        if (need <= 0) break;
        const qty = Math.min(need, c.q);
        if (qty < 1) continue;
        spare.set(c.id, c.q - qty); need -= qty;
        const hours = Math.round((c.km * 1.3) / 35 + 4);
        moves.push({ medId: m.id, fromId: c.id, toId: d.phcId, qty, km: Math.round(c.km), hours, beforeStockout: hours < d.days * 24, toDays: d.days });
      }
    }
  }
  return moves.sort((a, b) => a.toDays - b.toDays);
}

export type Alert = { id: string; kind: "stockout" | "expiry" | "attendance" | "beds"; severity: number; phcId: string; text: string; medId?: string };
export function buildAlerts(cells: Record<string, Cell>, phcs: Phc[]): Alert[] {
  const out: Alert[] = [];
  const ids = new Set(phcs.map((p) => p.id));
  const name = (id: string) => phcs.find((p) => p.id === id)?.name ?? id;
  for (const c of Object.values(cells)) if (ids.has(c.phcId) && c.risk === "red")
    out.push({ id: `so-${c.phcId}-${c.medId}`, kind: "stockout", severity: c.days < 3 ? 100 : 80, phcId: c.phcId, medId: c.medId,
      text: `${name(c.phcId)}: ${MEDS.find((m) => m.id === c.medId)!.name} runs out in ${c.days.toFixed(1)} days` });
  for (const b of getSeed().batches) {
    const d = (new Date(b.expiry).getTime() - TODAY.getTime()) / 86400000;
    if (ids.has(b.phcId) && d < 90)
      out.push({ id: `ex-${b.phcId}-${b.medId}`, kind: "expiry", severity: d < 30 ? 70 : 50, phcId: b.phcId, medId: b.medId,
        text: `${name(b.phcId)}: batch ${b.batch} (${MEDS.find((m) => m.id === b.medId)!.name}) expires ${b.expiry}` });
  }
  for (const p of phcs) {
    const att = p.staff_present_today / p.staff_total;
    if (att < 0.7) out.push({ id: `at-${p.id}`, kind: "attendance", severity: 60, phcId: p.id, text: `${p.name}: attendance ${Math.round(att * 100)}%` });
    const bf = p.beds_available / p.beds_total;
    if (bf < 0.1) out.push({ id: `bd-${p.id}`, kind: "beds", severity: 65, phcId: p.id, text: `${p.name}: only ${p.beds_available}/${p.beds_total} beds free` });
  }
  return out.sort((a, b) => b.severity - a.severity);
}
