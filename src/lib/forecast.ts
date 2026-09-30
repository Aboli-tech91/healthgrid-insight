// Holt-Winters additive exponential smoothing, period 7.
export type HWParams = { alpha: number; beta: number; gamma: number };
export const DEFAULT_PARAMS: HWParams = { alpha: 0.3, beta: 0.05, gamma: 0.25 };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

export function holtWinters(y: number[], p: HWParams = DEFAULT_PARAMS, h = 14, m = 7) {
  let L = mean(y.slice(0, m));
  let T = (mean(y.slice(m, 2 * m)) - L) / m;
  const S = y.slice(0, m).map((v) => v - L);
  const resid: number[] = [];
  for (let t = 0; t < y.length; t++) {
    const s = S[t % m];
    if (t >= m) resid.push(y[t] - (L + T + s));
    const Ln = p.alpha * (y[t] - s) + (1 - p.alpha) * (L + T);
    T = p.beta * (Ln - L) + (1 - p.beta) * T;
    S[t % m] = p.gamma * (y[t] - Ln) + (1 - p.gamma) * s;
    L = Ln;
  }
  const sd = Math.sqrt(mean(resid.map((e) => e * e)));
  const forecast: number[] = [], lower: number[] = [], upper: number[] = [];
  for (let k = 1; k <= h; k++) {
    const f = Math.max(0, L + k * T + S[(y.length + k - 1) % m]);
    const w = 1.96 * sd * Math.sqrt(1 + (k - 1) * p.alpha * p.alpha);
    forecast.push(f); lower.push(Math.max(0, f - w)); upper.push(f + w);
  }
  return { forecast, lower, upper };
}

export function mape(y: number[], p: HWParams = DEFAULT_PARAMS, hold = 14) {
  const train = y.slice(0, -hold), act = y.slice(-hold);
  const f = holtWinters(train, p, hold).forecast;
  return (mean(act.map((a, i) => Math.abs(a - f[i]) / Math.max(a, 1))) * 100);
}

export type Risk = "red" | "amber" | "green";
export const riskOf = (days: number): Risk => (days < 7 ? "red" : days <= 14 ? "amber" : "green");

// Grid search on training data only (inner holdout), so the final 14-day holdout stays unseen.
export function fitParams(series: number[][]): HWParams {
  let best = DEFAULT_PARAMS, bestErr = Infinity;
  for (const alpha of [0.1, 0.3, 0.5])
    for (const beta of [0.01, 0.05, 0.15])
      for (const gamma of [0.05, 0.2, 0.4]) {
        const p = { alpha, beta, gamma };
        const e = mean(series.map((s) => mape(s.slice(0, -14), p)));
        if (e < bestErr) { bestErr = e; best = p; }
      }
  return best;
}
