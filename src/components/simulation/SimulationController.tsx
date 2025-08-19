import { useSimulationState, useSimulationActions } from "@/state/useAppStore";
import React from "react";
import Decimal from "decimal.js";

export function SimulationController() {
  const simulation = useSimulationState();
  const { setSpeed, setParams } = useSimulationActions();

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

  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(event.target.value);
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

  const handleDtChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(event.target.value);
    const newDt = sliderToDt(sliderValue);
    setParams({ dt: new Decimal(newDt) });
  };

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
              {Math.round(simulation.concentrations.S)}
            </div>
          </div>

          {/* Product */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500"></div>
            <label className="w-4 text-xs">P:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(simulation.concentrations.P)}
            </div>
          </div>

          {/* Free Enzyme */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500"></div>
            <label className="w-4 text-xs">E:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(simulation.concentrations.E)}
            </div>
          </div>

          {/* ES Complex */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500"></div>
            <label className="w-4 text-xs">ES:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(simulation.concentrations.ES)}
            </div>
          </div>

          {/* EP Complex */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-500"></div>
            <label className="w-4 text-xs">EP:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(simulation.concentrations.EP)}
            </div>
          </div>
        </div>

        {/* Time Display */}
        <div className="pt-1 mt-2 border-t border-secondary">
          <div className="flex items-center gap-1">
            <label className="w-8 text-xs">Time:</label>
            <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
              {Math.round(simulation.time)}
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
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={dtToSlider(
                  Number(
                    simulation.params.dt?.toNumber?.() ??
                      simulation.params.dt ??
                      1
                  )
                )}
                onChange={handleDtChange}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
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
              <label className="w-12 text-xs">Speed:</label>
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
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={speedToSlider(simulation.speed)}
                onChange={handleSpeedChange}
                className="w-full h-1 rounded-lg appearance-none cursor-pointer bg-secondary slider"
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
      </div>
    </div>
  );
}
