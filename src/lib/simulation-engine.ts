import type { SimulationParams } from "./precise-simulation";
import type { SpeciesConcentrations } from "../state/useAppStore";
import {
  initWasm,
  isWasmReady,
  paramsToNumbers,
  wasmSimulateStepsFinal,
  wasmSimulateStepsSeries,
} from "./wasm-sim";

export interface SimulationStep {
  time: number;
  concentrations: SpeciesConcentrations;
}

// Support both single step and batch updates
export type SimulationCallback = (
  step: SimulationStep | SimulationStep[]
) => void;

export class SimulationEngine {
  private timerId: number | null = null;
  private isRunning = false;
  private speed = 1; // 1x speed by default
  private currentState: SpeciesConcentrations;
  private currentTime = 0;
  private params: SimulationParams;
  private callback: SimulationCallback | null = null;
  private currentBatchSize = 1; // Number of calculations per batch
  private firstTickDone = false; // Ensure the very first update advances exactly 1 dt

  constructor(
    initialConcentrations: SpeciesConcentrations,
    params: SimulationParams,
    callback?: SimulationCallback
  ) {
    this.currentState = { ...initialConcentrations };
    this.params = { ...params };
    this.callback = callback || null;
  }

  // Update simulation parameters
  updateParams(params: Partial<SimulationParams>) {
    this.params = { ...this.params, ...params };
  }

  // Update simulation speed
  setSpeed(speed: number) {
    this.speed = Math.max(0.01, Math.min(10000, speed)); // Clamp to 0.01x - 10,000x range
    // No need to restart - next step will use new speed automatically
  }

  // Set callback for simulation updates
  setCallback(callback: SimulationCallback) {
    this.callback = callback;
  }

  // Start simulation
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.firstTickDone = false;
    // Kick off WASM initialization in the background (non-blocking)
    void initWasm();
    this.scheduleNextStep();
  }

  // Stop simulation
  stop() {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  // Reset simulation to initial state
  reset(initialConcentrations: SpeciesConcentrations) {
    this.stop();
    this.currentState = { ...initialConcentrations };
    this.currentTime = 0;
  }

  // Update current state (useful for external state changes)
  updateState(concentrations: SpeciesConcentrations, time: number) {
    this.currentState = { ...concentrations };
    this.currentTime = time;
  }

  // Get current simulation state
  getCurrentState(): { time: number; concentrations: SpeciesConcentrations } {
    return {
      time: this.currentTime,
      concentrations: { ...this.currentState },
    };
  }

  // Check if simulation is running
  getIsRunning(): boolean {
    return this.isRunning;
  }

  // Private method to schedule the next simulation step
  private scheduleNextStep() {
    if (!this.isRunning) {
      return;
    }

    // Optimized speed mapping: 1x = 100 calcs/sec (10ms), max 10,000x
    // 1x = 100 calculations per second (10ms per calculation)
    // 10x = 1,000 calculations per second (1ms per calculation)
    // 100x = 10,000 calculations per second (0.1ms per calculation)
    // 10,000x = 1,000,000 calculations per second (0.001ms per calculation)
    const BASE_INTERVAL = 100; // 100ms for 1x speed (100 calculations per second)
    const TARGET_INTERVAL = BASE_INTERVAL / this.speed; // Target interval in ms per calculation
    const BATCH_THRESHOLD = 10; // Start batching when interval < 10ms
    const MAX_BATCH_SIZE = 100; // Reasonable batch size for smooth updates
    const UPDATE_INTERVAL = 20; // Fixed 20ms for visual updates (50 FPS)

    let actualInterval: number;
    let calculationsPerBatch: number;

    if (TARGET_INTERVAL >= BATCH_THRESHOLD) {
      // Low/medium speeds: 1 calculation per iteration, variable interval
      actualInterval = TARGET_INTERVAL;
      calculationsPerBatch = 1;
    } else {
      // High speeds: batching with frequent visual updates
      actualInterval = UPDATE_INTERVAL; // Fixed 20ms for smooth visual updates
      const idealBatchSize = Math.ceil(UPDATE_INTERVAL / TARGET_INTERVAL);
      calculationsPerBatch = Math.min(idealBatchSize, MAX_BATCH_SIZE);
    }

    // Ensure the very first tick is exactly one dt to avoid initial time jump
    if (!this.firstTickDone) {
      calculationsPerBatch = 1;
      actualInterval = Math.min(TARGET_INTERVAL, BATCH_THRESHOLD);
    }

    // Store batch size for executeStep
    this.currentBatchSize = calculationsPerBatch;

    this.timerId = window.setTimeout(() => {
      this.executeStep();
    }, actualInterval);
  }

  // Private method to execute simulation step(s) with intelligent batching
  private async executeStep() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Get batch size (set by scheduleNextStep)
      const batchSize = this.currentBatchSize;

      // Ensure WASM is initialized; if not ready yet, wait and retry
      if (!isWasmReady()) {
        void initWasm();
        // Try again shortly without advancing state
        this.timerId = window.setTimeout(() => this.executeStep(), 10);
        return;
      }

      const paramsNum = paramsToNumbers(this.params);
      const currentNum = {
        E: this.currentState.E,
        ES: this.currentState.ES,
        EP: this.currentState.EP,
        S: this.currentState.S,
        P: this.currentState.P,
        TIEMPO: this.currentTime,
      };

      if (batchSize === 1) {
        // Single step: compute final only (WASM)
        const final = await wasmSimulateStepsFinal(currentNum, paramsNum, batchSize);
        if (!final) {
          // If call failed unexpectedly, reschedule and retry
          this.scheduleNextStep();
          return;
        }

        this.currentState = {
          E: final.E,
          ES: final.ES,
          EP: final.EP,
          S: final.S,
          P: final.P,
        };
        this.currentTime = final.TIEMPO;

        if (this.callback) {
          const step: SimulationStep = {
            time: this.currentTime,
            concentrations: { ...this.currentState },
          };
          this.callback(step);
        }
      } else {
        // Large batches: compute full series in WASM and emit array
        const series = await wasmSimulateStepsSeries(currentNum, paramsNum, batchSize);
        if (!series || series.length === 0) {
          this.scheduleNextStep();
          return;
        }

        const batchResults: SimulationStep[] = series.map((s) => ({
          time: s.TIEMPO,
          concentrations: { E: s.E, ES: s.ES, EP: s.EP, S: s.S, P: s.P },
        }));

        const last = series[series.length - 1];
        this.currentState = { E: last.E, ES: last.ES, EP: last.EP, S: last.S, P: last.P };
        this.currentTime = last.TIEMPO;

        if (this.callback) {
          this.callback(batchResults);
        }
      }

      // Mark first tick as completed after successfully advancing time
      this.firstTickDone = true;

      // Schedule next batch
      this.scheduleNextStep();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Simulation step error:", error);
      }
      this.stop();
    }
  }

  // All calculations are performed in WASM; no JS fallback needed.
}
