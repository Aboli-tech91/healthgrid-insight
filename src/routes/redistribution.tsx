import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Truck, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Panel, Btn, ErrorBox, RiskBadge } from "@/components/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysis, usePhcs, redistribute, type Move } from "@/lib/analysis";
import { medById } from "@/lib/seed";
import { actions, useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useAi } from "@/lib/useAi";

export const Route = createFileRoute("/redistribution")({
  head: () => ({
    meta: [
      { title: "Redistribution — SwasthyaGrid" },
      { name: "description", content: "Distance-optimised stock transfers from surplus to deficit PHCs, with audit log." },
      { property: "og:title", content: "Stock Redistribution — SwasthyaGrid" },
      { property: "og:description", content: "Distance-optimised stock transfers from surplus to deficit PHCs." },
    ],
  }),
  component: Redistribution,
});

function MoveCard({ m }: { m: Move }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const phcs = usePhcs();
  const from = phcs.find((p) => p.id === m.fromId)!, to = phcs.find((p) => p.id === m.toId)!;
  const med = medById(m.medId);
  const x = useAi<{ rationale: string; order: string }>();
  const text = `Move ${m.qty.toLocaleString("en-IN")} ${med.name} ${med.unit} from ${from.name} (${from.district}) to ${to.name} (${to.district}), ${m.km} km, ${m.beforeStockout ? "arrives before stock-out" : "may arrive after stock-out"}.`;
  const explain = () => x.run("rationale", { lang, transfer: text, receiver_days_left: +m.toDays.toFixed(1), eta_hours: m.hours });
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Truck className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
        <div className="flex-1 space-y-2">
          <p className="text-sm">{text}</p>
          <div className="flex flex-wrap gap-2 text-xs"><RiskBadge risk="red" label={`${m.toDays.toFixed(1)}d left`} /><span className="text-muted-foreground">ETA ~{m.hours}h</span></div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={explain} disabled={x.loading}><Sparkles className="h-4 w-4" />{t("explain")}</Btn>
            <Btn onClick={() => { actions.approveTransfer({ medId: m.medId, fromId: m.fromId, toId: m.toId, qty: m.qty, km: m.km }); toast.success(t("approved")); }}><Check className="h-4 w-4" />{t("approve")}</Btn>
          </div>
          {x.loading && <Skeleton className="h-16" />}
          {x.error && <ErrorBox msg={`${t("aiFail")} ${to.name} has ${m.toDays.toFixed(1)} days of ${med.name}; ${from.name} holds surplus >45 days and is the nearest source.`} onRetry={explain} />}
          {x.data && (
            <div className="space-y-2 rounded-md bg-accent p-3 text-xs">
              <p>{x.data.rationale}</p>
              <pre className="whitespace-pre-wrap rounded border border-border bg-card p-2 font-sans">{x.data.order}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Redistribution() {
  const t = useT();
  const [tab, setTab] = useState<"s" | "a">("s");
  const cells = useAnalysis();
  const phcs = usePhcs();
  const audit = useStore((s) => s.audit);
  const moves = useMemo(() => redistribute(cells, phcs), [cells, phcs]);
  const nm = (id: string) => phcs.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("redistribution")}</h1>
      <div className="flex gap-1 rounded-md bg-muted p-1 text-sm">
        {([["s", `${t("suggestions")} (${moves.length})`], ["a", `${t("auditLog")} (${audit.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded px-3 py-1.5 ${tab === k ? "bg-card font-medium shadow-sm" : ""}`}>{l}</button>
        ))}
      </div>
      {tab === "s" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {moves.map((m) => <MoveCard key={`${m.medId}-${m.fromId}-${m.toId}`} m={m} />)}
          {!moves.length && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
        </div>
      ) : (
        <Panel>
          <div className="divide-y divide-border text-sm">
            {audit.map((a) => (
              <div key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b className="capitalize">{a.kind}</b> · {nm(a.phcId)}{a.medId && ` · ${medById(a.medId).name}`}{a.delta !== undefined && ` · ${a.delta > 0 ? "+" : ""}${a.delta}`} <span className="text-muted-foreground">— {a.note}</span></span>
                <span className="text-xs text-muted-foreground">{new Date(a.ts).toLocaleString("en-IN")}</span>
              </div>
            ))}
            {!audit.length && <p className="text-muted-foreground">{t("noItems")}</p>}
          </div>
        </Panel>
      )}
    </div>
  );
}
