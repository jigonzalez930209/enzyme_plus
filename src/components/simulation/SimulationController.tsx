import { useSimulationState, useSimulationActions } from "@/state/useAppStore";
import React from "react";

export function SimulationController() {
  const simulation = useSimulationState();
  const { setSpeed } = useSimulationActions();

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

  return (
    <div className="space-y-1">
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
      <div className="pt-1 mt-2 border-t border-gray-300">
        <div className="flex items-center gap-1">
          <label className="w-8 text-xs">Time:</label>
          <div className="flex items-center flex-1 h-4 px-1 py-0 text-xs border rounded">
            {Math.round(simulation.time)}
          </div>
        </div>
      </div>

      {/* Speed Control */}
      <div className="pt-1 mt-2 border-t border-gray-300">
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
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
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
  );
}
