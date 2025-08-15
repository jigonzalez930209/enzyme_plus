import { SimulationData } from "@/state/useAppStore";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { SaveIcon } from "lucide-react";

const ExportDialog = ({
  exportOpen,
  setExportOpen,
  simulation,
  handleSaveTSV,
  handleSaveXLSX,
}: {
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  simulation: SimulationData;
  handleSaveTSV: () => void;
  handleSaveXLSX: () => void;
}) => {
  return (
    <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
      <AlertDialogTrigger asChild>
        <Button
          className="flex items-center justify-center"
          disabled={
            simulation.status !== "paused" || simulation.history.length === 0
          }
          size="icon"
          variant="default"
          title={
            simulation.status === "paused"
              ? simulation.history.length > 0
                ? "Save current history"
                : "No data to save yet"
              : "Save is available only when paused"
          }
        >
          <SaveIcon className="w-8 h-8" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className="">
          <AlertDialogTitle className="mb-2 text-sm text-foreground">
            Export data
          </AlertDialogTitle>
          <AlertDialogDescription className="mb-3 text-xs text-muted-foreground">
            Elige el formato para exportar la simulación actual.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              handleSaveTSV();
              setExportOpen(false);
            }}
            variant="default"
            className="w-full text-white bg-emerald-500 hover:bg-emerald-600"
          >
            Exportar como CSV
          </Button>
          <Button
            onClick={() => {
              handleSaveXLSX();
              setExportOpen(false);
            }}
            variant="default"
            className="w-full text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Exportar como Excel (.xlsx)
          </Button>
          <div className="flex justify-end w-full pt-3 mt-3 border-t border-primary">
            <Button
              variant="destructive"
              className=""
              onClick={() => setExportOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ExportDialog;
