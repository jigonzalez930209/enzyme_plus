// WASM wrapper for Rust simulation
// Builds expect files at src/wasm/enzyme_sim.js and src/wasm/enzyme_sim_bg.wasm

import type { SimulationParams, SimulationState } from './precise-simulation';

type WasmInitFn = (wasmUrl?: URL | string | Request | BufferSource) => Promise<unknown>;
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
            await init(new URL('../wasm/enzyme_sim_bg.wasm', import.meta.url));
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
