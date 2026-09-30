import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { Risk } from "@/lib/forecast";

export function Panel({ title, children, action, className = "" }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-card p-4 shadow-sm ${className}`}>
      {(title || action) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-primary">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}
export function RiskBadge({ risk, label }: { risk: Risk; label?: string }) {
  const c = { red: "bg-risk-red/15 text-risk-red", amber: "bg-risk-amber/20 text-foreground", green: "bg-risk-green/15 text-risk-green" }[risk];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c}`}><span className={`h-1.5 w-1.5 rounded-full ${{ red: "bg-risk-red", amber: "bg-risk-amber", green: "bg-risk-green" }[risk]}`} />{label ?? risk}</span>;
}
export function ErrorBox({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-risk-red/30 bg-risk-red/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-red" />
      <div className="flex-1">{msg}</div>
      {onRetry && <button onClick={onRetry} className="text-xs font-medium underline">Retry</button>}
    </div>
  );
}
export function Btn({ children, variant = "primary", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "teal" | "ghost" }) {
  const v = { primary: "bg-primary text-primary-foreground hover:bg-primary/90", teal: "bg-teal text-teal-foreground hover:bg-teal/90", ghost: "border border-input bg-card hover:bg-muted" }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${v} ${className}`}>{children}</button>;
}
export const selectCls = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";
export const inputCls = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{label}{children}</label>;
}
