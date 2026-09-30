# HealthGrid Navigator

Build "SwasthyaGrid": a mobile-friendly web app for Indian Primary Health Centre (PHC) health officials (not patients). Style: navy, teal, white, clean government-tech look. English/Hindi toggle using a simple i18n dictionary (structure it so Marathi can be added later). Show a persistent "Synthetic demo data" badge in the header. Add loading skeletons, error states for every async call, and a responsive layout with sidebar on desktop and bottom-nav on mobile.

KEEP IT SIMPLE AND CREDIT-EFFICIENT: no database and no auth for now. Do all analytics in client-side TypeScript. Use exactly ONE backend edge function (described below). Use a simple role switcher in the header (PHC Staff, District Officer, State Officer, National View) that only changes which data is shown; no real auth.

DATA (src/lib/seed.ts, deterministic seeded PRNG, generated in the browser, cached in memory):
- 3 states (Maharashtra, Uttar Pradesh, Tamil Nadu), 4 districts each, ~36 PHCs with realistic names and accurate lat/long, beds_total, beds_available, staff_total, staff_present_today.
- 12 medicines: Paracetamol, ORS, Amoxicillin, Metformin, Amlodipine, Iron-Folic Acid, Zinc, Cotrimoxazole, Albendazole, Salbutamol, Oxytocin, Anti-snake venom.
- Current stock per PHC per medicine (some deliberately in surplus >45 days, some in deficit <7 days, a few with near-expiry batches).
- 90 days of daily consumption per PHC per medicine with weekly pattern, monsoon seasonality, random noise, plus a dengue-like spike in one district (Paracetamol, ORS, Zinc).

FORECASTING (src/lib/forecast.ts): Holt-Winters additive exponential smoothing, weekly seasonality (period 7), 14-day forecast with confidence band, MAPE on a 14-day holdout. days_to_stockout = stock / mean forecast daily demand. Risk: red <7 days, amber 7-14, green >14.

PAGES (routes):
1. Dashboard: Leaflet + OpenStreetMap map, PHC markers colored green/amber/red by risk. KPI cards: PHCs tracked, medicines at risk, beds available %, staff attendance %. Filters: state, district, medicine. Include an "Outbreak Scenario" panel: choose district, medicines, and a 2x-4x multiplier slider; when "Simulate outbreak" is on, multiply forecast demand and recompute the map and KPIs live. A "Generate briefing" button calls the AI function (mode "briefing") to write a short early-warning briefing: which PHCs will stock out, when, and what to do.
2. PHC Detail (/phc/:id): medicine table (stock, days remaining, risk badge), beds gauge, attendance, Recharts 14-day forecast chart with confidence band for a selected medicine, and MAPE.
3. Redistribution: client-side greedy, cost-minimizing allocation matching PHCs with surplus (>45 days stock) to PHCs in deficit (<7 days) using haversine distance, across districts. Cards like "Move 2,000 ORS sachets from PHC A (District X) to PHC B (District Y), 38 km, arrives before stock-out." Buttons: "Explain + Draft order" (AI mode "rationale": plain-language rationale plus a transfer-order message in Hindi or English) and "Approve" (saves to a transfers list in localStorage, updates stock in app state, adds an audit log entry). Include an Audit Log tab showing every stock change and transfer.
4. Alerts Center: active alerts (stock-out, near-expiry <90 days, low attendance <70%, bed shortage <10% free) sorted by severity. Each has a one-line action suggestion from the AI function (mode "action"), fetched on demand and cached.
5. Stock Entry (mobile-first, offline-tolerant): tabs for Photo, Voice, Manual, Attendance/Beds.
   - Photo: upload/capture an image (compress it client-side first for low bandwidth), send to AI mode "extract" (Gemini vision) returning medicine, strength, batch, expiry, quantity. Show a confirmation screen before saving. Flag expired or near-expiry stock.
   - Voice: Web Speech API (en-IN, hi-IN, mr-IN). Transcript goes to AI mode "parse" (e.g. "Paracetamol 500 ke 300 strips aaye") returning structured stock-update JSON. Staff confirm before saving.
   - Manual entry fallback and a daily attendance and bed-count form.
   - Queue saves in IndexedDB when offline and sync when online. Log every change in the audit log.
6. Federated Learning: simulate 3 state nodes. Each fits its own seasonal/trend parameters locally; only parameters (not raw data) go to a central aggregator that averages them FedAvg-style, weighted by data volume. Show a flow diagram and a table comparing local-only vs federated MAPE per state. Label clearly: "Simulation of federated architecture."
7. Data & Methods: sources (synthetic data modeled on public health patterns; note where data.gov.in and WHO datasets would plug in), architecture diagram, scalability notes (BigQuery/Vertex AI for production), and the line "AI recommends; officials decide."

BACKEND: Connect Lovable Cloud. Create ONE edge function "ai" that calls Gemini using the secret GEMINI_API_KEY and the env var GEMINI_MODEL (default gemini-2.5-flash). Never expose the key in the frontend. It accepts {mode, payload}, with modes: briefing, rationale, action, extract (vision), parse. Return clean JSON, friendly errors, and one retry. The app must still work (with a fallback message) if the AI call fails.

Build in this order: data + dashboard, forecasting + PHC detail, outbreak + redistribution, AI function, stock entry + alerts + federated + methods. Keep code compact and don't add features beyond this list.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://healthgrid-insight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1d337cdb-4d56-42fc-a057-4e878e898bfe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
