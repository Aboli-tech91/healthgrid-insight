import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, Truck, Bell, ClipboardPlus, Network, BookOpen, Activity, WifiOff } from "lucide-react";
import { actions, useStore, type Role } from "@/lib/store";
import { LANGS, useT, type Lang, type TKey } from "@/lib/i18n";
import { flush, onPending, pendingCount } from "@/lib/queue";
import { hydrateStore } from "@/lib/store";

const NAV: { to: string; k: TKey; icon: typeof Bell }[] = [
  { to: "/", k: "dashboard", icon: LayoutDashboard },
  { to: "/redistribution", k: "redistribution", icon: Truck },
  { to: "/alerts", k: "alerts", icon: Bell },
  { to: "/entry", k: "entry", icon: ClipboardPlus },
  { to: "/federated", k: "federated", icon: Network },
  { to: "/methods", k: "methods", icon: BookOpen },
];
const ROLES: Role[] = ["phc", "district", "state", "national"];

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const role = useStore((s) => s.role);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    hydrateStore();
    const up = () => { setOnline(navigator.onLine); if (navigator.onLine) flush().catch(() => {}); };
    up(); pendingCount().then(setPending).catch(() => {});
    const off = onPending(setPending);
    window.addEventListener("online", up); window.addEventListener("offline", up);
    return () => { off(); window.removeEventListener("online", up); window.removeEventListener("offline", up); };
  }, []);
  const active = (to: string) => (to === "/" ? path === "/" || path.startsWith("/phc") : path.startsWith(to));

  return (
    <div className="min-h-screen bg-background md:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-semibold text-sidebar-accent-foreground">
          <Activity className="h-6 w-6 text-sidebar-primary" /> SwasthyaGrid
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active(n.to) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}>
              <n.icon className="h-4 w-4" /> {t(n.k)}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-5 py-4 text-xs opacity-70">{t("decide")}</p>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <span className="flex items-center gap-1.5 font-semibold text-primary md:hidden"><Activity className="h-5 w-5 text-teal" />SwasthyaGrid</span>
          <span className="rounded-full border border-risk-amber/40 bg-risk-amber/15 px-2.5 py-0.5 text-xs font-medium text-foreground">{t("demo")}</span>
          {!online && <span className="flex items-center gap-1 text-xs text-risk-red"><WifiOff className="h-3.5 w-3.5" />{t("offline")}</span>}
          {pending > 0 && <span className="text-xs text-muted-foreground">{pending} {t("pending")}</span>}
          <div className="ml-auto flex items-center gap-2">
            <select aria-label={t("role")} value={role} onChange={(e) => actions.setRole(e.target.value as Role)} className="h-8 rounded-md border border-input bg-card px-2 text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{t(`r_${r}` as TKey)}</option>)}
            </select>
            <div className="flex overflow-hidden rounded-md border border-input">
              {(Object.keys(LANGS) as Lang[]).map((l) => (
                <button key={l} onClick={() => actions.setLang(l)} className={`px-2.5 py-1 text-xs ${lang === l ? "bg-primary text-primary-foreground" : "bg-card"}`}>{LANGS[l]}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-4 md:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-border bg-card md:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${active(n.to) ? "text-teal" : "text-muted-foreground"}`}>
            <n.icon className="h-5 w-5" /> {t(n.k)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
