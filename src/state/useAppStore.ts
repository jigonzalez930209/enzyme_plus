import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { PlotParams } from "react-plotly.js";
import { SimulationParams, SimulationStatus } from "./simulationSlice";
import Decimal from "decimal.js";

// --- Types ---
// UI Slice
export type UIState = {
  sidebarOpen: boolean;
  isMaximized: boolean;
};
export type UIActions = {
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  setMaximized: (value: boolean) => void;
};

// Plot Slice
export type PlotState = {
  data: PlotParams["data"];
  layout: Partial<PlotParams["layout"]>;
  config: Partial<PlotParams["config"]>;
  refreshTrigger: number;
};
export type PlotActions = {
  setPlotData: (data: PlotParams["data"]) => void;
  updateLayout: (layout: Partial<PlotParams["layout"]>) => void;
  triggerRefresh: () => void;
};

// Simulation Slice
export type SpeciesConcentrations = {
  E: number;
  S: number;
  ES: number;
  EP: number;
  P: number;
};

export type ConcentrationHistory = Array<{
  time: number;
  concentrations: SpeciesConcentrations;
}>;

export type SimulationData = {
  params: SimulationParams;
  status: SimulationStatus;
  time: number;
  concentrations: SpeciesConcentrations;
  history: ConcentrationHistory;
  speed: number; // Simulation speed multiplier (0.0001 to 1000)
};
export type SimulationActions = {
  setParams: (params: Partial<SimulationParams>) => void;
  setStatus: (status: SimulationStatus) => void;
  setSpeed: (speed: number) => void;
  resetSimulation: () => void;
  runStep: (step: {
    time: number;
    concentrations: SimulationData["concentrations"];
  }) => void;
};

// App State
export type AppState = {
  ui: UIState & UIActions;
  plot: PlotState & PlotActions;
  simulation: SimulationData & SimulationActions;
};

// --- Initial State ---
const initialUI: UIState = {
  sidebarOpen: true,
  isMaximized: false,
};

const initialPlot: PlotState = {
  data: [],
  layout: { title: "Enzyme Kinetics" },
  config: { responsive: true },
  refreshTrigger: 0,
};

const initialSimulation: SimulationData = {
  params: {
    NEL: 10000, // Free enzyme (from reference image)
    NES: 0,
    NEP: 0,
    NS: 100000, // Substrate (from reference image)
    NP: 0, // Product (from reference image)
    k1: new Decimal("1e-6"), // k(E + S->ES) from reference image
    kMinus3: new Decimal("1e-6"), // k(E + P->EP) from reference image
    kMinus1: new Decimal(0.1), // k(ES->E+S) from reference image
    k2: new Decimal(0.1), // k(ES->EP) from reference image
    kMinus2: new Decimal(0.1), // k(EP->ES) from reference image
    k3: new Decimal(0.1), // k(EP->E + P) from reference image
    dt: new Decimal(1), // default physical simulation step (seconds)
  },
  status: "stopped", // 'stopped', 'running', or 'paused'
  time: 0,
  concentrations: {
    E: 10000, // Free enzyme (from reference image)
    S: 100000, // Substrate (from reference image)
    ES: 0, // Enzyme-Substrate (from reference image)
    EP: 0, // Enzyme-Product (from reference image)
    P: 0, // Product (from reference image)
  },
  history: [],
  speed: 1.0, // Default simulation speed (1x)
};

// Store hooks will be defined after store creation

