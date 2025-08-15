import type { SimulationParams } from "../lib/precise-simulation";
export type { SimulationParams };

export type SimulationStatus = "stopped" | "running" | "paused";

export interface SimulationState {
  params: SimulationParams;
  status: SimulationStatus;
  time: number;
  concentrations: {
    E: number;
    S: number;
    ES: number;
    P: number;
    EP: number; // Added EP
  };
}

export interface SimulationSlice {
  simulation: SimulationState;
  setSimulationParams: (params: Partial<SimulationParams>) => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  stopSimulation: () => void;
  // Internal or advanced actions can be added here
}

// Note: The legacy simulation slice implementation has been removed.
// The single source of truth for the store (including simulation data and actions)
// is defined in `src/state/useAppStore.ts`.
export const LEGACY_SIMULATION_SLICE_REMOVED = true;
