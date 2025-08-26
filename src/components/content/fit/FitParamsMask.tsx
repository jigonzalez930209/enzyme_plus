import * as React from "react";

export type FitMask = {
  k1: boolean;
  kMinus3: boolean;
  kMinus1: boolean;
  k2: boolean;
  kMinus2: boolean;
  k3: boolean;
  dt: boolean;
};

export interface FitParamsMaskProps {
  mask: FitMask;
  onToggle: (key: keyof FitMask, checked: boolean) => void;
}

export const FitParamsMask: React.FC<FitParamsMaskProps> = ({
  mask,
  onToggle,
}) => {
  return (
    <div className="grid grid-cols-2 gap-2 pt-2 mt-2 border-t">
      <div className="col-span-2 text-xs font-medium">
        Parámetros a optimizar
      </div>
      {(
        [
          { key: "k1", label: "k1" },
          { key: "kMinus3", label: "k-3" },
          { key: "kMinus1", label: "k-1" },
          { key: "k2", label: "k2" },
          { key: "kMinus2", label: "k-2" },
          { key: "k3", label: "k3" },
          { key: "dt", label: "dt" },
        ] as const
      ).map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={mask[key]}
            onChange={(e) => onToggle(key, e.target.checked)}
          />
          <span>{label}</span>
        </label>
      ))}
      <div className="col-span-2 text-[10px] text-muted-foreground">
        Consejo: deja dt fijo (por defecto) para mayor estabilidad.
      </div>
    </div>
  );
};

export default FitParamsMask;
