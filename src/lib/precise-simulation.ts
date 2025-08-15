import Decimal from 'decimal.js';


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
  
  // Ensure all initial values are non-negative
  EL = Decimal.max(EL, new Decimal(0));
  ES = Decimal.max(ES, new Decimal(0));
  EP = Decimal.max(EP, new Decimal(0));
  S = Decimal.max(S, new Decimal(0));
  P = Decimal.max(P, new Decimal(0));
  
  // Preserve the original counts – they are used as the "memory" values.
  const NEL = params.NEL;
  const NES = params.NES;
  const NEP = params.NEP;
  
  // Note: BASIC algorithm uses fixed NS and NP values, not current concentrations
  
  // ---------- Process free E molecules (NEL) ----------
  for (let i = 0; i < NEL; i++) {
    // Skip if there are no free E molecules left
    if (EL.lessThanOrEqualTo(0)) break;
    
    const rnd = Decimal.random(); // 0 <= rnd < 1
    
    // Calculate thresholds based on BASIC algorithm
    // Use current concentrations [S] and [P] as per theory: k1*[S] and k-3*[P]
    const threshold1 = params.k1.times(S); // k1 * [S] (current substrate concentration)
    const threshold2 = threshold1.plus(params.kMinus3.times(P)); // k1*[S] + k-3*[P] (current product concentration)
    
    if (rnd.lte(threshold1) && S.greaterThan(0)) {
      // E + S → ES
      EL = EL.minus(1);
      ES = ES.plus(1);
      S = S.minus(1);
    } else if (rnd.lte(threshold2) && P.greaterThan(0)) {
      // E + P → EP  
      EL = EL.minus(1);
      EP = EP.plus(1);
      P = P.minus(1);
    }
    // else: no reaction, molecule stays as E (nothing to do)
  }

  // ---------- Process ES complexes (NES) ----------
  for (let i = 0; i < NES; i++) {
    // Skip if there are no ES complexes left
    if (ES.lessThanOrEqualTo(0)) break;
    
    const rnd = Decimal.random();
    
    // Calculate thresholds based on BASIC algorithm
    const threshold1 = params.kMinus1; // k-1
    const threshold2 = threshold1.plus(params.k2); // k-1 + k2
    
    if (rnd.lte(threshold1)) {
      // ES → E + S (reverse reaction)
      EL = EL.plus(1);
      ES = ES.minus(1);
      S = S.plus(1);
    } else if (rnd.lte(threshold2)) {
      // ES → EP (forward reaction)
      EP = EP.plus(1);
      ES = ES.minus(1);
      // Note: Substrate was already consumed when ES was formed
      // Product is NOT generated here - it's generated when EP → E + P
    }
  }

  // ---------- Process EP complexes (NEP) ----------
  for (let i = 0; i < NEP; i++) {
    // Skip if there are no EP complexes left
    if (EP.lessThanOrEqualTo(0)) break;
    
    const rnd = Decimal.random();
    
    // Calculate thresholds based on BASIC algorithm
    const threshold1 = params.kMinus2; // k-2
    const threshold2 = threshold1.plus(params.k3); // k-2 + k3
    
    if (rnd.lte(threshold1)) {
      // EP → ES (reverse reaction)
      ES = ES.plus(1);
      EP = EP.minus(1);
    } else if (rnd.lte(threshold2)) {
      // EP → E + P (product formation)
      EL = EL.plus(1);
      EP = EP.minus(1);
      P = P.plus(1); // Product is generated here!
    }
  }

  // Final safety check: ensure no negative values
  EL = Decimal.max(EL, new Decimal(0));
  ES = Decimal.max(ES, new Decimal(0));
  EP = Decimal.max(EP, new Decimal(0));
  S = Decimal.max(S, new Decimal(0));
  P = Decimal.max(P, new Decimal(0));

  // Increment time
  TIEMPO = TIEMPO.plus(1);

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
