import React from "react";
import Plotly from "react-plotly.js";
import { useSimulationState } from "@/state/useAppStore";

type PlotProps = {
  exportFileName?: string;
  refreshTrigger?: boolean;
  className?: string;
};

export const PlotComponent = React.forwardRef<HTMLDivElement, PlotProps>(
  (props, ref) => {
    const { className = "" } = props;
    const simulation = useSimulationState();

    // Simple dark mode detection
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

    // Create plot data directly from simulation history
    const plotData = React.useMemo(() => {
      if (simulation.history.length === 0) {
        return [];
      }

      const species = ["S", "P", "E", "ES", "EP"];
      const colors = {
        S: "#3b82f6", // blue
        P: "#ef4444", // red
        E: "#22c55e", // green
        ES: "#f59e0b", // orange
        EP: "#8b5cf6", // purple
      };

      const data = species.map((speciesName) => {
        const x = simulation.history.map((h) => h.time);
        const y = simulation.history.map(
          (h) => h.concentrations[speciesName as keyof typeof h.concentrations]
        );

        return {
          x,
          y,
          type: "scatter" as const,
          mode: "lines" as const,
          name: speciesName,
          line: {
            color: colors[speciesName as keyof typeof colors],
            width: 1,
          },
        };
      });

      return data;
    }, [simulation.history]);

    const layout = React.useMemo(
      () => ({
        title: {
          text: "Enzyme Kinetics Simulation",
          font: { color: isDark ? "#e2e8f0" : "#1e293b" },
        },
        xaxis: {
          title: {
            text: "Time",
            font: {
              color: isDark ? "#e2e8f0" : "#1e293b",
            },
          },
          color: isDark ? "#e2e8f0" : "#1e293b",
          gridcolor: isDark ? "#374151" : "#e5e7eb",
        },
        yaxis: {
          title: {
            text: "Concentration",
            font: {
              color: isDark ? "#e2e8f0" : "#1e293b",
            },
          },
          color: isDark ? "#e2e8f0" : "#1e293b",
          gridcolor: isDark ? "#374151" : "#e5e7eb",
        },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: isDark ? "#e2e8f0" : "#1e293b" },
        autosize: true,
        margin: { l: 60, r: 30, t: 50, b: 50 },
      }),
      [isDark]
    );

    const config = React.useMemo(
      () => ({
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
      }),
      []
    );

    return (
      <div ref={ref} className={`w-full h-full p-2 ${className}`}>
        <Plotly
          data={plotData}
          layout={layout}
          config={config}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
        />
      </div>
    );
  }
);

PlotComponent.displayName = "PlotComponent";
