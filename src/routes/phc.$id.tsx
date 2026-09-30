import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Panel, RiskBadge, selectCls } from "@/components/bits";
import { useAnalysis, usePhcs, baseForecast, cellMape, multFor } from "@/lib/analysis";
import { getSeed, MEDS, DATES, TODAY, addDays, iso, key, medById } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/phc/$id")({
  loader: ({ params }) => {
    const p = getSeed().phcs.find((x) => x.id === params.id);
    if (!p) throw notFound();
    return { name: p.name, district: p.district };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "PHC"} — SwasthyaGrid` },
      { name: "description", content: `Stock, forecast, beds and attendance for ${loaderData?.name} (${loaderData?.district}).` },
      { property: "og:title", content: `${loaderData?.name} — SwasthyaGrid` },
      { property: "og:description", content: `Medicine stock and 14-day forecast for ${loaderData?.name}.` },
    ],
  }),
  notFoundComponent: () => <p className="p-6">PHC not found. <Link to="/" className="underline">Back</Link></p>,
  component: PhcDetail,
});

function Gauge({ pct, label }: { pct: number; label: string }) {
  const r = 40, c = Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 60" className="w-40">
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--muted)" strokeWidth="10" strokeLinecap="round" />
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke={pct < 10 ? "var(--risk-red)" : "var(--teal)"} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
        <text x="50" y="48" textAnchor="middle" className="fill-foreground text-[14px] font-semibold">{pct}%</text>
      </svg>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function PhcDetail() {
  const { id } = Route.useParams();
  const t = useT();
  const cells = useAnalysis();
  const o = useStore((s) => s.outbreak);
  const p = usePhcs().find((x) => x.id === id)!;
  const [med, setMed] = useState("para");
  const f = baseForecast(id, med);
  const mult = multFor(p, med, o);
  const hist = getSeed().consumption[key(id, med)];
  const data = [
    ...hist.slice(-28).map((v, i) => ({ date: DATES[DAYS_OFFSET + i].slice(5), actual: v })),
    ...f.forecast.map((v, i) => ({ date: iso(addDays(TODAY, i + 1)).slice(5), forecast: +(v * mult).toFixed(1), band: [+(f.lower[i] * mult).toFixed(1), +(f.upper[i] * mult).toFixed(1)] })),
  ];
  const expiry = Object.fromEntries(getSeed().batches.filter((b) => b.phcId === id).map((b) => [b.medId, b]));
  const bedsPct = Math.round((100 * p.beds_available) / p.beds_total);
  const att = Math.round((100 * p.staff_present_today) / p.staff_total);

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-xs text-teal">← {t("dashboard")}</Link>
        <h1 className="text-xl font-semibold text-primary">{p.name}</h1>
        <p className="text-sm text-muted-foreground">{p.district}, {p.state}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title={t("beds")}><Gauge pct={bedsPct} label={`${p.beds_available} / ${p.beds_total}`} /></Panel>
        <Panel title={t("attendance")}><Gauge pct={att} label={`${p.staff_present_today} / ${p.staff_total}`} /></Panel>
        <Panel title={t("accuracy")}>
          <div className="text-3xl font-semibold text-primary">{cellMape(id, med).toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">Holt-Winters, 14-day holdout · {medById(med).name}</p>
        </Panel>
      </div>
      <Panel title={t("forecast")} action={<select className={`${selectCls} w-44`} value={med} onChange={(e) => setMed(e.target.value)}>{MEDS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={5} />
              <YAxis tick={{ fontSize: 10 }} width={32} />
              <Tooltip />
              <Area dataKey="band" stroke="none" fill="var(--teal)" fillOpacity={0.18} name="95% band" />
              <Line dataKey="actual" stroke="var(--primary)" dot={false} strokeWidth={2} name="Actual" />
              <Line dataKey="forecast" stroke="var(--teal)" dot={false} strokeWidth={2} strokeDasharray="5 3" name="Forecast" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {mult > 1 && <p className="text-xs text-risk-red">Outbreak scenario active: demand ×{mult}</p>}
      </Panel>
      <Panel title={t("medicine")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">{t("medicine")}</th><th>{t("stock")}</th><th>/day</th><th>{t("daysLeft")}</th><th>{t("risk")}</th><th>Expiry</th></tr></thead>
            <tbody className="divide-y divide-border">
              {MEDS.map((m) => {
                const c = cells[key(id, m.id)];
                const ex = expiry[m.id];
                const near = (new Date(ex.expiry).getTime() - TODAY.getTime()) / 86400000 < 90;
                return (
                  <tr key={m.id} onClick={() => setMed(m.id)} className="cursor-pointer hover:bg-muted">
                    <td className="py-2 font-medium">{m.name}</td><td>{c.stock} {m.unit}</td><td>{c.demand.toFixed(1)}</td>
                    <td>{c.days.toFixed(1)}</td><td><RiskBadge risk={c.risk} /></td>
                    <td className={near ? "font-medium text-risk-red" : "text-muted-foreground"}>{ex.expiry}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
const DAYS_OFFSET = DATES.length - 28;
