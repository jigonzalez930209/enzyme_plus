import Decimal from "decimal.js";

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
