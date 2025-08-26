import * as React from "react";

export interface FitSelectorsProps {
  headers: string[];
  colX: string;
  colY: string;
  species: string;
  onChangeX: (v: string) => void;
  onChangeY: (v: string) => void;
  onChangeSpecies: (v: string) => void;
}

export const FitSelectors: React.FC<FitSelectorsProps> = ({
  headers,
  colX,
  colY,
  species,
  onChangeX,
  onChangeY,
  onChangeSpecies,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2">
        <span className="w-20 text-xs">Columna X</span>
        <select
          className="flex-1 px-2 py-1 border rounded bg-background"
          value={colX}
          onChange={(e) => onChangeX(e.target.value)}
        >
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-20 text-xs">Columna Y</span>
        <select
          className="flex-1 px-2 py-1 border rounded bg-background"
          value={colY}
          onChange={(e) => onChangeY(e.target.value)}
        >
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-20 text-xs">Especie</span>
        <select
          className="flex-1 px-2 py-1 border rounded bg-background"
          value={species}
          onChange={(e) => onChangeSpecies(e.target.value)}
        >
          {(["S", "P", "E", "ES", "EP"] as const).map((sp) => (
            <option key={sp} value={sp}>
              {sp}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

export default FitSelectors;
