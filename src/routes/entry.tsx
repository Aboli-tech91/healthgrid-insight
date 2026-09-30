import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Camera, Mic, Square, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Panel, Btn, ErrorBox, Field, selectCls, inputCls } from "@/components/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { usePhcs, inScope, DEFAULT_PHC } from "@/lib/analysis";
import { MEDS, TODAY } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useAi } from "@/lib/useAi";
import { saveChange } from "@/lib/queue";

export const Route = createFileRoute("/entry")({
  head: () => ({
    meta: [
      { title: "Stock Entry — SwasthyaGrid" },
      { name: "description", content: "Record stock by photo, voice or manual entry, plus daily attendance and beds. Works offline." },
      { property: "og:title", content: "Stock Entry — SwasthyaGrid" },
      { property: "og:description", content: "Photo, voice and manual stock entry for PHC staff." },
    ],
  }),
  component: Entry,
});

type Draft = { medId: string; qty: number; type: "received" | "issued"; batch?: string; expiry?: string; strength?: string };
const matchMed = (name: string) => MEDS.find((m) => name && (name.toLowerCase().includes(m.name.toLowerCase().split(" ")[0].toLowerCase()) || m.name.toLowerCase().includes(name.toLowerCase())))?.id ?? "";

async function compress(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1024 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = img.width * s; c.height = img.height * s;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7).split(",")[1];
}

function useSave() {
  return async (phcId: string, d: Draft, src: string) => {
    if (!d.medId || !d.qty) { toast.error("Choose a medicine and quantity"); return false; }
    const r = await saveChange({ type: "stock", phcId, medId: d.medId, delta: d.type === "issued" ? -d.qty : d.qty, note: `${src}: ${d.type}${d.batch ? ` batch ${d.batch}` : ""}${d.expiry ? ` exp ${d.expiry}` : ""}` });
    toast.success(r === "saved" ? "Saved" : "Saved offline — will sync"); return true;
  };
}

function Confirm({ phcId, d, setD, onSave, onCancel }: { phcId: string; d: Draft; setD: (d: Draft) => void; onSave: () => void; onCancel?: () => void }) {
  const t = useT();
  const daysToExp = d.expiry ? (new Date(d.expiry).getTime() - TODAY.getTime()) / 86400000 : null;
  return (
    <div className="space-y-3">
      {daysToExp !== null && !isNaN(daysToExp) && daysToExp < 90 && (
        <div className="flex items-center gap-2 rounded-md bg-risk-red/10 p-2 text-sm text-risk-red"><AlertTriangle className="h-4 w-4" />{daysToExp < 0 ? "EXPIRED stock — do not issue." : `Near expiry: ${Math.round(daysToExp)} days left.`}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("medicine")}><select className={selectCls} value={d.medId} onChange={(e) => setD({ ...d, medId: e.target.value })}><option value="">—</option>{MEDS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Quantity"><input type="number" min={0} className={inputCls} value={d.qty || ""} onChange={(e) => setD({ ...d, qty: +e.target.value })} /></Field>
        <Field label="Type"><select className={selectCls} value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as Draft["type"] })}><option value="received">Received</option><option value="issued">Issued</option></select></Field>
        <Field label="Expiry"><input type="date" className={inputCls} value={d.expiry ?? ""} onChange={(e) => setD({ ...d, expiry: e.target.value })} /></Field>
        <Field label="Batch"><input className={inputCls} value={d.batch ?? ""} onChange={(e) => setD({ ...d, batch: e.target.value })} /></Field>
        <Field label="PHC"><input className={inputCls} value={phcId} disabled /></Field>
      </div>
      <div className="flex gap-2"><Btn onClick={onSave} className="flex-1">{t("confirm")}</Btn>{onCancel && <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>}</div>
    </div>
  );
}

const empty: Draft = { medId: "", qty: 0, type: "received" };

function PhotoTab({ phcId }: { phcId: string }) {
  const x = useAi<{ medicine: string; strength: string; batch: string; expiry: string; quantity: number }>();
  const [d, setD] = useState<Draft | null>(null);
  const [img, setImg] = useState<string>("");
  const save = useSave();
  const onFile = async (f?: File) => {
    if (!f) return;
    setD(null);
    try {
      const b64 = await compress(f); setImg(b64);
      const r = await x.run("extract", { image: b64 });
      setD(r ? { medId: matchMed(r.medicine), qty: r.quantity || 0, type: "received", batch: r.batch, expiry: r.expiry, strength: r.strength } : { ...empty });
    } catch { toast.error("Could not read image"); }
  };
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-input p-6 text-sm text-muted-foreground">
        <Camera className="h-8 w-8 text-teal" />Tap to capture or upload a label photo
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {img && <img src={`data:image/jpeg;base64,${img}`} alt="Captured label" className="max-h-48 rounded-md" />}
      {x.loading && <Skeleton className="h-32" />}
      {x.error && <ErrorBox msg={`Could not read label (${x.error}). Enter details below.`} />}
      {d && <Confirm phcId={phcId} d={d} setD={setD} onSave={async () => { if (await save(phcId, d, "photo")) { setD(null); setImg(""); } }} onCancel={() => setD(null)} />}
    </div>
  );
}

