import Decimal from 'decimal.js';

// --- Random helpers (mirror WASM behavior) ---
function randF64(): number {
  return Math.random();
}

// Standard normal via Box-Muller
function randStdNormal(): number {
  let u1 = randF64();
  let u2 = randF64();
  if (u1 <= 1e-12) u1 = 1e-12;
  if (u2 <= 1e-12) u2 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Poisson sampler (Knuth) for small lambda
function samplePoisson(lambda: number): number {
  if (lambda <= 0) return 0;
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1.0;
  do {
    k += 1;
    p *= randF64();
  } while (p > l);
  return k - 1;
}

// Binomial sampler with approximations matching WASM strategy
function sampleBinomial(n: number, p: number): number {
  const nn = Math.max(0, Math.floor(n));
  let pp = Math.max(0, Math.min(1, p));
  if (nn <= 0 || pp <= 0) return 0;
  if (pp >= 1) return nn;

  // Use symmetry to keep p <= 0.5
  const mutate = pp > 0.5;
  if (mutate) pp = 1 - pp;

  const mean = nn * pp;
  const variance = mean * (1 - pp);

  let k: number;
  if (nn < 50) {
    // Direct Bernoulli sum for small n
    let c = 0;
    for (let i = 0; i < nn; i++) if (randF64() < pp) c += 1;
    k = c;
  } else if (mean < 30) {
    // Poisson approximation
    k = samplePoisson(mean);
    if (k > nn) k = nn;
  } else {
    // Normal approximation
    const z = randStdNormal();
    k = Math.round(mean + z * Math.sqrt(variance));
    if (k < 0) k = 0;
    if (k > nn) k = nn;
  }

  return mutate ? nn - k : k;
}


/**
 * State of the simulation using high‑precision numbers.
 */
export interface SimulationState {
  /** Number of free E molecules */
  EL: Decimal;
  /** Number of ES complexes */
  ES: Decimal;
  /** Number of EP complexes */
  EP: Decimal;
  /** Number of free S molecules */
  S: Decimal;
  /** Number of free P molecules */
  P: Decimal;
  /** Simulation time step */
  TIEMPO: Decimal;
}

/**
 * Parameters that remain constant during a single time step.
 */
export interface SimulationParams {
  /** Number of E molecules to process this step */
  NEL: number;
  /** Number of ES complexes to process this step */
  NES: number;
  /** Number of EP complexes to process this step */
  NEP: number;
  /** Fixed number of free S molecules (used for probability calculations) */
  NS: number;
  /** Fixed number of free P molecules (used for probability calculations) */
  NP: number;
  /** Rate constant for E + S → ES (k1) */
  k1: Decimal;
  /** Rate constant for E + P → EP (k‑3) */
  kMinus3: Decimal;
  /** Rate constant for ES → E + S (k‑1) */
  kMinus1: Decimal;
  /** Rate constant for ES → EP (k2) */
  k2: Decimal;
  /** Rate constant for EP → ES (k‑2) */
  kMinus2: Decimal;
  /** Rate constant for EP → E + P (k3) */
  k3: Decimal;
  /** Time step size in seconds */
  dt?: Decimal;
}

/**
 * Perform a single simulation tick.
 *
 * The algorithm mirrors the Visual‑Basic code supplied by the user, but all arithmetic
 * is performed with `Decimal` (from decimal.js) for arbitrary‑precision floating point
 * and `Big` (from big.js) is kept as an example of a second high‑precision library.
 *
 * @param state  Current simulation state (will be cloned, original is not mutated)
 * @param params Constant parameters for the tick
 * @returns New simulation state after one tick
 */
export function simulateTick(
  state: SimulationState,
  params: SimulationParams
): SimulationState {
  // Clone the incoming state so we never mutate the caller's object.
  let { EL, ES, EP, S, P, TIEMPO } = {
    EL: new Decimal(state.EL),
    ES: new Decimal(state.ES),
    EP: new Decimal(state.EP),
    S: new Decimal(state.S),
    P: new Decimal(state.P),
    TIEMPO: new Decimal(state.TIEMPO),
  };
  
  // Time step (seconds). Default to 1 if not provided
  const DT = params.dt ?? new Decimal(1);

  // Ensure all initial values are non-negative
  EL = Decimal.max(EL, new Decimal(0));
  ES = Decimal.max(ES, new Decimal(0));
  EP = Decimal.max(EP, new Decimal(0));
  S = Decimal.max(S, new Decimal(0));
  P = Decimal.max(P, new Decimal(0));
  
  // Preserve the snapshot counts – they must be used for this dt (mirror WASM ordering)
  const NEL = params.NEL;
  const NES = params.NES;
  const NEP = params.NEP;
  
  // ---------- Process free E molecules (aggregated, with resource capping and overflow reassignment) ----------
  {
    // Use snapshot NEL, not current EL after any updates
    const nel = Math.max(0, Math.round(NEL));
    const lambda1 = Math.max(0, params.k1.toNumber() * Math.max(0, S.toNumber()));
    const lambda2 = Math.max(0, params.kMinus3.toNumber() * Math.max(0, P.toNumber()));
    const lambdaSum = lambda1 + lambda2;
    const dtNum = DT.isFinite() && DT.greaterThan(0) ? DT.toNumber() : 1;
    const pTot = lambdaSum > 0 ? 1 - Math.exp(-lambdaSum * dtNum) : 0;
    const nReact = sampleBinomial(nel, pTot);
    const frac1 = lambdaSum > 0 ? Math.max(0, Math.min(1, lambda1 / lambdaSum)) : 0;
    const nEsRaw = sampleBinomial(nReact, frac1);
    const nEpRaw = nReact - nEsRaw;

    // Cap by available S/P and reassign overflow symmetrically (like WASM)
    const sAvail = Math.max(0, Math.floor(S.toNumber()));
    const pAvail = Math.max(0, Math.floor(P.toNumber()));
    let nEs = Math.min(nEsRaw, sAvail);
    let nEp = Math.min(nEpRaw, pAvail);
    const sLeft = sAvail - nEs;
    const pLeft = pAvail - nEp;
    const overflowEs = nEsRaw - nEs; // ES wanted but no S
    const overflowEp = nEpRaw - nEp; // EP wanted but no P
    if (overflowEs > 0 && pLeft > 0) {
      const add = Math.min(overflowEs, pLeft);
      nEp += add;
    }
    if (overflowEp > 0 && sLeft > 0) {
      const add = Math.min(overflowEp, sLeft);
      nEs += add;
    }

    // Apply updates
    EL = EL.minus(nEs + nEp);
    ES = ES.plus(nEs);
    EP = EP.plus(nEp);
    S = S.minus(nEs);
    P = P.minus(nEp);
  }

  // ---------- Process ES complexes (aggregated competing-risks) ----------
  {
    // Use snapshot NES, not current ES after E-updates
    const nes = Math.max(0, Math.round(NES));
    const lambdaBack = Math.max(0, params.kMinus1.toNumber());
    const lambdaFwd = Math.max(0, params.k2.toNumber());
    const lambdaSum = lambdaBack + lambdaFwd;
    const dtNum = DT.isFinite() && DT.greaterThan(0) ? DT.toNumber() : 1;
    const pTot = lambdaSum > 0 ? 1 - Math.exp(-lambdaSum * dtNum) : 0;
    const nReact = sampleBinomial(nes, pTot);
    const fracBack = lambdaSum > 0 ? Math.max(0, Math.min(1, lambdaBack / lambdaSum)) : 0;
    const toEL = sampleBinomial(nReact, fracBack);
    const toEP = nReact - toEL;

    EL = EL.plus(toEL);
    ES = ES.minus(toEL + toEP);
    S = S.plus(toEL);
    EP = EP.plus(toEP);
  }

  // ---------- Process EP complexes (aggregated competing-risks) ----------
  {
    // Use snapshot NEP, not current EP after E/ES updates
    const nep = Math.max(0, Math.round(NEP));
    const lambdaBack = Math.max(0, params.kMinus2.toNumber());
    const lambdaFwd = Math.max(0, params.k3.toNumber());
    const lambdaSum = lambdaBack + lambdaFwd;
    const dtNum = DT.isFinite() && DT.greaterThan(0) ? DT.toNumber() : 1;
    const pTot = lambdaSum > 0 ? 1 - Math.exp(-lambdaSum * dtNum) : 0;
    const nReact = sampleBinomial(nep, pTot);
    const fracBack = lambdaSum > 0 ? Math.max(0, Math.min(1, lambdaBack / lambdaSum)) : 0;
    const toES = sampleBinomial(nReact, fracBack);
    const toE = nReact - toES;

    ES = ES.plus(toES);
    EP = EP.minus(toES + toE);
    EL = EL.plus(toE);
    P = P.plus(toE);
  }

  // Final safety check: ensure no negative values
  EL = Decimal.max(EL, new Decimal(0));
  ES = Decimal.max(ES, new Decimal(0));
  EP = Decimal.max(EP, new Decimal(0));
  S = Decimal.max(S, new Decimal(0));
  P = Decimal.max(P, new Decimal(0));

  // Increment time by dt
  TIEMPO = TIEMPO.plus(DT);

  // Return a fresh immutable state object.
  return {
    EL,
    ES,
    EP,
    S,
    P,
    TIEMPO,
  };
}

/**
 * Helper to create a plain‑object state from numbers – useful for tests or UI code.
 */
export function createStateFromNumbers(values: {
  EL: number;
  ES: number;
  EP: number;
  S: number;
  P: number;
  TIEMPO?: number;
}): SimulationState {
  return {
    EL: new Decimal(values.EL),
    ES: new Decimal(values.ES),
    EP: new Decimal(values.EP),
    S: new Decimal(values.S),
    P: new Decimal(values.P),
    TIEMPO: new Decimal(values.TIEMPO ?? 0),
  };
}

/**
 * Example usage (remove or adapt for your own code base):
 *
 * const init = createStateFromNumbers({ EL: 100, ES: 0, EP: 0, S: 50, P: 30 });
 * const params: SimulationParams = {
 *   NEL: 100,
 *   NES: 0,
 *   NEP: 0,
 *   NS: 50,
 *   NP: 30,
 *   k1: new Decimal('0.001'),
 *   kMinus3: new Decimal('0.0005'),
 *   kMinus1: new Decimal('0.002'),
 *   k2: new Decimal('0.001'),
 *   kMinus2: new Decimal('0.0015'),
 *   k3: new Decimal('0.0008'),
 * };
 * const next = simulateTick(init, params);
 */
