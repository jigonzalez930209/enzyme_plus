// WASM wrapper for Rust simulation
// Builds expect files at src/wasm/enzyme_sim.js and src/wasm/enzyme_sim_bg.wasm

import type { SimulationParams, SimulationState } from './precise-simulation';

// Newer wasm-bindgen glue prefers an options object: { module_or_path: URL | Request | ... }
type WasmInitFn = (options?: { module_or_path?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module }) => Promise<unknown>;
interface WasmModuleShape {
  default?: WasmInitFn;
  init?: WasmInitFn;
  simulate_steps_final?: (
    e: number,
    es: number,
    ep: number,
    s: number,
    p: number,
    tiempo: number,
    ns: number,
    np: number,
    k1: number,
    k_minus3: number,
    k_minus1: number,
    k2: number,
    k_minus2: number,
    k3: number,
    dt: number,
    steps: number
  ) => Float64Array;
  simulate_steps_series?: (
    e: number,
    es: number,
    ep: number,
    s: number,
    p: number,
    tiempo: number,
    ns: number,
    np: number,
    k1: number,
    k_minus3: number,
    k_minus1: number,
    k2: number,
    k_minus2: number,
    k3: number,
    dt: number,
    steps: number
  ) => Float64Array;
  objective_sse?: (
    e: number,
    es: number,
    ep: number,
    s: number,
    p: number,
    tiempo: number,
    ns: number,
    np: number,
    k1: number,
    k_minus3: number,
    k_minus1: number,
    k2: number,
    k_minus2: number,
    k3: number,
    dt: number,
    times: Float64Array,
    y_obs: Float64Array,
    species_code: number
  ) => number;
  fit_nelder_mead?: (
    e: number,
    es: number,
    ep: number,
    s: number,
    p: number,
    tiempo: number,
    ns: number,
    np: number,
    params_in: Float64Array, // [k1,k-3,k-1,k2,k-2,k3,dt]
    mask: Uint8Array, // 1 => optimize
    times: Float64Array,
    y_obs: Float64Array,
    species_code: number,
    max_iter: number,
    tol: number,
    scale: number
  ) => Float64Array;
}

let wasmMod: WasmModuleShape | null = null;
let wasmReady: Promise<boolean> | null = null;

export async function initWasm(): Promise<boolean> {
  if (wasmMod) return true;
  if (!wasmReady) {
    wasmReady = (async () => {
      try {
        // Dynamic import to let Vite bundle and resolve the wasm asset
        // Note: paths are relative to this file compiled location
        // enzyme_sim.js default export is an init function
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - we provide a .d.ts for this import
        const mod: WasmModuleShape = await import('../wasm/enzyme_sim.js');
        const init = (mod.default ?? mod.init) as WasmInitFn | undefined;
        if (init) {
          try {
            await init({ module_or_path: new URL('../wasm/enzyme_sim_bg.wasm', import.meta.url) });
          } catch (e) {
            // If init fails (e.g., stub throws), treat as not ready
            wasmMod = null;
            return false;
          }
        }
        // Verify required exports exist
        if (
          typeof mod.simulate_steps_final === 'function' &&
          typeof mod.simulate_steps_series === 'function'
        ) {
          wasmMod = mod;
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.info('WASM module loaded');
          }
          return true;
        }
        wasmMod = null;
        return false;
      } catch (e) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('WASM init failed, falling back to TS:', e);
        }
        wasmMod = null;
        return false;
      }
    })();
  }
  return wasmReady;
}

export function isWasmReady(): boolean {
  return (
    !!wasmMod &&
    typeof wasmMod.simulate_steps_final === 'function' &&
    typeof wasmMod.simulate_steps_series === 'function'
  );
}

export type NumericState = {
  E: number;
  ES: number;
  EP: number;
  S: number;
  P: number;
  TIEMPO: number;
};

export function toNumericState(state: SimulationState): NumericState {
  return {
    E: state.EL.toNumber(),
    ES: state.ES.toNumber(),
    EP: state.EP.toNumber(),
    S: state.S.toNumber(),
    P: state.P.toNumber(),
    TIEMPO: state.TIEMPO.toNumber(),
  };
}

export function paramsToNumbers(p: SimulationParams) {
  return {
    // NS and NP are accepted for compatibility but not used in the current algorithm
    NS: p.NS,
    NP: p.NP,
    k1: p.k1.toNumber(),
    kMinus3: p.kMinus3.toNumber(),
    kMinus1: p.kMinus1.toNumber(),
    k2: p.k2.toNumber(),
    kMinus2: p.kMinus2.toNumber(),
    k3: p.k3.toNumber(),
    dt: p.dt ? p.dt.toNumber() : 1,
  };
}