type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: (e: { error: string }) => void; onend: () => void };
function VoiceTab({ phcId }: { phcId: string }) {
  const [lang, setLang] = useState("hi-IN");
  const [text, setText] = useState("");
  const [rec, setRec] = useState(false);
  const [err, setErr] = useState("");
  const r = useRef<SR | null>(null);
  const x = useAi<{ medicine: string; strength: string; quantity: number; unit: string; type: "received" | "issued" }>();
  const [d, setD] = useState<Draft | null>(null);
  const save = useSave();
  const start = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!C) { setErr("Voice input isn't supported in this browser. Type the update below."); return; }
    const s = new C(); s.lang = lang; s.interimResults = true; s.continuous = false;
    s.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    s.onerror = (e) => setErr(`Voice error: ${e.error}`); s.onend = () => setRec(false);
    r.current = s; setErr(""); s.start(); setRec(true);
  };
  const parse = async () => {
    const out = await x.run("parse", { transcript: text, medicines: MEDS.map((m) => m.name) });
    setD(out ? { medId: matchMed(out.medicine), qty: out.quantity || 0, type: out.type === "issued" ? "issued" : "received", strength: out.strength } : { ...empty });
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select className={`${selectCls} w-32`} value={lang} onChange={(e) => setLang(e.target.value)}><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option><option value="mr-IN">मराठी</option></select>
        {rec ? <Btn variant="primary" onClick={() => r.current?.stop()}><Square className="h-4 w-4" />Stop</Btn> : <Btn variant="teal" onClick={start}><Mic className="h-4 w-4" />Speak</Btn>}
      </div>
      {err && <ErrorBox msg={err} />}
      <textarea className="min-h-20 w-full rounded-md border border-input bg-card p-2 text-sm" placeholder='e.g. "Paracetamol 500 ke 300 strips aaye"' value={text} onChange={(e) => setText(e.target.value)} />
      <Btn onClick={parse} disabled={!text || x.loading}>Parse</Btn>
      {x.loading && <Skeleton className="h-24" />}
      {x.error && <ErrorBox msg={`Could not parse (${x.error}). Fill in manually below.`} />}
      {d && <Confirm phcId={phcId} d={d} setD={setD} onSave={async () => { if (await save(phcId, d, "voice")) { setD(null); setText(""); } }} onCancel={() => setD(null)} />}
    </div>
  );
}

function ManualTab({ phcId }: { phcId: string }) {
  const [d, setD] = useState<Draft>({ ...empty });
  const save = useSave();
  return <Confirm phcId={phcId} d={d} setD={setD} onSave={async () => { if (await save(phcId, d, "manual")) setD({ ...empty }); }} />;
}

function CountsTab({ phcId }: { phcId: string }) {
  const p = usePhcs().find((x) => x.id === phcId)!;
  const [staff, setStaff] = useState(p.staff_present_today), [beds, setBeds] = useState(p.beds_available);
  const t = useT();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Staff present (of ${p.staff_total})`}><input type="number" min={0} max={p.staff_total} className={inputCls} value={staff} onChange={(e) => setStaff(+e.target.value)} /></Field>
        <Field label={`Beds available (of ${p.beds_total})`}><input type="number" min={0} max={p.beds_total} className={inputCls} value={beds} onChange={(e) => setBeds(+e.target.value)} /></Field>
      </div>
      <Btn className="w-full" onClick={async () => { const r = await saveChange({ type: "counts", phcId, staff: Math.min(staff, p.staff_total), beds: Math.min(beds, p.beds_total), note: "Daily count" }); toast.success(r === "saved" ? "Saved" : "Saved offline — will sync"); }}>{t("save")}</Btn>
    </div>
  );
}

function Entry() {
  const t = useT();
  const role = useStore((s) => s.role);
  const phcs = usePhcs().filter((p) => inScope(role, p));
  const [phcId, setPhcId] = useState(DEFAULT_PHC);
  const [tab, setTab] = useState<"photo" | "voice" | "manual" | "attBeds">("photo");
  const id = phcs.some((p) => p.id === phcId) ? phcId : phcs[0].id;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("entry")}</h1>
      <select className={selectCls} value={id} onChange={(e) => setPhcId(e.target.value)}>{phcs.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.district}</option>)}</select>
      <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1 text-xs">
        {(["photo", "voice", "manual", "attBeds"] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={`rounded px-2 py-2 ${tab === k ? "bg-card font-medium shadow-sm" : ""}`}>{t(k)}</button>)}
      </div>
      <Panel>
        {tab === "photo" && <PhotoTab phcId={id} />}
        {tab === "voice" && <VoiceTab phcId={id} />}
        {tab === "manual" && <ManualTab phcId={id} />}
        {tab === "attBeds" && <CountsTab key={id} phcId={id} />}
      </Panel>
    </div>
  );
}
