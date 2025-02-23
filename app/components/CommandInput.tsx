import React, { useState, useEffect, useRef } from 'react';
import { Command, CommandResult, ActionType, TargetType } from '../game/types/commands';
import { EntityManager } from '../game/core/EntityManager';
import { NPCEntity } from '../game/entities/NPCEntity';
import { PlayerEntity } from '../game/entities/PlayerEntity';
import * as THREE from 'three';

export const CommandInput: React.FC = () => {
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

            case ActionType.STOP:
              targetNPC.Stop();
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

  if (isLoading) {
    return (
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
        Initializing command system...
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-[600px] flex flex-col items-center gap-2">
      {/* Mode Toggle */}
      <div className="flex items-center gap-4 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2">
        <button
          onClick={() => setIsAOEMode(false)}
          className={`px-3 py-1 rounded ${!isAOEMode ? 'bg-green-500 text-white' : 'text-gray-300'}`}
        >
          Single Target
        </button>
        <button
          onClick={() => setIsAOEMode(true)}
          className={`px-3 py-1 rounded ${isAOEMode ? 'bg-green-500 text-white' : 'text-gray-300'}`}
        >
          AOE ({aoeRadius}m)
        </button>
        {isAOEMode && (
          <input
            type="range"
            min="1"
            max="15"
            value={aoeRadius}
            onChange={(e) => setAOERadius(Number(e.target.value))}
            className="w-32"
          />
        )}
      </div>

      {/* Command Input */}
      <div className="relative w-full flex gap-2">
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendCommand()}
          placeholder={isAOEMode ? "Enter command for all NPCs in range..." : "Enter command for targeted NPC..."}
          className="flex-1 bg-black/40 backdrop-blur-sm text-white px-4 py-3 rounded-lg 
                   border border-white/10 focus:outline-none focus:border-green-500"
          disabled={!player}
        />
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 rounded-lg ${isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
          disabled={!player}
        >
          <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`} />
        </button>
        {error && (
          <div className="absolute -top-8 left-0 right-0 bg-red-500/90 text-white px-3 py-1 rounded text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}; 