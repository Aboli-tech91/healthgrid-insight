import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Server, ArrowDown, Database } from "lucide-react";
import { Panel } from "@/components/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { getSeed, STATES, MEDS, key } from "@/lib/seed";
import { fitParams, mape, type HWParams } from "@/lib/forecast";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/federated")({
  head: () => ({
    meta: [
      { title: "Federated Learning — SwasthyaGrid" },
      { name: "description", content: "Simulation of federated forecasting across three state nodes with FedAvg parameter aggregation." },
      { property: "og:title", content: "Federated Learning Simulation — SwasthyaGrid" },
      { property: "og:description", content: "State nodes share only model parameters, never raw data." },
    ],
  }),
  component: Federated,
});

type Row = { state: string; n: number; local: HWParams; localMape: number; fedMape: number };
function simulate(): { rows: Row[]; global: HWParams } {
  const { phcs, consumption } = getSeed();
  const nodes = STATES.map((s) => {
    // Each node only sees a small local sample (3 PHCs) — the reason federation helps.
    const local = phcs.filter((p) => p.state === s);
    const series = local.flatMap((p) => MEDS.map((m) => consumption[key(p.id, m.id)]));
    const train = series.filter((_, i) => i % 12 < 3);
    const params = fitParams(train);
    return { state: s, series, params, n: train.reduce((a, x) => a + x.length, 0) };
  });
  const N = nodes.reduce((a, x) => a + x.n, 0);
  const avg = (k: keyof HWParams) => nodes.reduce((a, x) => a + (x.params[k] * x.n) / N, 0);
  const global = { alpha: avg("alpha"), beta: avg("beta"), gamma: avg("gamma") };
  const m = (ss: number[][], p: HWParams) => ss.reduce((a, s) => a + mape(s, p), 0) / ss.length;
  return { global, rows: nodes.map((x) => ({ state: x.state, n: x.n, local: x.params, localMape: m(x.series, x.params), fedMape: m(x.series, global) })) };
}
const fmt = (p: HWParams) => `α ${p.alpha.toFixed(2)} · β ${p.beta.toFixed(2)} · γ ${p.gamma.toFixed(2)}`;

function Federated() {
  const t = useT();
  const [res, setRes] = useState<ReturnType<typeof simulate> | null>(null);
  useEffect(() => { const id = setTimeout(() => setRes(simulate()), 30); return () => clearTimeout(id); }, []);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-primary">{t("federated")}</h1>
        <span className="mt-1 inline-block rounded-full bg-risk-amber/20 px-2.5 py-0.5 text-xs font-medium">Simulation of federated architecture</span>
      </div>
      <Panel title="Flow">
        <div className="flex flex-col items-center gap-2 text-sm">
          <div className="grid w-full grid-cols-3 gap-2">
            {STATES.map((s) => (
              <div key={s} className="rounded-md border border-border bg-muted p-3 text-center">
                <Database className="mx-auto mb-1 h-5 w-5 text-primary" /><b className="text-xs">{s}</b>
                <p className="text-[11px] text-muted-foreground">Raw data stays here · local Holt-Winters fit</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs text-teal"><ArrowDown className="h-4 w-4" />parameters only (α, β, γ, n)</div>
          <div className="rounded-md bg-primary p-3 text-center text-primary-foreground">
            <Server className="mx-auto mb-1 h-5 w-5" /><b className="text-xs">Central aggregator — FedAvg (weighted by data volume)</b>
            {res && <p className="text-[11px] opacity-80">{fmt(res.global)}</p>}
          </div>
          <div className="flex items-center gap-1 text-xs text-teal"><ArrowDown className="h-4 w-4 rotate-180" />global parameters sent back</div>
        </div>
      </Panel>
      <Panel title="Local-only vs federated MAPE (14-day holdout, all PHC × medicine series)">
        {!res ? <Skeleton className="h-32" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">State</th><th>Data points</th><th>Local params</th><th>Local MAPE</th><th>Federated MAPE</th></tr></thead>
              <tbody className="divide-y divide-border">
                {res.rows.map((r) => (
                  <tr key={r.state}><td className="py-2 font-medium">{r.state}</td><td>{r.n}</td><td className="text-xs">{fmt(r.local)}</td><td>{r.localMape.toFixed(1)}%</td>
                    <td className={r.fedMape <= r.localMape ? "font-medium text-risk-green" : ""}>{r.fedMape.toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
