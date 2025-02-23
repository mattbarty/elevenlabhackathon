import React, { useState, useEffect, useRef } from 'react';
import { Command, CommandResult, ActionType, TargetType } from '../game/types/commands';
import { EntityManager } from '../game/core/EntityManager';
import { NPCEntity } from '../game/entities/NPCEntity';
import { PlayerEntity } from '../game/entities/PlayerEntity';
import { useGameContext } from '../game/context/GameContext';
import * as THREE from 'three';

export const CommandInput: React.FC = () => {
  const { debugMode } = useGameContext();
  const [commandInput, setCommandInput] = useState('');
  const [isAOEMode, setIsAOEMode] = useState(false);
  const [aoeRadius, setAOERadius] = useState(5);
  const [player, setPlayer] = useState<PlayerEntity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Initialize player reference with retry mechanism
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    const retryInterval = 500; // 500ms between retries

    const initializePlayer = () => {
      const entityManager = EntityManager.getInstance();
      const playerEntity = entityManager.getAllEntities()
        .find((entity): entity is PlayerEntity => entity instanceof PlayerEntity);

      if (playerEntity) {
        setPlayer(playerEntity);
        playerEntity.setTargetingMode(false); // Start in single-target mode
        setIsLoading(false);
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(initializePlayer, retryInterval);
      } else {
        setError('Could not initialize player. Please refresh the page.');
        setIsLoading(false);
      }
    };

    initializePlayer();
  }, []);

  // Update targeting mode when it changes
  useEffect(() => {
    if (player) {
      player.showAOERadius(isAOEMode ? aoeRadius : null);
      player.setTargetingMode(isAOEMode);
    }
  }, [isAOEMode, aoeRadius, player]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleAudioTranscription(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone');
      setTimeout(() => setError(null), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioTranscription = async (audioBlob: Blob) => {
    try {
      // Create form data with audio file
      const formData = new FormData();
      formData.append('audio', audioBlob);

      // Send to transcription API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to transcribe audio');
      }

      // Set the transcribed text as command input and send it
      setCommandInput(data.text);
      await sendCommand(data.text);
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Failed to transcribe audio');
      setTimeout(() => setError(null), 3000);
    }
  };

  const sendCommand = async (text?: string) => {
    try {
      setError(null);
      const commandToSend = text || commandInput;

      if (!player) {
        throw new Error('Please wait for player initialization');
      }

      const entityManager = EntityManager.getInstance();

      // Get target NPCs based on mode
      const targetNPCs = isAOEMode
        ? player.getNPCsInRadius(aoeRadius)
        : [player.getTargetedNPC()].filter((npc): npc is NPCEntity => npc !== null);

      if (targetNPCs.length === 0) {
        throw new Error(isAOEMode ? 'No NPCs in range' : 'No NPC targeted');
      }

      // Execute command for each target NPC
      for (const targetNPC of targetNPCs) {
        // Gather context about the game world
        const nearbyNPCs = targetNPC.getNPCsByDistance()
          .map(({ entity }) => ({
            name: entity.getName(),
            position: entity.getTransform().position,
            profession: entity.getProfession(),
            health: entity.getHealthComponent().getCurrentHealth(),
          }));

        const nearbyResources = targetNPC.getResourcesByDistance()
          .map(({ entity }) => ({
            type: entity.getType(),
            position: entity.getTransform().position,
            health: entity.getHealthComponent().getCurrentHealth(),
          }));

        // Send to GPT interpreter
        const response = await fetch('/api/npc/command/gpt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            command: commandToSend,
            context: {
              npcState: {
                name: targetNPC.getName(),
                profession: targetNPC.getProfession(),
                position: targetNPC.getTransform().position,
                health: targetNPC.getHealthComponent().getCurrentHealth(),
              },
              playerPosition: player.getTransform().position,
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
                targetNPC.MoveTo(
                  new THREE.Vector3(command.target.x, 0, command.target.z),
                  command.action === ActionType.RUN
                );
                const checkPosition = setInterval(() => {
                  const distance = targetNPC.getTransform().position
                    .distanceTo(new THREE.Vector3(command.target!.x, 0, command.target!.z));
                  if (distance < 1) {
                    clearInterval(checkPosition);
                    waitForNextCommand();
                  }
                }, 100);
              } else if (command.target?.type === TargetType.NPC) {
                const targetNPCEntity = entityManager.getAllEntities()
                  .find((entity): entity is NPCEntity =>
                    entity instanceof NPCEntity &&
                    entity.getName() === command.target?.npcName
                  );
                if (targetNPCEntity) {
                  targetNPC.MoveTo(targetNPCEntity);
                  waitForNextCommand();
                }
              }
              break;

            case ActionType.SPEAK:
              if (command.message) {
                targetNPC.Say(command.message);
                setTimeout(() => waitForNextCommand(), 3000);
              }
              break;

            case ActionType.ATTACK:
              if (command.target?.type === TargetType.NPC) {
                const targetNPCEntity = entityManager.getAllEntities()
                  .find((entity): entity is NPCEntity =>
                    entity instanceof NPCEntity &&
                    entity.getName() === command.target?.npcName
                  );
                if (targetNPCEntity) {
                  targetNPC.engageInCombat(targetNPCEntity);
                  setTimeout(() => waitForNextCommand(), 2000);
                }
              }
              break;

            case ActionType.FOLLOW:
              if (command.target?.type === TargetType.NPC) {
                const targetNPCEntity = entityManager.getAllEntities()
                  .find((entity): entity is NPCEntity =>
                    entity instanceof NPCEntity &&
                    entity.getName() === command.target?.npcName
                  );
                if (targetNPCEntity) {
                  targetNPC.MoveTo(targetNPCEntity);
                  setTimeout(() => waitForNextCommand(), 1000);
                }
              }
              break;

            case ActionType.GATHER_WOOD:
              targetNPC.startGatheringWood();
              waitForNextCommand();
              break;

            case ActionType.STOP:
              targetNPC.Stop();
              targetNPC.stopGatheringWood();
              waitForNextCommand();
              break;
          }
        };

        // Start executing commands
        executeCommands(gptResult.commands);
      }

      // Clear input on success
      setCommandInput('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send command');
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-[600px] flex flex-col items-center gap-6">
      {/* Error Message */}
      {error && (
        <div className="absolute -top-12 left-0 right-0">
          <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-center mx-auto max-w-md">
            {error}
          </div>
        </div>
      )}

      {/* Main Microphone Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-24 h-24 rounded-full shadow-lg transition-all transform
          ${isRecording
            ? 'bg-red-500 hover:bg-red-600 scale-110'
            : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
          } text-white flex items-center justify-center`}
        disabled={!player}
      >
        <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'} text-3xl`} />
      </button>

      {/* Mode Toggle - Always visible */}
      <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1 border border-white/10">
        <button
          onClick={() => setIsAOEMode(false)}
          className={`px-4 py-1.5 rounded-full transition-colors
            ${!isAOEMode ? 'bg-green-500 text-white' : 'text-gray-300 hover:text-white'}`}
        >
          Single Target
        </button>
        <button
          onClick={() => setIsAOEMode(true)}
          className={`px-4 py-1.5 rounded-full transition-colors flex items-center gap-2
            ${isAOEMode ? 'bg-green-500 text-white' : 'text-gray-300 hover:text-white'}`}
        >
          <span>AOE</span>
          {isAOEMode && <span className="text-sm opacity-80">{aoeRadius}m</span>}
        </button>
      </div>

      {/* AOE Radius Slider - Show when AOE mode is active */}
      {isAOEMode && (
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
          <input
            type="range"
            min="1"
            max="15"
            value={aoeRadius}
            onChange={(e) => setAOERadius(Number(e.target.value))}
            className="w-32"
          />
        </div>
      )}

      {/* Debug Input - Only show in debug mode */}
      {debugMode && (
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendCommand()}
          placeholder={isAOEMode ? "Enter command for all NPCs in range..." : "Enter command for targeted NPC..."}
          className="w-full bg-black/40 backdrop-blur-sm text-white px-6 py-3 rounded-full
                   border border-white/10 focus:outline-none focus:border-green-500
                   placeholder:text-white/50"
          disabled={!player}
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 bottom-0 bg-black/40 backdrop-blur-sm
                      flex items-center justify-center rounded-lg">
          <div className="text-white">Initializing command system...</div>
        </div>
      )}
    </div>
  );
}; 