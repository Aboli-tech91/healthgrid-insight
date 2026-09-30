import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/bits";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/methods")({
  head: () => ({
    meta: [
      { title: "Data & Methods — SwasthyaGrid" },
      { name: "description", content: "Data sources, forecasting method, architecture and scalability notes for SwasthyaGrid." },
      { property: "og:title", content: "Data & Methods — SwasthyaGrid" },
      { property: "og:description", content: "How SwasthyaGrid forecasts, redistributes and uses AI responsibly." },
    ],
  }),
  component: Methods,
});

const ARCH = `  [ PHC staff: photo / voice / manual ]      [ Officials: dashboard ]
                 |  (IndexedDB offline queue)          |
                 v                                     v
        +----------------------- Browser -----------------------+
        |  seed.ts (synthetic data)   forecast.ts (Holt-Winters)|
        |  redistribution (greedy + haversine)   alerts, audit  |
        +--------------------------|----------------------------+
                                   v  {mode, payload}
                        [ one server function "ai" ]
                                   v
                          [ Gemini (key server-side) ]`;

function Methods() {
  const t = useT();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("methods")}</h1>
      <div className="rounded-lg bg-primary p-4 text-center text-lg font-semibold text-primary-foreground">{t("decide")}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Data sources">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>All data shown is <b>synthetic</b>, generated with a seeded random generator and modelled on public health patterns (weekly cycles, monsoon seasonality, a dengue-like spike in Pune).</li>
            <li><b>data.gov.in</b> (HMIS, NHM facility data) would plug in for PHC facilities, beds and consumption.</li>
            <li><b>WHO</b> datasets (Essential Medicines List, GHO disease surveillance) would inform medicine lists and outbreak signals.</li>
          </ul>
        </Panel>
        <Panel title="Methods">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Holt-Winters additive smoothing, weekly season (7), 14-day forecast with 95% band; accuracy as MAPE on a 14-day holdout.</li>
            <li>Days to stock-out = stock ÷ mean forecast daily demand. Red &lt;7, amber 7–14, green &gt;14.</li>
            <li>Redistribution: greedy, nearest-first matching of surplus (&gt;45 days) to deficit (&lt;7 days) PHCs by haversine distance.</li>
            <li>Federated learning: simulated FedAvg of model parameters, weighted by data volume.</li>
          </ul>
        </Panel>
      </div>
      <Panel title="Architecture"><pre className="overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-tight">{ARCH}</pre></Panel>
      <Panel title="Scaling to production">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Store consumption and stock in <b>BigQuery</b>, partitioned by date and district, for nationwide ~30,000 PHCs.</li>
          <li>Train and serve forecasts on <b>Vertex AI</b> (batch nightly, with drift monitoring).</li>
          <li>Real authentication and role-based access would replace the demo role switcher.</li>
        </ul>
      </Panel>
    </div>
  );
}
