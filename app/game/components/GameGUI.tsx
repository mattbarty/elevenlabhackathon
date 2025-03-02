import React from 'react';
import { useGameContext } from '../context/GameContext';
import { TargetIndicator } from './TargetIndicator';

export function GameGUI() {
  const { timeOfDay, timePeriod, setDebugMode, debugMode } = useGameContext();

  // Convert time (0-24) to formatted string (HH:MM)
  const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.floor((time % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Time Display */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none">
        <div className="flex justify-center mt-6">
          <div className="relative">
            {/* Glowing background effect */}
            <div className="absolute inset-0 bg-white/5 rounded-full blur-xl transform scale-150" />

            {/* Main time display */}
            <div className="relative bg-black/30 backdrop-blur-md rounded-full px-6 py-2 text-center min-w-[160px]
                          border border-white/10 shadow-lg
                          animate-pulse-subtle">
              <div className="text-white/90 font-light tracking-wider text-sm">
                {timePeriod}
              </div>
              <div className="text-white font-mono text-2xl tracking-widest">
                {formatTime(timeOfDay)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Toggle */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <button
          onClick={() => setDebugMode(!debugMode)}
          className={`px-3 py-1 rounded transition-colors ${debugMode ? 'bg-green-500 text-white' : 'bg-black/30 text-gray-300'
            } hover:bg-green-600`}
        >
          Debug Mode
        </button>
      </div>

      {/* Target Indicator */}
      <TargetIndicator />
    </>
  );
} 