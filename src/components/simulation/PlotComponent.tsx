import * as React from "react";
import Plotly from "react-plotly.js";
import { PlotParams } from "react-plotly.js";
import { usePlotState } from "@/state/useAppStore";
import { useTheme } from "@/hooks/use-theme";

type PlotComponentProps = {
  className?: string;
};

// Import types from react-plotly.js
// Use React.memo to prevent unnecessary re-renders
const MemoizedPlotly = React.memo(
  (props: {
    divId: string;
    data: PlotParams["data"];
    layout: PlotParams["layout"];
    config: PlotParams["config"];
    onRelayout: (e: Record<string, unknown>) => void;
    useResizeHandler: boolean;
  }) => {
    return <Plotly {...props} />;
  },
  // Custom comparison function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    // Always re-render if data changes
    if (JSON.stringify(prevProps.data) !== JSON.stringify(nextProps.data)) {
      return false;
    }

    // Compare layout objects
    if (JSON.stringify(prevProps.layout) !== JSON.stringify(nextProps.layout)) {
      return false;
    }

    // Compare config objects
    if (JSON.stringify(prevProps.config) !== JSON.stringify(nextProps.config)) {
      return false;
    }

    // If we got here, props are equal
    return true;
  }
);

MemoizedPlotly.displayName = "MemoizedPlotly";

export function PlotComponent({ className = "" }: PlotComponentProps) {
  const { data, layout, config } = usePlotState();
  const { theme } = useTheme();

  // Store zoom state to prevent reset on data changes
  const [zoomState, setZoomState] = React.useState<Record<string, unknown>>({});

  // Reset zoom when data changes significantly
  React.useEffect(() => {
    if (data.length === 0) {
      setZoomState({});
    }
  }, [data]);

  // Memoize theme-based layout to prevent unnecessary re-renders
  const themedLayout = React.useMemo(() => {
    return {
      ...layout,
      paper_bgcolor: theme === "dark" ? "#1e1e1e" : "#ffffff",
      plot_bgcolor: theme === "dark" ? "#2d2d2d" : "#f5f5f5",
      font: {
        color: theme === "dark" ? "#ffffff" : "#000000",
      },
      xaxis: {
        ...(layout.xaxis || {}),
        gridcolor: theme === "dark" ? "#444444" : "#e0e0e0",
      },
      yaxis: {
        ...(layout.yaxis || {}),
        gridcolor: theme === "dark" ? "#444444" : "#e0e0e0",
      },
      ...zoomState, // Apply stored zoom state
    };
  }, [layout, theme, zoomState]);

  // Memoize config to prevent unnecessary re-renders
  const plotConfig = React.useMemo(() => {
    return {
      responsive: true,
      displayModeBar: true,
      scrollZoom: true,
      staticPlot: false, // Set to true to eliminate flickering but lose interactivity
      ...config,
    };
  }, [config]);

  // Handle zoom/pan events
  const handleRelayout = React.useCallback((e: Record<string, unknown>) => {
    // Only store zoom/pan related properties
    const newZoomState: Record<string, unknown> = {};
    for (const key in e) {
      if (
        key.startsWith("xaxis.") ||
        key.startsWith("yaxis.") ||
        key === "xaxis" ||
        key === "yaxis"
      ) {
        newZoomState[key] = e[key];
      }
    }

    if (Object.keys(newZoomState).length > 0) {
      setZoomState((prev) => ({ ...prev, ...newZoomState }));
    }
  }, []);

  return (
    <div className={`w-full h-full min-h-[400px] ${className}`}>
      <MemoizedPlotly
        divId="enzyme-kinetics-plot"
        data={data}
        layout={themedLayout}
        config={plotConfig}
        onRelayout={handleRelayout}
        useResizeHandler={true}
      />
    </div>
  );
}
