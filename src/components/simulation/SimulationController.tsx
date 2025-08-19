import { useSimulationState, useSimulationActions } from "@/state/useAppStore";
import React from "react";
import Decimal from "decimal.js";
import { Slider } from "../ui/slider";

export function SimulationController() {
  const simulation = useSimulationState();
  const { setSpeed, setParams, setScrubIndex } = useSimulationActions();

  // Convert speed to logarithmic slider value (0-100)
  // Speed range: 0.01 to 10,000 (log scale) - optimized for fluid simulation
  const speedToSlider = (speed: number) => {
    const logMin = Math.log10(0.1); // -2 (0.01x minimum)
    const logMax = Math.log10(100); // 4 (10,000x maximum)
    const logSpeed = Math.log10(speed);
    return ((logSpeed - logMin) / (logMax - logMin)) * 100;
  };

  // Convert slider value (0-100) to speed
  const sliderToSpeed = (sliderValue: number) => {
    const logMin = Math.log10(0.1); // -2
    const logMax = Math.log10(100); // 4
    const logSpeed = logMin + (sliderValue / 100) * (logMax - logMin);
    return Math.pow(10, logSpeed);
  };

  const handleSpeedSliderChange = (values: number[]) => {
    const sliderValue = values?.[0] ?? 0;
    const newSpeed = sliderToSpeed(sliderValue);
    setSpeed(newSpeed);
  };

  // dt slider (log scale between 1ms and 10s)
  const dtToSlider = (dt: number) => {
    const logMin = Math.log10(0.001); // 1 ms
    const logMax = Math.log10(10); // 10 s
    const logDt = Math.log10(Math.max(0.001, Math.min(10, dt)));
    return ((logDt - logMin) / (logMax - logMin)) * 100;
  };

  const sliderToDt = (sliderValue: number) => {
    const logMin = Math.log10(0.001);
    const logMax = Math.log10(10);
    const logDt = logMin + (sliderValue / 100) * (logMax - logMin);
    return Math.pow(10, logDt);
  };

  const formatDt = (dt: number) => {
    if (dt < 0.01) return `${(dt * 1000).toFixed(1)} ms`;
    if (dt < 1) return `${(dt * 1000).toFixed(0)} ms`;
    if (dt < 10) return `${dt.toFixed(2)} s`;
    return `${dt.toFixed(1)} s`;
  };

  const handleDtSliderChange = (values: number[]) => {
    const sliderValue = values?.[0] ?? 0;
    const newDt = sliderToDt(sliderValue);
    setParams({ dt: new Decimal(newDt) });
  };

  // When paused and scrubbing, show values at the scrubbed index
  const viewIndex =
    simulation.status === "paused" && simulation.scrubIndex != null
      ? Math.min(
          Math.max(0, simulation.scrubIndex),
          Math.max(0, simulation.history.length - 1)
        )
      : null;

  const display = React.useMemo(() => {
    if (viewIndex != null && simulation.history.length > 0) {
      const step = simulation.history[viewIndex];
      return { time: step.time, concentrations: step.concentrations };
    }
    return { time: simulation.time, concentrations: simulation.concentrations };
  }, [viewIndex, simulation.history, simulation.time, simulation.concentrations]);

  // Local state for debounced scrub dispatch (10 ms)
  const [scrubLocal, setScrubLocal] = React.useState<number | null>(null);
  const scrubTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear on leaving paused or when history empties
  React.useEffect(() => {
    if (simulation.status !== "paused" || simulation.history.length === 0) {
      setScrubLocal(null);
      if (scrubTimerRef.current) {
        clearTimeout(scrubTimerRef.current);
        scrubTimerRef.current = null;
      }
    }
  }, [simulation.status, simulation.history.length]);

  // Drop local override once store catches up
  React.useEffect(() => {
    if (
      scrubLocal != null &&
      simulation.scrubIndex != null &&
      simulation.scrubIndex === scrubLocal
    ) {
      setScrubLocal(null);
    }
  }, [simulation.scrubIndex, scrubLocal]);

  React.useEffect(() => {
    return () => {
      if (scrubTimerRef.current) clearTimeout(scrubTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-4 p-4 border rounded border-secondary">
        {/* Current Concentrations Display */}
        <div className="space-y-1">
          {/* Substrate */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500"></div>
            <label className="w-4 text-xs">S:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(display.concentrations.S)}
            </div>
          </div>

          {/* Product */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500"></div>
            <label className="w-4 text-xs">P:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(display.concentrations.P)}
            </div>
          </div>

          {/* Free Enzyme */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500"></div>
            <label className="w-4 text-xs">E:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(display.concentrations.E)}
            </div>
          </div>

          {/* ES Complex */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500"></div>
            <label className="w-4 text-xs">ES:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(display.concentrations.ES)}
            </div>
          </div>

          {/* EP Complex */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500"></div>
            <label className="w-4 text-xs">EP:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(display.concentrations.EP)}
            </div>
          </div>
        </div>

        {/* Time Display */}
        <div className="pt-1 mt-2 border-t border-secondary">
          <div className="flex items-center gap-1">
            <label className="w-12 text-xs">Tiempo:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(display.time)}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 pt-4 border-secondary">
        {/* dt Control */}
        <div className="pt-1 mt-2 border-t border-secondary">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label className="w-12 text-xs">dt:</label>
              <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
                {formatDt(
                  Number(
                    simulation.params.dt?.toNumber?.() ??
                      simulation.params.dt ??
                      1
                  )
                )}
              </div>
            </div>
            <div className="px-1">
              <Slider
                min={0}
                max={100}
                step={0.1}
                value={[
                  dtToSlider(
                    Number(
                      simulation.params.dt?.toNumber?.() ??
                        simulation.params.dt ??
                        1
                    )
                  ),
                ]}
                onValueChange={handleDtSliderChange}
                className="w-full"
              />
              <div className="flex items-center justify-between mt-1 text-xs text-center text-gray-500">
                <span>1ms</span>
                <span>10s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Speed Control */}
        <div className="pt-1 mt-2 border-t border-secondary">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label className="w-16 text-xs">Velocidad:</label>
              <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
                {simulation.speed < 0.001
                  ? `${(simulation.speed * 1000000).toFixed(1)}µx`
                  : simulation.speed < 0.1
                  ? `${(simulation.speed * 1000).toFixed(1)}mx`
                  : simulation.speed < 1
                  ? `${simulation.speed.toFixed(2)}x`
                  : simulation.speed >= 1000000
                  ? `${(simulation.speed / 1000000).toFixed(1)}Mx`
                  : simulation.speed >= 1000
                  ? `${(simulation.speed / 1000).toFixed(1)}kx`
                  : `${simulation.speed.toFixed(1)}x`}
              </div>
            </div>
            <div className="px-1">
              <Slider
                min={0}
                max={100}
                step={0.1}
                value={[speedToSlider(simulation.speed)]}
                onValueChange={handleSpeedSliderChange}
                className="w-full"
              />
              <div className="flex items-center justify-between mt-1 text-xs text-center text-gray-500">
                <span className="w-4">0.1x</span>
                <span className="w-4">1x</span>
                <span className="w-4">10x</span>
                <span className="w-4">100x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Scrubber (always visible; disabled when no pausa) */}
        <div className="pt-1 mt-2 border-t border-secondary">
          <div className="space-y-1 px-1">
            <div className="flex items-center gap-2">
              <label className="text-xs whitespace-nowrap">Vista temporal</label>
              <Slider
                min={0}
                max={Math.max(0, simulation.history.length - 1)}
                step={1}
                value={[(function () {
                  const lastIndex = Math.max(0, simulation.history.length - 1);
                  if (scrubLocal != null) return Math.min(Math.max(0, scrubLocal), lastIndex);
                  if (simulation.scrubIndex != null)
                    return Math.min(Math.max(0, simulation.scrubIndex), lastIndex);
                  return lastIndex;
                })()]}
                onValueChange={(values) => {
                  const raw = values?.[0];
                  if (Number.isFinite(raw)) {
                    const lastIndex = Math.max(0, simulation.history.length - 1);
                    const clamped = Math.min(Math.max(0, Number(raw)), lastIndex);
                    setScrubLocal(clamped);
                    if (scrubTimerRef.current) clearTimeout(scrubTimerRef.current);
                    scrubTimerRef.current = setTimeout(() => {
                      setScrubIndex(clamped);
                    }, 10);
                  }
                }}
                disabled={simulation.history.length === 0 || simulation.status !== "paused"}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                t=
                {(function () {
                  const lastIndex = Math.max(0, simulation.history.length - 1);
                  const idx =
                    scrubLocal != null
                      ? Math.min(Math.max(0, scrubLocal), lastIndex)
                      : simulation.scrubIndex != null
                      ? Math.min(Math.max(0, simulation.scrubIndex), lastIndex)
                      : lastIndex;
                  return simulation.history[idx]?.time?.toFixed?.(0) ?? 0;
                })()}
                s
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span>
              <span>{Math.max(0, simulation.history.length - 1)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
