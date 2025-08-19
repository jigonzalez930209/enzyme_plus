import { useSimulationState, useSimulationActions } from "@/state/useAppStore";
import Decimal from "decimal.js";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export function KineticsForm() {
  const simulation = useSimulationState();
  const { setParams } = useSimulationActions();

  // Local input strings to allow partial typing like "1e-" without breaking
  const [NSStr, setNSStr] = useState(String(simulation.params.NS));
  const [NPStr, setNPStr] = useState(String(simulation.params.NP));
  const [NELStr, setNELStr] = useState(String(simulation.params.NEL));
  const [NESStr, setNESStr] = useState(String(simulation.params.NES));
  const [NEPStr, setNEPStr] = useState(String(simulation.params.NEP));

  const [k1Str, setK1Str] = useState(simulation.params.k1.toString());
  const [kMinus1Str, setKMinus1Str] = useState(
    simulation.params.kMinus1.toString()
  );
  const [k2Str, setK2Str] = useState(simulation.params.k2.toString());
  const [kMinus2Str, setKMinus2Str] = useState(
    simulation.params.kMinus2.toString()
  );
  const [k3Str, setK3Str] = useState(simulation.params.k3.toString());
  const [kMinus3Str, setKMinus3Str] = useState(
    simulation.params.kMinus3.toString()
  );

  // If the external params change (e.g., reset), sync the local strings
  useEffect(() => {
    setNSStr(String(simulation.params.NS));
    setNPStr(String(simulation.params.NP));
    setNELStr(String(simulation.params.NEL));
    setNESStr(String(simulation.params.NES));
    setNEPStr(String(simulation.params.NEP));

    setK1Str(simulation.params.k1.toString());
    setKMinus1Str(simulation.params.kMinus1.toString());
    setK2Str(simulation.params.k2.toString());
    setKMinus2Str(simulation.params.kMinus2.toString());
    setK3Str(simulation.params.k3.toString());
    setKMinus3Str(simulation.params.kMinus3.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulation.params]);

  const commitDecimal = (
    key:
      | "k1"
      | "kMinus1"
      | "k2"
      | "kMinus2"
      | "k3"
      | "kMinus3",
    str: string,
    setStr: (s: string) => void
  ) => {
    try {
      const raw = str.trim();
      const d = new Decimal(raw === "" ? "0" : raw);
      if (!d.isFinite()) throw new Error("non-finite");
      setParams({ [key]: d } as unknown as Partial<typeof simulation.params>);
      setStr(d.toString());
    } catch {
      toast.error("Valor no válido");
      const current = (simulation.params as unknown as Record<string, unknown>)[
        key
      ] as Decimal;
      setStr(current.toString());
    }
  };

  const commitNumber = (
    key: "NS" | "NP" | "NEL" | "NES" | "NEP",
    str: string,
    setStr: (s: string) => void
  ) => {
    const raw = str.trim();
    const n = raw === "" ? 0 : Number(raw);
    if (Number.isFinite(n)) {
      setParams({ [key]: n } as unknown as Partial<typeof simulation.params>);
      setStr(String(n));
    } else {
      toast.error("Valor no válido");
      const current = (simulation.params as unknown as Record<string, unknown>)[
        key
      ] as number;
      setStr(String(current));
    }
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
            type="text"
            inputMode="decimal"
            value={NSStr}
            onChange={(e) => setNSStr(e.target.value)}
            onBlur={() => commitNumber("NS", NSStr, setNSStr)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
          />
        </div>

        {/* Product */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500"></div>
          <label className="w-4 text-xs">P:</label>
          <input
            type="text"
            inputMode="decimal"
            value={NPStr}
            onChange={(e) => setNPStr(e.target.value)}
            onBlur={() => commitNumber("NP", NPStr, setNPStr)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
          />
        </div>

        {/* Free Enzyme */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500"></div>
          <label className="w-4 text-xs">E:</label>
          <input
            type="text"
            inputMode="decimal"
            value={NELStr}
            onChange={(e) => setNELStr(e.target.value)}
            onBlur={() => commitNumber("NEL", NELStr, setNELStr)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
          />
        </div>

        {/* ES Complex */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-yellow-500"></div>
          <label className="w-4 text-xs">ES:</label>
          <input
            type="text"
            inputMode="decimal"
            value={NESStr}
            onChange={(e) => setNESStr(e.target.value)}
            onBlur={() => commitNumber("NES", NESStr, setNESStr)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
          />
        </div>

        {/* EP Complex */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-purple-500"></div>
          <label className="w-4 text-xs">EP:</label>
          <input
            type="text"
            inputMode="decimal"
            value={NEPStr}
            onChange={(e) => setNEPStr(e.target.value)}
            onBlur={() => commitNumber("NEP", NEPStr, setNEPStr)}
            className="flex-1 h-4 px-1 py-0 text-xs border rounded borde-primary"
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
            type="text"
            inputMode="decimal"
            value={k1Str}
            onChange={(e) => setK1Str(e.target.value)}
            onBlur={() => commitDecimal("k1", k1Str, setK1Str)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary "
          />
          <label className="text-xs">k₋₁:</label>
          <input
            type="text"
            inputMode="decimal"
            value={kMinus1Str}
            onChange={(e) => setKMinus1Str(e.target.value)}
            onBlur={() => commitDecimal("kMinus1", kMinus1Str, setKMinus1Str)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary "
          />
        </div>

        {/* k2 */}
        <div className="grid items-center grid-cols-6 gap-1">
          <label className="text-xs">k₂:</label>
          <input
            type="text"
            inputMode="decimal"
            value={k2Str}
            onChange={(e) => setK2Str(e.target.value)}
            onBlur={() => commitDecimal("k2", k2Str, setK2Str)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary "
          />
          <label className="text-xs">k₋₂:</label>
          <input
            type="text"
            inputMode="decimal"
            value={kMinus2Str}
            onChange={(e) => setKMinus2Str(e.target.value)}
            onBlur={() => commitDecimal("kMinus2", kMinus2Str, setKMinus2Str)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary "
          />
        </div>

        {/* k3 */}
        <div className="grid items-center grid-cols-6 gap-1">
          <label className="text-xs">k₃:</label>
          <input
            type="text"
            inputMode="decimal"
            value={k3Str}
            onChange={(e) => setK3Str(e.target.value)}
            onBlur={() => commitDecimal("k3", k3Str, setK3Str)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary"
          />
          <label className="text-xs">k₋₃:</label>
          <input
            type="text"
            inputMode="decimal"
            value={kMinus3Str}
            onChange={(e) => setKMinus3Str(e.target.value)}
            onBlur={() => commitDecimal("kMinus3", kMinus3Str, setKMinus3Str)}
            className="h-4 col-span-2 px-1 py-0 text-xs border rounded border-primary"
          />
        </div>
      </div>
    </div>
  );
}
