import {
  wasmSimulateStepsSeries,
  paramsToNumbers,
  toNumericState,
  type NumericState,
} from "./wasm-sim";
import type { SimulationParams, SimulationState } from "./precise-simulation";

export type Species = "S" | "P" | "E" | "ES" | "EP";

function pickSpecies(state: NumericState, species: Species): number {
  switch (species) {
    case "S":
      return state.S;
    case "P":
      return state.P;
    case "E":
      return state.E;
    case "ES":
      return state.ES;
    case "EP":
      return state.EP;
  }
}

export async function simulateAtTimes(
  initState: SimulationState,
  params: SimulationParams,
  species: Species,
  t: number[]
): Promise<number[] | null> {
  if (!t.length) return [];
  const numericInit = toNumericState(initState);
  const pn = paramsToNumbers(params);
  const maxT = Math.max(...t);
  const dt = pn.dt > 0 ? pn.dt : 1;
  const steps = Math.max(0, Math.ceil(maxT / dt));

  const series = await wasmSimulateStepsSeries(numericInit, pn, steps);
  if (!series) return null;

  // Build arrays of time and selected species values
  const times = series.map((s) => s.TIEMPO);
  const values = series.map((s) => pickSpecies(s, species));

  // For each requested t, find bracket and linearly interpolate
  const out: number[] = [];
  for (const tt of t) {
    if (tt <= times[0]) {
      out.push(values[0]);
      continue;
    }
    if (tt >= times[times.length - 1]) {
      out.push(values[values.length - 1]);
      continue;
    }
    // binary search
    let lo = 0,
      hi = times.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (times[mid] <= tt) lo = mid;
      else hi = mid;
    }
    const t0 = times[lo],
      t1 = times[hi];
    const y0 = values[lo],
      y1 = values[hi];
    const w = t1 > t0 ? (tt - t0) / (t1 - t0) : 0;
    out.push(y0 + w * (y1 - y0));
  }
  return out;
}

export function computeMetrics(
  yObs: number[],
  yPred: number[]
): { sse: number; rmse: number; r2: number; sst: number } {
  const n = Math.min(yObs.length, yPred.length);
  if (n === 0) return { sse: 0, rmse: 0, r2: 0, sst: 0 };
  let sse = 0;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += yObs[i];
  mean /= n;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const e = yObs[i] - yPred[i];
    sse += e * e;
    const d = yObs[i] - mean;
    sst += d * d;
  }
  const rmse = Math.sqrt(sse / n);
  const r2 = sst > 0 ? 1 - sse / sst : 0;
  return { sse, rmse, r2, sst };
}
