import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, PackageX, CalendarClock, Users, BedDouble } from "lucide-react";
import { Panel, Btn } from "@/components/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysis, usePhcs, buildAlerts, inScope, type Alert } from "@/lib/analysis";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { ai } from "@/lib/useAi";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — SwasthyaGrid" },
      { name: "description", content: "Stock-out, near-expiry, attendance and bed-shortage alerts sorted by severity." },
      { property: "og:title", content: "Alerts Center — SwasthyaGrid" },
      { property: "og:description", content: "Stock-out, near-expiry, attendance and bed-shortage alerts." },
    ],
  }),
  component: Alerts,
});

const cache = new Map<string, string>();
const ICON = { stockout: PackageX, expiry: CalendarClock, attendance: Users, beds: BedDouble };
const FALLBACK = { stockout: "Request transfer from nearest surplus PHC and raise indent today.", expiry: "Use this batch first (FEFO) or transfer to a high-demand PHC.", attendance: "Contact MO in-charge to arrange relief staff for today.", beds: "Prepare referral to nearest CHC and discharge stable patients." };

function AlertRow({ a }: { a: Alert }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const ck = `${a.id}|${lang}`;
  const [s, setS] = useState<{ loading?: boolean; text?: string; fail?: boolean }>({ text: cache.get(ck) });
  const Icon = ICON[a.kind];
  const get = async () => {
    setS({ loading: true });
    try { const r = await ai<{ action: string }>("action", { lang, alert: a.text, kind: a.kind }); cache.set(ck, r.action); setS({ text: r.action }); }
    catch { setS({ text: FALLBACK[a.kind], fail: true }); }
  };
  const sev = a.severity >= 80 ? "border-l-risk-red" : a.severity >= 60 ? "border-l-risk-amber" : "border-l-teal";
  return (
    <div className={`rounded-md border border-l-4 border-border ${sev} bg-card p-3`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <Link to="/phc/$id" params={{ id: a.phcId }} className="flex-1 text-sm hover:underline">{a.text}</Link>
        {!s.text && !s.loading && <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={get}><Sparkles className="h-3.5 w-3.5" />{t("suggest")}</Btn>}
      </div>
      {s.loading && <Skeleton className="mt-2 h-4 w-3/4" />}
      {s.text && <p className="mt-1.5 pl-6 text-xs text-accent-foreground">→ {s.text}{s.fail && <span className="text-muted-foreground"> ({t("aiFail")})</span>}</p>}
    </div>
  );
}

function Alerts() {
  const t = useT();
  const role = useStore((s) => s.role);
  const cells = useAnalysis();
  const phcs = usePhcs();
  const alerts = useMemo(() => buildAlerts(cells, phcs.filter((p) => inScope(role, p))), [cells, phcs, role]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("alerts")} ({alerts.length})</h1>
      <Panel><div className="space-y-2">{alerts.map((a) => <AlertRow key={a.id} a={a} />)}{!alerts.length && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}</div></Panel>
    </div>
  );
}
