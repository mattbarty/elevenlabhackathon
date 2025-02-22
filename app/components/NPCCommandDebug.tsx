import React, { useState, useEffect } from 'react';
import { Command, CommandResult, ActionType, TargetType } from '../game/types/commands';
import { EntityManager } from '../game/core/EntityManager';
import { NPCEntity } from '../game/entities/NPCEntity';
import * as THREE from 'three';

interface NPCCommandDebugProps {
  onClose: () => void;
}

export const NPCCommandDebug: React.FC<NPCCommandDebugProps> = ({ onClose }) => {
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<CommandResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedNPC, setSelectedNPC] = useState<string>('');
  const [npcs, setNPCs] = useState<NPCEntity[]>([]);

  // Fetch available NPCs
  useEffect(() => {
    const entityManager = EntityManager.getInstance();
    const availableNPCs = entityManager.getAllEntities()
      .filter((entity): entity is NPCEntity => entity instanceof NPCEntity);
    setNPCs(availableNPCs);
    if (availableNPCs.length > 0) {
      setSelectedNPC(availableNPCs[0].getName());
    }
  }, []);

  const sendCommand = async () => {
    try {
      setError(null);

      const entityManager = EntityManager.getInstance();
      const selectedNPCEntity = entityManager.getAllEntities()
        .find((entity): entity is NPCEntity =>
          entity instanceof NPCEntity &&
          entity.getName() === selectedNPC
        );

      if (!selectedNPCEntity) {
        throw new Error(`Selected NPC ${selectedNPC} not found`);
      }

      // Gather context about the game world
      const playerEntity = entityManager.getAllEntities()
        .find(entity => entity.constructor.name === 'PlayerEntity');

      const nearbyNPCs = selectedNPCEntity.getNPCsByDistance()
        .map(({ entity, distance }) => ({
          name: entity.getName(),
          position: entity.getTransform().position,
          profession: entity.getProfession(),
          health: entity.getHealthComponent().getCurrentHealth(),
        }));

      const nearbyResources = selectedNPCEntity.getResourcesByDistance()
        .map(({ entity, distance }) => ({
          type: entity.getType(),
          position: entity.getTransform().position,
          health: entity.getHealthComponent().getCurrentHealth(),
        }));

      // First, send to GPT interpreter
      const response = await fetch('/api/npc/command/gpt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: commandInput,
          context: {
            npcState: {
              name: selectedNPC,
              profession: selectedNPCEntity.getProfession(),
              position: selectedNPCEntity.getTransform().position,
              health: selectedNPCEntity.getHealthComponent().getCurrentHealth(),
            },
            playerPosition: playerEntity?.getTransform().position || new THREE.Vector3(0, 0, 0),
            nearbyResources,
            nearbyNPCs,
            completedSteps: [],
          },
        }),
      });

      const gptResult = await response.json();

      if (!response.ok) {
        throw new Error(gptResult.error || 'Failed to interpret command');
      }

      // Execute commands sequentially
      const executeCommands = async (commands: Command[], currentIndex: number = 0) => {
        if (currentIndex >= commands.length) return;

        const command = commands[currentIndex];
        const waitForNextCommand = () => {
          setTimeout(() => executeCommands(commands, currentIndex + 1), 500);
        };

        // Execute command directly on NPC
        switch (command.action) {
          case ActionType.MOVE:
          case ActionType.RUN:
          case ActionType.WALK:
            if (command.target?.type === TargetType.LOCATION) {
              selectedNPCEntity.MoveTo(
                new THREE.Vector3(command.target.x, 0, command.target.z),
                command.action === ActionType.RUN
              );
              // Wait for NPC to get close to target before next command
              const checkPosition = setInterval(() => {
                const distance = selectedNPCEntity.getTransform().position
                  .distanceTo(new THREE.Vector3(command.target!.x, 0, command.target!.z));
                if (distance < 1) {
                  clearInterval(checkPosition);
                  waitForNextCommand();
                }
              }, 100);
            } else if (command.target?.type === TargetType.NPC) {
              const targetNPC = entityManager.getAllEntities()
                .find((entity): entity is NPCEntity =>
                  entity instanceof NPCEntity &&
                  entity.getName() === command.target?.npcName
                );
              if (targetNPC) {
                selectedNPCEntity.MoveTo(targetNPC);
                // Wait a bit before next command when following an NPC
                waitForNextCommand();
              }
            }
            break;

          case ActionType.SPEAK:
            if (command.message) {
              selectedNPCEntity.Say(command.message);
              // Wait for speech duration before next command
              setTimeout(() => waitForNextCommand(), 3000);
            }
            break;

          case ActionType.ATTACK:
            if (command.target?.type === TargetType.NPC) {
              const targetNPC = entityManager.getAllEntities()
                .find((entity): entity is NPCEntity =>
                  entity instanceof NPCEntity &&
                  entity.getName() === command.target?.npcName
                );
              if (targetNPC) {
                selectedNPCEntity.engageInCombat(targetNPC);
                // Combat is ongoing, wait a bit before next command
                setTimeout(() => waitForNextCommand(), 2000);
              }
            }
            break;

          case ActionType.FOLLOW:
            if (command.target?.type === TargetType.NPC) {
              const targetNPC = entityManager.getAllEntities()
                .find((entity): entity is NPCEntity =>
                  entity instanceof NPCEntity &&
                  entity.getName() === command.target?.npcName
                );
              if (targetNPC) {
                selectedNPCEntity.MoveTo(targetNPC);
                // Following is ongoing, wait a bit before next command
                setTimeout(() => waitForNextCommand(), 1000);
              }
            }
            break;

          case ActionType.STOP:
            selectedNPCEntity.Stop();
            // Stop is immediate, proceed to next command
            waitForNextCommand();
            break;
        }
      };

      // Start executing commands
      executeCommands(gptResult.commands);

      // Add to command history
      setCommandHistory(prev => [{
        success: true,
        command: gptResult.commands[0],
        message: `Executing ${gptResult.commands.length} commands: ${gptResult.explanation}`,
        executionId: Date.now().toString(),
      }, ...prev].slice(0, 10));

      // Clear input on success
      setCommandInput('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send command');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg w-96">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">NPC Command Debug</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* NPC Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select NPC:</label>
        <select
          value={selectedNPC}
          onChange={(e) => setSelectedNPC(e.target.value)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
        >
          {npcs.map((npc) => (
            <option key={npc.getId()} value={npc.getName()}>
              {npc.getName()} ({npc.getProfession()})
            </option>
          ))}
        </select>
      </div>

      {/* Command Help */}
      <div className="mb-4 text-xs text-gray-400">
        <p>Commands:</p>
        <ul className="list-disc list-inside">
          <li>"move to x, z" - Move to coordinates</li>
          <li>"attack [npc name]" - Attack target</li>
          <li>"follow [npc name]" - Follow target</li>
          <li>Any other text - Say message</li>
        </ul>
      </div>

      {/* Command Input */}
      <div className="mb-4">
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendCommand()}
          placeholder="Enter command..."
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
        />
        <button
          onClick={sendCommand}
          className="mt-2 bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded w-full"
        >
          Send Command
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-500 text-white rounded">
          {error}
        </div>
      )}

      <div className="max-h-60 overflow-y-auto">
        <h3 className="font-bold mb-2">Command History:</h3>
        {commandHistory.map((result, index) => (
          <div
            key={index}
            className={`mb-2 p-2 rounded ${result.success ? 'bg-green-800' : 'bg-red-800'
              }`}
          >
            <div className="font-bold">
              {result.success ? 'Success' : 'Failed'}
            </div>
            <div className="text-sm">
              To: {result.command.targetNpcName}
              <br />
              Action: {result.command.action}
              {result.command.message && ` - "${result.command.message}"`}
              {result.command.target && (
                <>
                  <br />
                  Target: {JSON.stringify(result.command.target)}
                </>
              )}
            </div>
            {result.executionId && (
              <div className="text-xs text-gray-400">
                ID: {result.executionId}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}; 