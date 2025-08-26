import * as React from "react";
import Plot from "react-plotly.js";

export interface FitChartProps {
  t?: number[];
  y?: number[];
  model?: number[];
  speciesLabel: string;
  hasOptimized: boolean;
  metrics?: { rmse: number; r2: number } | null;
  simulationParams?: {
    k1: number;
    kMinus3: number;
    kMinus1: number;
    k2: number;
    kMinus2: number;
    k3: number;
    dt?: number;
  } | null;
  isDark: boolean;
}

export const FitChart: React.FC<FitChartProps> = ({
  t,
  y,
  model,
  speciesLabel,
  hasOptimized,
  metrics,
  simulationParams,
  isDark,
}) => {
  const traces: Array<Record<string, unknown>> = [];
  if (t && y && t.length && y.length) {
    traces.push({
      x: t,
      y,
      type: "scatter" as const,
      mode: "markers" as const,
      name: "Datos",
      marker: {
        color: isDark ? "#e5e7eb" : "#111827",
        size: 6,
      },
    });
  }
  if (hasOptimized && t && model && model.length === t.length) {
    traces.push({
      x: t,
      y: model,
      type: "scatter" as const,
      mode: "lines" as const,
      name: `Modelo (${speciesLabel})`,
      line: { color: "#10b981", width: 3 },
    });
  }

  return (
    <div className="md:col-span-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold">
          {hasOptimized && metrics ? (
            <span>
              RMSE={metrics.rmse.toFixed(3)} · R²={metrics.r2.toFixed(3)}
            </span>
          ) : (
            <span className="text-muted-foreground">Sin métricas</span>
          )}
        </div>
        {hasOptimized && simulationParams && (
          <div className="text-[10px] text-muted-foreground">
            <span>
              k1={simulationParams.k1.toString()} · k-3=
              {simulationParams.kMinus3.toString()} · k-1=
              {simulationParams.kMinus1.toString()} · k2=
              {simulationParams.k2.toString()} · k-2=
              {simulationParams.kMinus2.toString()} · k3=
              {simulationParams.k3.toString()} · dt=
              {simulationParams.dt?.toString?.()}
            </span>
          </div>
        )}
      </div>
      <div className="h-[60vh]">
        <Plot
          data={traces}
          layout={{
            autosize: true,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            margin: { l: 40, r: 10, t: 10, b: 40 },
            xaxis: {
              title: { text: "t" },
              color: isDark ? "#e2e8f0" : "#1e293b",
            },
            yaxis: {
              title: { text: "y" },
              color: isDark ? "#e2e8f0" : "#1e293b",
            },
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
        />
      </div>
    </div>
  );
};

export default FitChart;
