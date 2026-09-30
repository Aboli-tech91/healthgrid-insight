import { useState } from "react";
import { callAi } from "./ai.functions";

type Mode = "briefing" | "rationale" | "action" | "extract" | "parse";
export async function ai<T>(mode: Mode, payload: Record<string, unknown>): Promise<T> {
  const r = await callAi({ data: { mode, payload } });
  if (!r.ok) throw new Error(r.error);
  return JSON.parse(r.result) as T;
}
export function useAi<T>() {
  const [s, setS] = useState<{ loading: boolean; data?: T; error?: string }>({ loading: false });
  const run = async (mode: Mode, payload: Record<string, unknown>) => {
    setS({ loading: true });
    try { const data = await ai<T>(mode, payload); setS({ loading: false, data }); return data; }
    catch (e) { setS({ loading: false, error: e instanceof Error ? e.message : "AI failed" }); return undefined; }
  };
  return { ...s, run, reset: () => setS({ loading: false }) };
}
