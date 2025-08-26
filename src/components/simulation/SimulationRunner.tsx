import React from "react";
import {
  useSimulationState,
  useSimulationActions,
} from "../../state/useAppStore";
import { SimulationEngine } from "../../lib/simulation-engine";

export function SimulationRunner() {
  const simulation = useSimulationState();
  const { runStep } = useSimulationActions();
  const engineRef = React.useRef<SimulationEngine | null>(null);

  // Initialize simulation engine once
  React.useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new SimulationEngine(
        simulation.concentrations,
        simulation.params,
        (step) => {
          // Handle both single steps and batch updates
          if (Array.isArray(step)) {
            // Batch update: add all steps to history at once
            step.forEach((singleStep) => runStep(singleStep));
          } else {
            // Single step update
            runStep(step);
          }
        }
      );
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependencies - initialize only once

  // Handle simulation status changes
  React.useEffect(() => {
    if (!engineRef.current) return;

    if (simulation.status === "running") {
      // Sync engine with latest store state and params before starting.
      // This is critical when resetSimulation() and setStatus('running') happen back-to-back
      // (e.g., from FitDialog), so we don't miss the 'stopped' sync effect.
      engineRef.current.updateParams(simulation.params);
      engineRef.current.updateState(simulation.concentrations, simulation.time);
      engineRef.current.start();
    } else {
      engineRef.current.stop();
    }
  }, [simulation.status]);

  // Handle speed changes
  React.useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSpeed(simulation.speed);
    }
  }, [simulation.speed]);

  // Handle parameter changes
  React.useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateParams(simulation.params);
    }
  }, [simulation.params]);

  // Sync engine state with React state when needed
  React.useEffect(() => {
    if (engineRef.current && simulation.status === "stopped") {
      // Update engine state to match React state when stopped
      engineRef.current.updateState(simulation.concentrations, simulation.time);
    }
  }, [simulation.concentrations, simulation.time, simulation.status]);

  return null; // This component doesn't render anything
}
