import {
  simulateTick,
  createStateFromNumbers,
  type SimulationParams,
} from "./precise-simulation";
import type { SpeciesConcentrations } from "../state/useAppStore";

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

    // Store batch size for executeStep
    this.currentBatchSize = calculationsPerBatch;

    this.timerId = window.setTimeout(() => {
      this.executeStep();
    }, actualInterval);
  }

  // Private method to execute simulation step(s) with intelligent batching
  private executeStep() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Get batch size (set by scheduleNextStep)
      const batchSize = this.currentBatchSize;

      // Always use batch processing for consistent 60 FPS updates
      if (batchSize <= 10) {
        // Small batches: process directly without yield
        const batchResults: SimulationStep[] = [];

        for (let i = 0; i < batchSize; i++) {
          if (!this.isRunning) break;

          const decimalState = createStateFromNumbers({
            EL: this.currentState.E,
            ES: this.currentState.ES,
            EP: this.currentState.EP,
            S: this.currentState.S,
            P: this.currentState.P,
            TIEMPO: this.currentTime,
          });

          const simulationParams = {
            NEL: Math.round(this.currentState.E),
            NES: Math.round(this.currentState.ES),
            NEP: Math.round(this.currentState.EP),
            NS: this.params.NS,
            NP: this.params.NP,
            k1: this.params.k1,
            kMinus1: this.params.kMinus1,
            k2: this.params.k2,
            kMinus2: this.params.kMinus2,
            k3: this.params.k3,
            kMinus3: this.params.kMinus3,
          };

          const nextDecimal = simulateTick(decimalState, simulationParams);

          this.currentState = {
            E: nextDecimal.EL.toNumber(),
            ES: nextDecimal.ES.toNumber(),
            EP: nextDecimal.EP.toNumber(),
            S: nextDecimal.S.toNumber(),
            P: nextDecimal.P.toNumber(),
          };
          this.currentTime = nextDecimal.TIEMPO.toNumber();

          // Add to batch results (only store final result for single calc)
          if (batchSize === 1 || i === batchSize - 1) {
            batchResults.push({
              time: this.currentTime,
              concentrations: { ...this.currentState },
            });
          }
        }

        // Send results
        if (this.callback && batchResults.length > 0) {
          this.callback(batchSize === 1 ? batchResults[0] : batchResults);
        }
      } else {
        // Large batches: use yield mechanism to prevent UI blocking
        this.executeBatchWithYield(batchSize, 0, []);
        return; // Exit here, batch will continue asynchronously
      }

      // Schedule next batch
      this.scheduleNextStep();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Simulation step error:", error);
      }
      this.stop();
    }
  }

  // Execute batch with yield mechanism to prevent UI blocking
  private executeBatchWithYield(
    totalBatchSize: number,
    currentIndex: number,
    batchResults: SimulationStep[]
  ) {
    if (!this.isRunning || currentIndex >= totalBatchSize) {
      // Batch complete, send results
      if (this.callback && batchResults.length > 0) {
        this.callback(batchResults);
      }
      // Schedule next batch
      this.scheduleNextStep();
      return;
    }

    const YIELD_EVERY = 10; // Yield to UI every 10 calculations (more efficient)
    const endIndex = Math.min(currentIndex + YIELD_EVERY, totalBatchSize);

    // Process a small chunk of calculations
    for (let i = currentIndex; i < endIndex; i++) {
      if (!this.isRunning) break;

      const decimalState = createStateFromNumbers({
        EL: this.currentState.E,
        ES: this.currentState.ES,
        EP: this.currentState.EP,
        S: this.currentState.S,
        P: this.currentState.P,
        TIEMPO: this.currentTime,
      });

      const simulationParams = {
        NEL: Math.round(this.currentState.E),
        NES: Math.round(this.currentState.ES),
        NEP: Math.round(this.currentState.EP),
        NS: this.params.NS,
        NP: this.params.NP,
        k1: this.params.k1,
        kMinus1: this.params.kMinus1,
        k2: this.params.k2,
        kMinus2: this.params.kMinus2,
        k3: this.params.k3,
        kMinus3: this.params.kMinus3,
      };

      const nextDecimal = simulateTick(decimalState, simulationParams);

      this.currentState = {
        E: nextDecimal.EL.toNumber(),
        ES: nextDecimal.ES.toNumber(),
        EP: nextDecimal.EP.toNumber(),
        S: nextDecimal.S.toNumber(),
        P: nextDecimal.P.toNumber(),
      };
      this.currentTime = nextDecimal.TIEMPO.toNumber();

      // Add this step to batch results
      batchResults.push({
        time: this.currentTime,
        concentrations: { ...this.currentState },
      });
    }

    // Yield to UI and continue with next chunk
    setTimeout(() => {
      this.executeBatchWithYield(totalBatchSize, endIndex, batchResults);
    }, 0);
  }
}
