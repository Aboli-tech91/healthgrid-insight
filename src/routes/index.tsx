import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { PhcMap } from "@/components/PhcMap";
import { Panel, RiskBadge, ErrorBox, Btn, selectCls } from "@/components/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAnalysis, usePhcs, inScope, worstRisk, stockoutDate } from "@/lib/analysis";
import { MEDS, STATES, DISTRICTS, medById, key } from "@/lib/seed";
import { actions, useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useAi } from "@/lib/useAi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SwasthyaGrid" },
      { name: "description", content: "Live PHC medicine risk map, KPIs and outbreak scenario simulation." },
      { property: "og:title", content: "SwasthyaGrid Dashboard" },
      { property: "og:description", content: "Live PHC medicine risk map, KPIs and outbreak scenario simulation." },
    ],
  }),
  component: Dashboard,
});

type Brief = { title: string; summary: string; actions: string[] };

function Dashboard() {
  const t = useT();
  const role = useStore((s) => s.role);
  const lang = useStore((s) => s.lang);
  const o = useStore((s) => s.outbreak);
  const cells = useAnalysis();
  const phcs = usePhcs();
  const [st, setSt] = useState(""), [di, setDi] = useState(""), [med, setMed] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const brief = useAi<Brief>();

  const scoped = useMemo(() => phcs.filter((p) => inScope(role, p) && (!st || p.state === st) && (!di || p.district === di)), [phcs, role, st, di]);
  const meds = med ? [med] : MEDS.map((m) => m.id);
  const scopedCells = scoped.flatMap((p) => meds.map((m) => cells[key(p.id, m)]));
  const atRisk = scopedCells.filter((c) => c.risk !== "green");
  const bedsPct = Math.round((100 * scoped.reduce((a, p) => a + p.beds_available, 0)) / Math.max(1, scoped.reduce((a, p) => a + p.beds_total, 0)));
  const attPct = Math.round((100 * scoped.reduce((a, p) => a + p.staff_present_today, 0)) / Math.max(1, scoped.reduce((a, p) => a + p.staff_total, 0)));
  const markers = scoped.map((p) => {
    const cs = meds.map((m) => cells[key(p.id, m)]);
    const worst = cs.reduce((a, b) => (b.days < a.days ? b : a));
    return { id: p.id, name: p.name, lat: p.lat, lng: p.lng, risk: worstRisk(cs.map((c) => c.risk)), info: `${p.district} · lowest: ${medById(worst.medId).name} ${worst.days.toFixed(1)}d` };
  });
  const critical = [...atRisk].filter((c) => c.risk === "red").sort((a, b) => a.days - b.days);
  const name = (id: string) => phcs.find((p) => p.id === id)!;

  const genBrief = () => brief.run("briefing", {
    lang, outbreak: o.on ? o : null,
    stockouts: critical.slice(0, 12).map((c) => ({ phc: name(c.phcId).name, district: name(c.phcId).district, medicine: medById(c.medId).name, days_left: +c.days.toFixed(1), stockout_date: stockoutDate(c.days) })),
  });
  const districtOpts = DISTRICTS.filter((d) => !st || d.state === st);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("dashboard")}</h1>
      <div className="grid grid-cols-3 gap-2">
        <select className={selectCls} value={st} onChange={(e) => { setSt(e.target.value); setDi(""); }} aria-label={t("state")}>
          <option value="">{t("state")}: {t("all")}</option>{STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={di} onChange={(e) => setDi(e.target.value)} aria-label={t("district")}>
          <option value="">{t("district")}: {t("all")}</option>{districtOpts.map((d) => <option key={d.district}>{d.district}</option>)}
        </select>
        <select className={selectCls} value={med} onChange={(e) => setMed(e.target.value)} aria-label={t("medicine")}>
          <option value="">{t("medicine")}: {t("all")}</option>{MEDS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ready ? [[t("phcs"), scoped.length], [t("atRisk"), atRisk.length], [t("beds"), `${bedsPct}%`], [t("attendance"), `${attPct}%`]].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{v}</div>
          </div>
        )) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[84px]" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={`${t("risk")} map`}>
          {scoped.length ? <PhcMap markers={markers} /> : <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
          <div className="mt-2 flex gap-3 text-xs"><RiskBadge risk="red" label="< 7d" /><RiskBadge risk="amber" label="7–14d" /><RiskBadge risk="green" label="> 14d" /></div>
        </Panel>
        <Panel title={t("outbreak")}>
          <div className="space-y-3 text-sm">
            <select className={selectCls} value={o.district} onChange={(e) => actions.setOutbreak({ district: e.target.value })}>
              {DISTRICTS.map((d) => <option key={d.district}>{d.district}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {MEDS.map((m) => {
                const on = o.meds.includes(m.id);
                return <button key={m.id} onClick={() => actions.setOutbreak({ meds: on ? o.meds.filter((x) => x !== m.id) : [...o.meds, m.id] })}
                  className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-teal bg-teal text-teal-foreground" : "border-input"}`}>{m.name}</button>;
              })}
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>{t("multiplier")}</span><b className="text-foreground">{o.mult}×</b></div>
              <Slider min={2} max={4} step={0.5} value={[o.mult]} onValueChange={(v) => actions.setOutbreak({ mult: v[0] })} />
            </div>
            <label className="flex items-center justify-between rounded-md bg-muted p-2 font-medium">{t("simulate")}<Switch checked={o.on} onCheckedChange={(on) => actions.setOutbreak({ on })} /></label>
            <Btn variant="teal" className="w-full" onClick={genBrief} disabled={brief.loading}><Sparkles className="h-4 w-4" />{t("briefing")}</Btn>
            {brief.loading && <div className="space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-16" /></div>}
            {brief.error && (
              <div className="space-y-2">
                <ErrorBox msg={`${t("aiFail")} (${brief.error})`} onRetry={genBrief} />
                <ul className="list-disc pl-5 text-xs">{critical.slice(0, 5).map((c) => <li key={key(c.phcId, c.medId)}>{name(c.phcId).name}: {medById(c.medId).name} out by {stockoutDate(c.days)} — request transfer.</li>)}</ul>
              </div>
            )}
            {brief.data && (
              <div className="rounded-md border border-teal/30 bg-accent p-3 text-xs">
                <b className="text-sm">{brief.data.title}</b><p className="my-1">{brief.data.summary}</p>
                <ul className="list-disc pl-4">{brief.data.actions?.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
          </div>
        </Panel>
      </div>
      <Panel title={`${t("atRisk")} (${critical.length})`}>
        <div className="divide-y divide-border text-sm">
          {critical.slice(0, 10).map((c) => (
            <Link key={key(c.phcId, c.medId)} to="/phc/$id" params={{ id: c.phcId }} className="flex items-center justify-between py-2 hover:bg-muted">
              <span>{name(c.phcId).name} <span className="text-muted-foreground">· {name(c.phcId).district} · {medById(c.medId).name}</span></span>
              <RiskBadge risk={c.risk} label={`${c.days.toFixed(1)}d`} />
            </Link>
          ))}
          {!critical.length && <p className="text-muted-foreground">{t("noItems")}</p>}
        </div>
      </Panel>
    </div>
  );
}