// --- Store Definition ---
// Use Zustand's standard type for the store function
const store = (
  set: (
    partial:
      | AppState
      | Partial<AppState>
      | ((state: AppState) => AppState | Partial<AppState>)
  ) => void,
  get: () => AppState
) => ({
  ui: {
    ...initialUI,
    toggleSidebar: () =>
      set((state: AppState) => ({
        ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
      })),
    setSidebar: (open: boolean) =>
      set((state: AppState) => ({ ui: { ...state.ui, sidebarOpen: open } })),
    setMaximized: (value: boolean) =>
      set((state: AppState) => ({ ui: { ...state.ui, isMaximized: value } })),
  },
  plot: {
    ...initialPlot,
    setPlotData: (data: PlotParams["data"]) =>
      set((state: AppState) => ({
        plot: {
          ...state.plot,
          data,
          refreshTrigger: state.plot.refreshTrigger + 1,
        },
      })),
    updateLayout: (layout: Partial<PlotParams["layout"]>) =>
      set((state: AppState) => ({
        plot: { ...state.plot, layout: { ...state.plot.layout, ...layout } },
      })),
    triggerRefresh: () =>
      set((state: AppState) => ({
        plot: { ...state.plot, refreshTrigger: state.plot.refreshTrigger + 1 },
      })),
  },
  simulation: {
    ...initialSimulation,
    setParams: (params: Partial<SimulationParams>) =>
      set((state: AppState) => ({
        simulation: {
          ...state.simulation,
          params: { ...state.simulation.params, ...params },
        },
      })),
    setStatus: (status: SimulationStatus) => {
      const currentStatus = get().simulation.status;
      
      if (status === "running" && currentStatus === "stopped" && get().simulation.time === 0) {
        // Starting a fresh simulation (Play button)
        set((state: AppState) => ({
          simulation: {
            ...state.simulation,
            status,
            history: [
              {
                time: state.simulation.time,
                concentrations: state.simulation.concentrations,
              },
            ],
          },
        }));
      } else if (status === "running" && currentStatus === "paused") {
        // Resuming from pause - just change status, keep history intact
        set((state: AppState) => ({
          simulation: { ...state.simulation, status },
        }));
      } else if (status === "paused" && currentStatus === "running") {
        // Pausing a running simulation
        set((state: AppState) => ({
          simulation: { ...state.simulation, status },
        }));
      } else {
        // Default case (including stop)
        set((state: AppState) => ({
          simulation: { ...state.simulation, status },
        }));
      }
    },
    setSpeed: (speed: number) =>
      set((state: AppState) => ({
        simulation: {
          ...state.simulation,
          speed,
        },
      })),
    resetSimulation: () =>
      set((state: AppState) => ({
        simulation: {
          ...state.simulation,
          status: "stopped",
          time: 0,
          concentrations: {
            // Initialize concentrations directly from current params
            // so that the run starts exactly from the values set in the UI
            E: state.simulation.params.NEL,
            S: state.simulation.params.NS,
            ES: state.simulation.params.NES,
            EP: state.simulation.params.NEP,
            P: state.simulation.params.NP,
          },
          history: [],
        },
      })),
    runStep: (step: {
      time: number;
      concentrations: SimulationData["concentrations"];
    }) =>
      set((state: AppState) => ({
        simulation: {
          ...state.simulation,
          time: step.time,
          concentrations: step.concentrations,
          history: [...state.simulation.history, step],
        },
      })),
  },
});

const persistOptions = {
  // On first load, remove any stale persisted simulation data that could overwrite actions.
  // This runs once when the module is evaluated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...(typeof window !== "undefined" &&
    (() => {
      try {
        const raw = localStorage.getItem("app-storage");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.simulation) {
            // Remove the old entry so only UI slice is persisted.
            localStorage.removeItem("app-storage");
          }
        }
      } catch (e) {
        // ignore parsing errors
      }
      return {};
    })()),
  name: "app-storage",
  version: 1,
  partialize: (state: AppState) =>
    ({
      ui: { sidebarOpen: state.ui.sidebarOpen },
      // Do not persist simulation slice to keep actions intact.
    } as Partial<AppState>),
  storage: createJSONStorage(() => localStorage),
};

export const useAppStore = create<AppState>()(
  devtools(persist(store, persistOptions))
);

// --- Enhanced Hooks for Components ---
// UI Hooks
export const useUIState = () =>
  useAppStore((s) => ({
    sidebarOpen: s.ui.sidebarOpen,
    isMaximized: s.ui.isMaximized,
  }));

export const useUIActions = () => {
  const { toggleSidebar, setSidebar, setMaximized } = useAppStore((s) => s.ui);
  return { toggleSidebar, setSidebar, setMaximized };
};

// Plot Hooks
export const usePlotState = () => useAppStore((s) => s.plot);

export const usePlotActions = () => {
  const { setPlotData, updateLayout, triggerRefresh } = useAppStore(
    (s) => s.plot
  );
  return { setPlotData, updateLayout, triggerRefresh };
};

// Simulation Hooks
export const useSimulationState = () => useAppStore((s) => s.simulation);

export const useSimulationActions = () => {
  const { setParams, setStatus, setSpeed, resetSimulation, runStep } = useAppStore(
    (s) => s.simulation
  );
  return { setParams, setStatus, setSpeed, resetSimulation, runStep };
};
