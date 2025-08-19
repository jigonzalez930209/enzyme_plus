import { useSimulationState, useSimulationActions } from "@/state/useAppStore";
import Decimal from "decimal.js";

export function KineticsForm() {
  const simulation = useSimulationState();
  const { setParams } = useSimulationActions();

  const handleParamChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setParams({ [key]: new Decimal(numValue) });
  };

  const handleInitialValueChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    // Initial counts (NEL, NES, NEP, NS, NP) are plain numbers
    setParams({ [key]: numValue } as unknown as Partial<
      typeof simulation.params
    >);
  };

  return (
    <div className="space-y-2">
      {/* Initial Concentrations - Editable */}
      <div className="space-y-1">
        {/* Substrate */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500"></div>
          <label className="w-4 text-xs">S:</label>
          <input
            type="number"
            value={simulation.params.NS}
            onChange={(e) => handleInitialValueChange("NS", e.target.value)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
            step="1000"
          />
        </div>

        {/* Product */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500"></div>
          <label className="w-4 text-xs">P:</label>
          <input
            type="number"
            value={simulation.params.NP}
            onChange={(e) => handleInitialValueChange("NP", e.target.value)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
            step="1000"
          />
        </div>

        {/* Free Enzyme */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500"></div>
          <label className="w-4 text-xs">E:</label>
          <input
            type="number"
            value={simulation.params.NEL}
            onChange={(e) => handleInitialValueChange("NEL", e.target.value)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
            step="1000"
          />
        </div>

        {/* ES Complex */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-yellow-500"></div>
          <label className="w-4 text-xs">ES:</label>
          <input
            type="number"
            value={simulation.params.NES}
            onChange={(e) => handleInitialValueChange("NES", e.target.value)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
            step="100"
          />
        </div>

        {/* EP Complex */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-purple-500"></div>
          <label className="w-4 text-xs">EP:</label>
          <input
            type="number"
            value={simulation.params.NEP}
            onChange={(e) => handleInitialValueChange("NEP", e.target.value)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
            step="100"
          />
        </div>
      </div>

      {/* Rate Constants */}
      <div className="pt-1 space-y-1 border-t border-gray-300">
        <div className="text-xs font-semibold">Rate Constants:</div>
      </div>
      <div className="space-y-1">
        {/* k1 */}
        <div className="grid items-center grid-cols-6 gap-1">
          <label className="text-xs">k₁:</label>
          <input
            type="number"
            value={simulation.params.k1.toNumber()}
            onChange={(e) => handleParamChange("k1", e.target.value)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary "
            step="0.1"
          />
          <label className="text-xs">k₋₁:</label>
          <input
            type="number"
            value={simulation.params.kMinus1.toNumber()}
            onChange={(e) => handleParamChange("kMinus1", e.target.value)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary "
            step="0.1"
          />
        </div>

        {/* k2 */}
        <div className="grid items-center grid-cols-6 gap-1">
          <label className="text-xs">k₂:</label>
          <input
            type="number"
            value={simulation.params.k2.toNumber()}
            onChange={(e) => handleParamChange("k2", e.target.value)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary "
            step="0.1"
          />
          <label className="text-xs">k₋₂:</label>
          <input
            type="number"
            value={simulation.params.kMinus2.toNumber()}
            onChange={(e) => handleParamChange("kMinus2", e.target.value)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary "
            step="0.1"
          />
        </div>

        {/* k3 */}
        <div className="grid items-center grid-cols-6 gap-1">
          <label className="text-xs">k₃:</label>
          <input
            type="number"
            value={simulation.params.k3.toNumber()}
            onChange={(e) => handleParamChange("k3", e.target.value)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary"
            step="0.1"
          />
          <label className="text-xs">k₋₃:</label>
          <input
            type="number"
            value={simulation.params.kMinus3.toNumber()}
            onChange={(e) => handleParamChange("kMinus3", e.target.value)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary"
            step="0.1"
          />
        </div>
      </div>
    </div>
  );
}
