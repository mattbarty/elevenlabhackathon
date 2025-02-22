import React, { useState } from 'react';
import { NPCCommandDebug } from './NPCCommandDebug';

export const GameUI: React.FC = () => {
  const [showCommandDebug, setShowCommandDebug] = useState(false);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Debug Controls */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <button
          onClick={() => setShowCommandDebug(!showCommandDebug)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          {showCommandDebug ? 'Hide Commands' : 'Show Commands'}
        </button>
      </div>

      {/* NPC Command Debug Panel */}
      {showCommandDebug && (
        <div className="pointer-events-auto">
          <NPCCommandDebug onClose={() => setShowCommandDebug(false)} />
        </div>
      )}
    </div>
  );
}; 