import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { PlotParams } from "react-plotly.js";
import { SimulationParams, SimulationStatus } from "./simulationSlice";
import Decimal from "decimal.js";
import { simulateAtTimes, computeMetrics } from "@/lib/fitting";
import { wasmFitNelderMead, paramsToNumbers } from "@/lib/wasm-sim";

// --- Types ---
// UI Slice
export type UIState = {
  sidebarOpen: boolean;
  isMaximized: boolean;
};

// Fitting Slice
export type FitDataset = {
  fileName: string;
  headers: string[];
  rows: string[][];
};

export type FitSelection = {
  colX: string; // header for time
  colY: string; // header for value
  species: "S" | "P" | "E" | "ES" | "EP";
};

export type FitPrepared = {
  t: number[];
  y: number[];
};

export type FitState = {
  dataset: FitDataset | null;
  selection: FitSelection | null;
  preparedData?: FitPrepared;
  modelAtT?: number[];
  metrics?: { sse: number; rmse: number; r2: number; sst: number };
};

export type FitActions = {
  setDataset: (dataset: FitDataset | null) => void;
  setSelection: (selection: FitSelection | null) => void;
  clearFit: () => void;
  prepareFit: () => void;
  evaluateCurrentParams: () => Promise<void>;
  runNelderMead: (mask?: [number, number, number, number, number, number, number]) => Promise<void>;
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

// Pinned (saved) run for overlay plotting
export type PinnedRun = {
  id: string;
  label: string;
  history: ConcentrationHistory;
  createdAt: number;
  paramsSnapshot?: SimulationParams;
};

export type SimulationData = {
  params: SimulationParams;
  status: SimulationStatus;
  time: number;
  concentrations: SpeciesConcentrations;
  history: ConcentrationHistory;
  speed: number; // Simulation speed multiplier (0.0001 to 1000)
  scrubIndex: number | null; // When paused, which index of history is being viewed
  pinnedRuns: PinnedRun[]; // Saved runs to overlay on the plot
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
  setScrubIndex: (idx: number | null) => void;
  pinCurrentRun: (label?: string) => void;
  removePinnedRun: (id: string) => void;
  clearPinnedRuns: () => void;
};

// App State
export type AppState = {
  ui: UIState & UIActions;
  plot: PlotState & PlotActions;
  simulation: SimulationData & SimulationActions;
  fit: FitState & FitActions;
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
  scrubIndex: null,
  pinnedRuns: [],
};

const initialFit: FitState = {
  dataset: null,
  selection: null,
  preparedData: undefined,
  modelAtT: undefined,
  metrics: undefined,
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
            scrubIndex: null,
          },
        }));
      } else if (status === "running" && currentStatus === "paused") {
        // Resuming from pause - just change status, keep history intact
        set((state: AppState) => ({
          simulation: { ...state.simulation, status, scrubIndex: null },
        }));
      } else if (status === "paused" && currentStatus === "running") {
        // Pausing a running simulation
        set((state: AppState) => ({
          simulation: {
            ...state.simulation,
            status,
            // Default scrub position at the latest point when entering pause
            scrubIndex:
              state.simulation.history.length > 0
                ? state.simulation.history.length - 1
                : null,
          },
        }));
      } else {
        // Default case (including stop)
        set((state: AppState) => ({
          simulation: { ...state.simulation, status, scrubIndex: null },
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
    setScrubIndex: (idx: number | null) =>
      set((state: AppState) => ({
        simulation: { ...state.simulation, scrubIndex: idx },
      })),
    pinCurrentRun: (label?: string) =>
      set((state: AppState) => {
        if (state.simulation.history.length === 0) return state;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const defaultLabel = `Run ${state.simulation.pinnedRuns.length + 1}`;
        const pinned: PinnedRun = {
          id,
          label: label?.trim() || defaultLabel,
          history: [...state.simulation.history],
          createdAt: Date.now(),
          paramsSnapshot: state.simulation.params,
        };
        return {
          ...state,
          simulation: {
            ...state.simulation,
            pinnedRuns: [...state.simulation.pinnedRuns, pinned],
          },
        } as AppState;
      }),
    removePinnedRun: (id: string) =>
      set((state: AppState) => ({
        simulation: {
          ...state.simulation,
          pinnedRuns: state.simulation.pinnedRuns.filter((r) => r.id !== id),
        },
      })),
    clearPinnedRuns: () =>
      set((state: AppState) => ({
        simulation: { ...state.simulation, pinnedRuns: [] },
      })),
  },
  fit: {
    ...initialFit,
    setDataset: (dataset: FitDataset | null) =>
      set((state: AppState) => ({ fit: { ...state.fit, dataset } })),
    setSelection: (selection: FitSelection | null) =>
      set((state: AppState) => ({ fit: { ...state.fit, selection } })),
    clearFit: () =>
      set((state: AppState) => ({ fit: { ...state.fit, ...initialFit } })),
    prepareFit: () => {
      const current = get();
      const ds = current.fit.dataset;
      const sel = current.fit.selection;
      if (!ds || !sel) return;
      const idxX = ds.headers.indexOf(sel.colX);
      const idxY = ds.headers.indexOf(sel.colY);
      if (idxX < 0 || idxY < 0) return;
      const t: number[] = [];
      const y: number[] = [];
      for (const row of ds.rows) {
        const vx = parseFloat(row[idxX] ?? "");
        const vy = parseFloat(row[idxY] ?? "");
        if (Number.isFinite(vx) && Number.isFinite(vy)) {
          t.push(vx);
          y.push(vy);
        }
      }
      // Ensure time-ascending order for robust interpolation/fitting
      const order = t.map((_, i) => i).sort((a, b) => t[a] - t[b]);
      const tSorted = order.map((i) => t[i]);
      const ySorted = order.map((i) => y[i]);
      set((state: AppState) => ({
        fit: { ...state.fit, preparedData: { t: tSorted, y: ySorted }, modelAtT: undefined, metrics: undefined },
      }));
    },
    evaluateCurrentParams: async () => {
      const state = get();
      const sel = state.fit.selection;
      const prep = state.fit.preparedData;
      if (!sel || !prep || prep.t.length === 0) return;
      // Build SimulationState from current simulation slice
      const sim = state.simulation;
      // Use initial conditions from params at t=0 to be consistent with exported datasets
      const initState = {
        EL: new Decimal(sim.params.NEL),
        ES: new Decimal(sim.params.NES),
        EP: new Decimal(sim.params.NEP),
        S: new Decimal(sim.params.NS),
        P: new Decimal(sim.params.NP),
        TIEMPO: new Decimal(0),
      } as const;
      const yModel = await simulateAtTimes(
        initState as unknown as import("@/lib/precise-simulation").SimulationState,
        sim.params as unknown as import("@/lib/precise-simulation").SimulationParams,
        sel.species,
        prep.t
      );
      if (!yModel) return;
      const m = computeMetrics(prep.y, yModel);
      set((s: AppState) => ({ fit: { ...s.fit, modelAtT: yModel, metrics: m } }));
    },
    runNelderMead: async (mask?: [number, number, number, number, number, number, number]) => {
      const state = get();
      const sel = state.fit.selection;
      const prep = state.fit.preparedData;
      if (!sel || !prep || prep.t.length === 0) return;
      const sim = state.simulation;
      // Build numeric init state from params at time 0 to match dataset origin
      const numericInit = {
        E: sim.params.NEL,
        ES: sim.params.NES,
        EP: sim.params.NEP,
        S: sim.params.NS,
        P: sim.params.NP,
        TIEMPO: 0,
      } as const;
      // Numeric params using helper (handles optional dt defaulting)
      const pn = paramsToNumbers(
        sim.params as unknown as import("@/lib/precise-simulation").SimulationParams
      );

      const usedMask = mask ?? [1, 1, 1, 1, 1, 1, 0]; // optimize all k's, keep dt fixed by default
      const res = await wasmFitNelderMead(
        numericInit,
        pn,
        prep.t,
        prep.y,
        sel.species,
        usedMask,
        { maxIter: 200, tol: 1e-6, scale: 0.1 }
      );
      if (!res) return;

      // Update params in store
      set((s: AppState) => {
        const keepDt = usedMask[6] === 0;
        const newParams = {
          ...s.simulation.params,
          k1: new Decimal(res.k1),
          kMinus3: new Decimal(res.kMinus3),
          kMinus1: new Decimal(res.kMinus1),
          k2: new Decimal(res.k2),
          kMinus2: new Decimal(res.kMinus2),
          k3: new Decimal(res.k3),
          dt: keepDt ? s.simulation.params.dt : new Decimal(res.dt),
        } as SimulationParams;
        return {
          simulation: { ...s.simulation, params: newParams },
        } as Partial<AppState> as AppState;
      });

      // Re-evaluate model and metrics with fitted params
      const after = get();
      const initState = {
        EL: new Decimal(after.simulation.params.NEL),
        ES: new Decimal(after.simulation.params.NES),
        EP: new Decimal(after.simulation.params.NEP),
        S: new Decimal(after.simulation.params.NS),
        P: new Decimal(after.simulation.params.NP),
        TIEMPO: new Decimal(0),
      } as const;
      const yModel2 = await simulateAtTimes(
        initState as unknown as import("@/lib/precise-simulation").SimulationState,
        after.simulation.params as unknown as import("@/lib/precise-simulation").SimulationParams,
        sel.species,
        prep.t
      );
      if (!yModel2) return;
      const m2 = computeMetrics(prep.y, yModel2);
      set((s: AppState) => ({ fit: { ...s.fit, modelAtT: yModel2, metrics: m2 } }));
    },
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
  const { setParams, setStatus, setSpeed, resetSimulation, runStep, setScrubIndex } = useAppStore(
    (s) => s.simulation
  );
  const { pinCurrentRun, removePinnedRun, clearPinnedRuns } = useAppStore((s) => s.simulation);
  return { setParams, setStatus, setSpeed, resetSimulation, runStep, setScrubIndex, pinCurrentRun, removePinnedRun, clearPinnedRuns };
};

// Fit Hooks
export const useFitState = () => useAppStore((s) => s.fit);

export const useFitActions = () => {
  const { setDataset, setSelection, clearFit, prepareFit, evaluateCurrentParams, runNelderMead } = useAppStore((s) => s.fit);
  return { setDataset, setSelection, clearFit, prepareFit, evaluateCurrentParams, runNelderMead };
};
