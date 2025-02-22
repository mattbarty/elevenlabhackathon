import React, { useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { TargetIndicator } from './TargetIndicator';
import { NPCCommandDebug } from '../../components/NPCCommandDebug';

export function GameGUI() {
  const { timeOfDay, timePeriod } = useGameContext();
  const [showCommandDebug, setShowCommandDebug] = useState(false);

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

      {/* Debug Controls */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <button
          onClick={() => setShowCommandDebug(!showCommandDebug)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          {showCommandDebug ? 'Hide Commands' : 'Show Commands'}
        </button>
      </div>

      {/* Target Indicator */}
      <TargetIndicator />

      {/* NPC Command Debug Panel */}
      {showCommandDebug && (
        <div className="pointer-events-auto">
          <NPCCommandDebug onClose={() => setShowCommandDebug(false)} />
        </div>
      )}
    </>
  );
} 