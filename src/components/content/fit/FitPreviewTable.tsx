import * as React from "react";

export interface FitPreviewTableProps {
  headers: string[];
  rows: string[][];
  maxRows?: number;
}

export const FitPreviewTable: React.FC<FitPreviewTableProps> = ({
  headers,
  rows,
  maxRows = 8,
}) => {
  return (
    <div className="p-2 mt-2 overflow-auto text-xs border rounded max-h-40">
      <div className="mb-1 font-semibold">Previsualización</div>
      {rows.length > 0 && headers.length > 0 ? (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="py-1 pr-2 text-left border-b">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, maxRows).map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="py-1 pr-2 border-b">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="py-4 text-[11px] text-muted-foreground">
          No hay datos para mostrar. Cargá un archivo CSV/TSV y seleccioná columnas para ver la previsualización.
        </div>
      )}
    </div>
  );
};

export default FitPreviewTable;