// Run N steps and return only the final state
export async function wasmSimulateStepsFinal(
  current: NumericState,
  params: ReturnType<typeof paramsToNumbers>,
  steps: number
): Promise<NumericState | null> {
  const ok = await initWasm();
  if (!ok || !wasmMod || typeof wasmMod.simulate_steps_final !== 'function') return null;

  const arr = wasmMod.simulate_steps_final!(
    current.E,
    current.ES,
    current.EP,
    current.S,
    current.P,
    current.TIEMPO,
    params.NS,
    params.NP,
    params.k1,
    params.kMinus3,
    params.kMinus1,
    params.k2,
    params.kMinus2,
    params.k3,
    params.dt,
    Math.max(0, Math.floor(steps))
  ) as Float64Array;

  return {
    E: arr[0],
    ES: arr[1],
    EP: arr[2],
    S: arr[3],
    P: arr[4],
    TIEMPO: arr[5],
  };
}

// Run N steps and return the time series (flattened or parsed)
export async function wasmSimulateStepsSeries(
  current: NumericState,
  params: ReturnType<typeof paramsToNumbers>,
  steps: number
): Promise<NumericState[] | null> {
  const ok = await initWasm();
  if (!ok || !wasmMod || typeof wasmMod.simulate_steps_series !== 'function') return null;

  const flat = wasmMod.simulate_steps_series!(
    current.E,
    current.ES,
    current.EP,
    current.S,
    current.P,
    current.TIEMPO,
    params.NS,
    params.NP,
    params.k1,
    params.kMinus3,
    params.kMinus1,
    params.k2,
    params.kMinus2,
    params.k3,
    params.dt,
    Math.max(0, Math.floor(steps))
  ) as Float64Array;

  const out: NumericState[] = [];
  for (let i = 0; i < flat.length; i += 6) {
    out.push({
      E: flat[i + 0],
      ES: flat[i + 1],
      EP: flat[i + 2],
      S: flat[i + 3],
      P: flat[i + 4],
      TIEMPO: flat[i + 5],
    });
  }
  return out;
}

// Compute SSE objective in WASM by simulating and interpolating to arbitrary times
export async function wasmObjectiveSSE(
  current: NumericState,
  params: ReturnType<typeof paramsToNumbers>,
  times: number[],
  yObs: number[],
  species: 'S' | 'P' | 'E' | 'ES' | 'EP'
): Promise<number | null> {
  const ok = await initWasm();
  if (!ok || !wasmMod || typeof wasmMod.objective_sse !== 'function') return null;
  const tArr = new Float64Array(times);
  const yArr = new Float64Array(yObs);
  const code = species === 'S' ? 0 : species === 'P' ? 1 : species === 'E' ? 2 : species === 'ES' ? 3 : 4;
  const v = wasmMod.objective_sse!(
    current.E,
    current.ES,
    current.EP,
    current.S,
    current.P,
    current.TIEMPO,
    params.NS,
    params.NP,
    params.k1,
    params.kMinus3,
    params.kMinus1,
    params.k2,
    params.kMinus2,
    params.k3,
    params.dt,
    tArr,
    yArr,
    code
  ) as number;
  return v;
}

export type WasmFitResult = {
  k1: number;
  kMinus3: number;
  kMinus1: number;
  k2: number;
  kMinus2: number;
  k3: number;
  dt: number;
  sse: number;
};

export async function wasmFitNelderMead(
  current: NumericState,
  params: ReturnType<typeof paramsToNumbers>,
  times: number[],
  yObs: number[],
  species: 'S' | 'P' | 'E' | 'ES' | 'EP',
  mask: [number, number, number, number, number, number, number],
  opts?: { maxIter?: number; tol?: number; scale?: number }
): Promise<WasmFitResult | null> {
  const ok = await initWasm();
  if (!ok || !wasmMod || typeof wasmMod.fit_nelder_mead !== 'function') return null;
  const tArr = new Float64Array(times);
  const yArr = new Float64Array(yObs);
  const code = species === 'S' ? 0 : species === 'P' ? 1 : species === 'E' ? 2 : species === 'ES' ? 3 : 4;
  const paramArr = new Float64Array([
    params.k1,
    params.kMinus3,
    params.kMinus1,
    params.k2,
    params.kMinus2,
    params.k3,
    params.dt,
  ]);
  const maskArr = new Uint8Array(mask);
  const maxIter = opts?.maxIter ?? 200;
  const tol = opts?.tol ?? 1e-6;
  const scale = opts?.scale ?? 0.1;
  const out = wasmMod.fit_nelder_mead!(
    current.E,
    current.ES,
    current.EP,
    current.S,
    current.P,
    current.TIEMPO,
    params.NS,
    params.NP,
    paramArr,
    maskArr,
    tArr,
    yArr,
    code,
    maxIter,
    tol,
    scale
  ) as Float64Array;
  if (!out || out.length < 8) return null;
  return {
    k1: out[0],
    kMinus3: out[1],
    kMinus1: out[2],
    k2: out[3],
    kMinus2: out[4],
    k3: out[5],
    dt: out[6],
    sse: out[7],
  };
}
