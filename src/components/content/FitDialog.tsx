import * as React from "react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import FitChart from "./fit/FitChart";
import FitSelectors from "./fit/FitSelectors";
import { FitParamsMask } from "./fit/FitParamsMask";
import FitPreviewTable from "./fit/FitPreviewTable";
import {
  useFitActions,
  useFitState,
  useSimulationState,
  useSimulationActions,
} from "@/state/useAppStore";
import { LineChartIcon } from "lucide-react";

// Simple CSV/TSV parser: detects delimiter by header line
function parseDelimited(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine.split(delimiter).map((h) => h.trim());
  const rows = lines
    .slice(1)
    .map((line) => line.split(delimiter).map((c) => c.trim()));
  return { headers, rows };
}

export default function FitDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const {
    setDataset,
    setSelection,
    prepareFit,
    evaluateCurrentParams,
    runNelderMead,
    clearFit,
  } = useFitActions();
  const fit = useFitState();
  const simulation = useSimulationState();
  const { resetSimulation, setStatus } = useSimulationActions();
  const [fileName, setFileName] = React.useState<string>("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [colX, setColX] = React.useState<string>("");
  const [colY, setColY] = React.useState<string>("");
  const [species, setSpecies] = React.useState<string>("P");
  const [error, setError] = React.useState<string>("");
  const [isFitting, setIsFitting] = React.useState<boolean>(false);
  const [loadedToStore, setLoadedToStore] = React.useState<boolean>(false);
  const [hasOptimized, setHasOptimized] = React.useState<boolean>(false);
  const [mask, setMask] = React.useState({
    k1: true,
    kMinus3: true,
    kMinus1: true,
    k2: true,
    kMinus2: true,
    k3: true,
    dt: false,
  });
  // Dark mode detection for better plot styling
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const { headers: h, rows: r } = parseDelimited(text);
      if (h.length < 2 || r.length === 0) {
        setError("Archivo vacío o sin cabeceras válidas");
        return;
      }
      setError("");
      setFileName(f.name);
      setHeaders(h);
      setRows(r);
      setLoadedToStore(false); // require explicit user action to commit
      setHasOptimized(false); // new file, optimization not applied yet
      // heurística: intenta seleccionar columnas con nombres típicos
      const lower = h.map((x) => x.toLowerCase());
      const guessX =
        h[lower.findIndex((x) => x === "time" || x === "t")] ?? h[0];
      const guessY =
        h[
          lower.findIndex((x) =>
            ["p", "value", "y", "measurement", "concentration"].includes(x)
          )
        ] ?? h[Math.min(1, h.length - 1)];
      setColX(guessX);
      setColY(guessY);
    } catch (err) {
      setError("No se pudo leer el archivo");
    }
  };

  const ready = headers.length > 0 && colX && colY && species && loadedToStore;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          // When closing the dialog, ensure dataset and previews are cleared
          clearFit();
          setLoadedToStore(false);
          setHasOptimized(false);
        }
        setOpen(v);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Ajuste de parámetros con datos experimentales"
        >
          <LineChartIcon className="w-5 h-5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[90vw] max-w-[90vw] h-[90vh] grid grid-rows-[auto_1fr_auto] max-h-[90vh]">
        <AlertDialogHeader>
          <AlertDialogTitle className="mb-2 text-sm text-foreground">
            Ajuste de parámetros (beta)
          </AlertDialogTitle>
          <AlertDialogDescription className="mb-3 text-xs text-muted-foreground">
            Importa un archivo CSV o TSV, selecciona columnas de tiempo (X) y
            valor (Y), y la especie objetivo a ajustar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-1 gap-3 text-sm text-primary md:grid-cols-5">
          {/* Left: file controls, selectors, mask, preview, and action buttons */}
          <div className="flex flex-col gap-3 md:col-span-2 overflow-auto">
            <input
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              onChange={onFileChange}
            />
            {/* Controls to load/unload dataset into the global store */}
            {headers.length > 0 && !loadedToStore && (
              <div>
                <Button
                  variant="default"
                  onClick={async () => {
                    // Save dataset and selection to global store only when user decides
                    setDataset({ fileName, headers, rows });
                    setSelection({ colX, colY, species: species as any });
                    // Only prepare data; do not auto-evaluate model yet
                    prepareFit();
                    setLoadedToStore(true);
                    setHasOptimized(false);
                  }}
                  title="Cargar dataset para ajuste y previsualización"
                  className="text-white bg-blue-600 hover:bg-blue-700"
                >
                  Cargar dataset para ajuste
                </Button>
              </div>
            )}
            {headers.length > 0 && loadedToStore && (
              <div>
                <Button
                  variant="destructive"
                  onClick={() => {
                    clearFit();
                    setLoadedToStore(false);
                    setHasOptimized(false);
                  }}
                  title="Quita el dataset del ajuste y limpia previsualización"
                >
                  Quitar dataset del ajuste
                </Button>
              </div>
            )}
            {fileName && (
              <div className="text-xs text-muted-foreground">Archivo: {fileName}</div>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}

            <FitSelectors
              headers={headers}
              colX={colX}
              colY={colY}
              species={species}
              onChangeX={async (v) => {
                setColX(v);
                if (loadedToStore) {
                  setSelection({ colX: v, colY, species: species as any });
                  prepareFit();
                  setHasOptimized(false);
                  if (hasOptimized) {
                    await evaluateCurrentParams();
                  }
                }
              }}
              onChangeY={async (v) => {
                setColY(v);
                if (loadedToStore) {
                  setSelection({ colX, colY: v, species: species as any });
                  prepareFit();
                  setHasOptimized(false);
                  if (hasOptimized) {
                    await evaluateCurrentParams();
                  }
                }
              }}
              onChangeSpecies={async (v) => {
                setSpecies(v);
                if (loadedToStore) {
                  setSelection({ colX, colY, species: v as any });
                  prepareFit();
                  setHasOptimized(false);
                  if (hasOptimized) {
                    await evaluateCurrentParams();
                  }
                }
              }}
            />

            <FitParamsMask
              mask={mask}
              onToggle={(key, checked) => setMask((m) => ({ ...m, [key]: checked }))}
            />

            <FitPreviewTable headers={headers} rows={rows} />

            {/* Action buttons moved here */}
            <div className="flex flex-wrap gap-2 pt-2 mt-2 border-t">
              <Button variant="destructive" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              {hasOptimized && (
                <Button
                  disabled={!ready || isFitting}
                  onClick={async () => {
                    prepareFit();
                    await evaluateCurrentParams();
                  }}
                  className="text-white bg-indigo-600 hover:bg-indigo-700"
                  title={
                    ready
                      ? "Evaluar modelo con parámetros actuales"
                      : "Selecciona columnas y especie"
                  }
                >
                  Evaluar modelo
                </Button>
              )}
              <Button
                disabled={!ready || isFitting}
                onClick={async () => {
                  try {
                    setIsFitting(true);
                    prepareFit();
                    const mArr: [number, number, number, number, number, number, number] = [
                      mask.k1 ? 1 : 0,
                      mask.kMinus3 ? 1 : 0,
                      mask.kMinus1 ? 1 : 0,
                      mask.k2 ? 1 : 0,
                      mask.kMinus2 ? 1 : 0,
                      mask.k3 ? 1 : 0,
                      mask.dt ? 1 : 0,
                    ];
                    await runNelderMead(mArr);
                    // After apply, refresh preview
                    await evaluateCurrentParams();
                    setHasOptimized(true);
                  } finally {
                    setIsFitting(false);
                  }
                }}
                className="text-white bg-emerald-600 hover:bg-emerald-700"
                title={
                  ready
                    ? "Ajustar (Nelder–Mead) y aplicar parámetros"
                    : "Selecciona columnas y especie"
                }
              >
                {isFitting ? "Ajustando…" : "Ajustar y aplicar"}
              </Button>
              <Button
                disabled={isFitting}
                onClick={() => {
                  // Reset and start the main simulation so results are visible on the main chart
                  resetSimulation();
                  setStatus("running");
                }}
                className="text-white bg-blue-600 hover:bg-blue-700"
                title="Reinicia y ejecuta la simulación con los parámetros actuales en el gráfico principal"
              >
                Simular en gráfico principal
              </Button>
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                title="Cerrar e importar al gráfico principal"
              >
                Cerrar
              </Button>
            </div>
          </div>

          {/* Right: Dynamic chart only */}
          <FitChart
            t={fit.preparedData?.t}
            y={fit.preparedData?.y}
            model={fit.modelAtT}
            speciesLabel={fit.selection?.species ?? "P"}
            hasOptimized={hasOptimized}
            metrics={fit.metrics ?? null}
            simulationParams={(simulation as any).params ?? null}
            isDark={isDark}
          />
        </div>
        
      </AlertDialogContent>
    </AlertDialog>
  );
}
