// Deterministic synthetic data generated in the browser (cached in memory).
export type Med = { id: string; name: string; unit: string; base: number; infectious: boolean };
export type Phc = {
  id: string; name: string; state: string; district: string; lat: number; lng: number;
  beds_total: number; beds_available: number; staff_total: number; staff_present_today: number;
};
export type Batch = { phcId: string; medId: string; batch: string; expiry: string; qty: number };

export const MEDS: Med[] = [
  { id: "para", name: "Paracetamol", unit: "strips", base: 40, infectious: true },
  { id: "ors", name: "ORS", unit: "sachets", base: 30, infectious: true },
  { id: "amox", name: "Amoxicillin", unit: "strips", base: 14, infectious: true },
  { id: "metf", name: "Metformin", unit: "strips", base: 18, infectious: false },
  { id: "amlo", name: "Amlodipine", unit: "strips", base: 14, infectious: false },
  { id: "ifa", name: "Iron-Folic Acid", unit: "strips", base: 22, infectious: false },
  { id: "zinc", name: "Zinc", unit: "strips", base: 12, infectious: true },
  { id: "cotri", name: "Cotrimoxazole", unit: "strips", base: 8, infectious: true },
  { id: "alben", name: "Albendazole", unit: "tablets", base: 10, infectious: false },
  { id: "salb", name: "Salbutamol", unit: "inhalers", base: 3, infectious: false },
  { id: "oxy", name: "Oxytocin", unit: "ampoules", base: 2, infectious: false },
  { id: "asv", name: "Anti-snake venom", unit: "vials", base: 1.2, infectious: false },
];

const GEO: Record<string, Record<string, [string, number, number][]>> = {
  Maharashtra: {
    Pune: [["Khed", 18.85, 73.88], ["Junnar", 19.2, 73.88], ["Baramati", 18.15, 74.58]],
    Nashik: [["Sinnar", 19.85, 74.0], ["Igatpuri", 19.7, 73.56], ["Niphad", 20.08, 74.11]],
    Nagpur: [["Kamptee", 21.22, 79.2], ["Hingna", 21.07, 78.96], ["Umred", 20.85, 79.33]],
    Aurangabad: [["Paithan", 19.48, 75.38], ["Vaijapur", 19.92, 74.73], ["Kannad", 20.26, 75.13]],
  },
  "Uttar Pradesh": {
    Lucknow: [["Malihabad", 26.92, 80.71], ["Mohanlalganj", 26.68, 80.98], ["Bakshi Ka Talab", 26.98, 80.93]],
    Varanasi: [["Pindra", 25.49, 82.8], ["Cholapur", 25.47, 83.02], ["Araziline", 25.28, 82.9]],
    Gorakhpur: [["Chauri Chaura", 26.64, 83.58], ["Sahjanwa", 26.75, 83.21], ["Campierganj", 27.02, 83.33]],
    Agra: [["Fatehabad", 27.02, 78.3], ["Kiraoli", 27.14, 77.78], ["Bah", 26.87, 78.59]],
  },
  "Tamil Nadu": {
    Kancheepuram: [["Sriperumbudur", 12.97, 79.95], ["Walajabad", 12.79, 79.82], ["Uthiramerur", 12.61, 79.76]],
    Madurai: [["Melur", 10.03, 78.34], ["Usilampatti", 9.97, 77.79], ["Vadipatti", 10.08, 77.96]],
    Coimbatore: [["Pollachi", 10.66, 77.01], ["Mettupalayam", 11.3, 76.94], ["Annur", 11.23, 77.1]],
    Tiruchirappalli: [["Lalgudi", 10.87, 78.82], ["Musiri", 10.95, 78.44], ["Manapparai", 10.61, 78.42]],
  },
};
export const STATES = Object.keys(GEO);
export const DISTRICTS: { state: string; district: string }[] = STATES.flatMap((s) =>
  Object.keys(GEO[s]).map((d) => ({ state: s, district: d })),
);
export const SPIKE_DISTRICT = "Pune";
export const DAYS = 90;
export const TODAY = new Date(Date.UTC(2026, 8, 30));
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const DATES = Array.from({ length: DAYS }, (_, i) => iso(addDays(TODAY, i - DAYS + 1)));

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Seed = {
  phcs: Phc[];
  consumption: Record<string, number[]>; // key `${phc}|${med}`
  stock: Record<string, number>;
  batches: Batch[];
};
let cache: Seed | null = null;
export const key = (phcId: string, medId: string) => `${phcId}|${medId}`;

export function getSeed(): Seed {
  if (cache) return cache;
  const r = mulberry32(20260930);
  const phcs: Phc[] = [];
  const consumption: Record<string, number[]> = {};
  const stock: Record<string, number> = {};
  const batches: Batch[] = [];
  const weekly = [0.6, 1.12, 1.05, 1.0, 1.0, 1.06, 0.92]; // Sun..Sat
  for (const st of STATES)
    for (const d of Object.keys(GEO[st]))
      for (const [town, lat, lng] of GEO[st][d]) {
        const id = town.toLowerCase().replace(/\s+/g, "-");
        const beds_total = 6 + Math.floor(r() * 24);
        const staff_total = 8 + Math.floor(r() * 12);
        phcs.push({
          id, name: `PHC ${town}`, state: st, district: d, lat, lng, beds_total,
          beds_available: Math.floor(beds_total * (r() < 0.15 ? r() * 0.08 : 0.15 + r() * 0.6)),
          staff_total,
          staff_present_today: Math.round(staff_total * (r() < 0.18 ? 0.5 + r() * 0.18 : 0.75 + r() * 0.25)),
        });
        const size = 0.6 + r() * 0.9;
        for (const m of MEDS) {
          const series = DATES.map((ds, t) => {
            const dow = new Date(ds).getUTCDay();
            const monsoon = m.infectious ? 1 + 0.3 * Math.sin((Math.PI * t) / DAYS) : 1;
            const noise = 1 + (r() - 0.5) * 0.35;
            const spike = d === SPIKE_DISTRICT && ["para", "ors", "zinc"].includes(m.id) && t > DAYS - 18
              ? 1 + 2.2 * Math.min(1, (t - (DAYS - 18)) / 10) : 1;
            return Math.max(0, Math.round(m.base * size * weekly[dow] * monsoon * noise * spike));
          });
          const k = key(id, m.id);
          consumption[k] = series;
          const ref = series.slice(60, 75).reduce((a, b) => a + b, 0) / 15 || 1;
          const u = r();
          const cover = u < 0.13 ? 2 + r() * 4 : u < 0.33 ? 50 + r() * 40 : 10 + r() * 30;
          stock[k] = Math.round(ref * cover);
          const near = r() < 0.06;
          batches.push({
            phcId: id, medId: m.id, qty: stock[k],
            batch: `${m.id.toUpperCase()}${Math.floor(1000 + r() * 9000)}`,
            expiry: iso(addDays(TODAY, near ? 20 + Math.floor(r() * 65) : 150 + Math.floor(r() * 600))),
          });
        }
      }
  cache = { phcs, consumption, stock, batches };
  return cache;
}
export const medById = (id: string) => MEDS.find((m) => m.id === id)!;
