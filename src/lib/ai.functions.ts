import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  mode: z.enum(["briefing", "rationale", "action", "extract", "parse"]),
  payload: z.record(z.unknown()),
});

const SYS = "You assist Indian Primary Health Centre officials. Be concise, practical, and factual. Respond ONLY with JSON.";
function prompt(mode: z.infer<typeof Input>["mode"], p: Record<string, unknown>) {
  const lang = p.lang === "hi" ? "Hindi" : "English";
  const data = JSON.stringify({ ...p, image: undefined });
  switch (mode) {
    case "briefing":
      return `Write a short early-warning briefing in ${lang} (under 150 words) on which PHCs will stock out, when, and what to do. JSON: {"title":string,"summary":string,"actions":string[]}. Data: ${data}`;
    case "rationale":
      return `Explain in plain ${lang} why this stock transfer makes sense, then draft a short formal transfer-order message in ${lang}. JSON: {"rationale":string,"order":string}. Transfer: ${data}`;
    case "action":
      return `Give ONE practical next action (max 20 words, ${lang}) for this PHC alert. JSON: {"action":string}. Alert: ${data}`;
    case "extract":
      return `Read this medicine package/label photo. JSON: {"medicine":string,"strength":string,"batch":string,"expiry":"YYYY-MM-DD","quantity":number}. Use "" or 0 if unreadable.`;
    case "parse":
      return `Parse this spoken stock update (may be Hindi/Marathi/English mix). JSON: {"medicine":string,"strength":string,"quantity":number,"unit":string,"type":"received"|"issued"}. Known medicines: ${JSON.stringify(p.medicines)}. Transcript: ${JSON.stringify(p.transcript)}`;
  }
}

export const callAi = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; result: string; error: string }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { ok: false, result: "", error: "AI is not configured yet." };
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const parts: unknown[] = [{ text: prompt(data.mode, data.payload) }];
    if (data.mode === "extract" && typeof data.payload.image === "string")
      parts.push({ inline_data: { mime_type: "image/jpeg", data: data.payload.image } });
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    });
    let lastErr = "AI service is busy. Please try again.";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body,
        });
        if (res.ok) {
          const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
          const text = j.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
          const clean = text.replace(/^```(json)?|```$/g, "").trim();
          JSON.parse(clean);
          return { ok: true, result: clean, error: "" };
        }
        console.error("Gemini error", res.status, await res.text());
        lastErr = res.status === 429 ? "AI rate limit reached. Try again shortly." : res.status >= 500 ? lastErr : "AI request was rejected.";
        if (res.status !== 429 && res.status < 500) break;
      } catch (e) {
        console.error(e);
        lastErr = "Could not reach the AI service.";
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
    return { ok: false, result: "", error: lastErr };
  });
