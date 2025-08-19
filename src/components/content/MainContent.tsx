import * as React from "react";
import * as XLSX from "xlsx";
import {
  useAppStore,
  useSimulationState,
  useSimulationActions,
} from "@/state/useAppStore";
import { PlotComponent } from "./PlotComponent";
import { SimulationController } from "../simulation/SimulationController";
import { KineticsForm } from "./KineticsForm";
import { SimulationRunner } from "../simulation/SimulationRunner";
import ExportDialog from "./ExportDialog";
import { Button } from "../ui/button";
import { PauseIcon, PlayIcon, SquareIcon, StepForwardIcon } from "lucide-react";

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasHydrated, setHasHydrated] = React.useState(false);

  React.useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    setHasHydrated(useAppStore.persist.hasHydrated());

    return () => {
      unsub();
    };
  }, []);

  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        Cargando simulación...
      </div>
    );
  }

  return <>{children}</>;
}

export function MainContent() {
  const [exportOpen, setExportOpen] = React.useState(false);

  const simulation = useSimulationState();
  const { setStatus, resetSimulation } = useSimulationActions();

  React.useEffect(() => {
    if (
      useAppStore.persist &&
      typeof useAppStore.persist.clearStorage === "function"
    ) {
      useAppStore.persist.clearStorage();
    }
  }, []);

  const isPristine = simulation.time === 0 && simulation.history.length === 0;

  const handleStartStop = () => {
    if (isPristine) {
      resetSimulation();
      setStatus("running");
    } else {
      setStatus("stopped");
      resetSimulation();
    }
  };

  const handlePauseResume = () => {
    if (simulation.status === "running") {
      setStatus("paused");
    } else if (simulation.status === "paused") {
      setStatus("running");
    }
  };

  // Export TSV of history: Time, E, S, ES, EP, P
  const handleSaveTSV = () => {
    if (!(simulation.status === "paused" || simulation.status === "stopped"))
      return;
    const rows = [
      ["Time", "E", "S", "ES", "EP", "P"],
      ...simulation.history.map((h) => [
        h.time,
        Math.round(h.concentrations.E),
        Math.round(h.concentrations.S),
        Math.round(h.concentrations.ES),
        Math.round(h.concentrations.EP),
        Math.round(h.concentrations.P),
      ]),
    ];
    const tsv = rows.map((r) => r.join("\t")).join("\n");
    const blob = new Blob([tsv], {
      type: "text/tab-separated-values;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `enzyme_simulation_${timestamp}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Excel (.xlsx)
  const handleSaveXLSX = () => {
    if (!(simulation.status === "paused" || simulation.status === "stopped"))
      return;
    const data = [
      ["Time", "E", "S", "ES", "EP", "P"],
      ...simulation.history.map((h) => [
        h.time,
        Math.round(h.concentrations.E),
        Math.round(h.concentrations.S),
        Math.round(h.concentrations.ES),
        Math.round(h.concentrations.EP),
        Math.round(h.concentrations.P),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Simulation");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    XLSX.writeFile(wb, `enzyme_simulation_${timestamp}.xlsx`);
  };

  return (
    <ClientOnly>
      <SimulationRunner />
      <div className="flex h-[calc(100vh-2rem)] bg-background">
        <div className="flex flex-col gap-4 p-4 border-r w-80 bg-card border-border">
          <div className="flex items-center justify-center gap-2">
            <Button
              size="icon"
              onClick={handleStartStop}
              className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${
                isPristine
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {isPristine ? (
                <PlayIcon className="w-8 h-8" />
              ) : (
                <SquareIcon className="w-8 h-8" />
              )}
            </Button>
            <Button
              size="icon"
              onClick={handlePauseResume}
              disabled={
                simulation.history.length === 0 ||
                simulation.status === "stopped"
              }
              className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${
                simulation.status === "running"
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                  : simulation.status === "paused"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-gray-400 hover:bg-gray-500 text-white"
              }`}
              title={
                simulation.status === "running"
                  ? "Pausar simulación"
                  : simulation.status === "paused"
                  ? "Reanudar simulación"
                  : "Simulación detenida"
              }
            >
              {simulation.status === "running" ? (
                <PauseIcon className="w-8 h-8" />
              ) : (
                <StepForwardIcon className="w-8 h-8" />
              )}
            </Button>
            <ExportDialog
              exportOpen={exportOpen}
              setExportOpen={setExportOpen}
              simulation={simulation}
              handleSaveTSV={handleSaveTSV}
              handleSaveXLSX={handleSaveXLSX}
            />
          </div>
          <div className="p-3 border rounded border-border bg-card">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Valores iniciales
            </h3>
            <KineticsForm />
          </div>

          <div className="p-3 border rounded border-border bg-card">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Valores actuales
            </h3>
            <SimulationController />
          </div>
        </div>

        <div className="flex flex-col flex-1 border bg-background border-border">
          <div className="flex-1 min-h-0">
            <PlotComponent className="h-full" />
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}
