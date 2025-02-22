"use client";

// GameContext.tsx
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';

interface GameContextType {
  timeOfDay: number;
  timePeriod: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  lightIntensity: number;
  lightColor: THREE.Color;
  ambientIntensity: number;
}

const GameContext = createContext<GameContextType | null>(null);

export function useGameContext() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}

interface GameProviderProps {
  children: React.ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [timeOfDay, setTimeOfDay] = useState(12); // Start at noon
  const TIME_SCALE = 0.0166666667; // 1 real second = 1 game minute

  // Calculate time period and lighting based on time of day
  const gameState = useMemo(() => {
    // Time period
    let timePeriod: GameContextType['timePeriod'];
    if (timeOfDay >= 5 && timeOfDay < 12) timePeriod = 'Morning';
    else if (timeOfDay >= 12 && timeOfDay < 17) timePeriod = 'Afternoon';
    else if (timeOfDay >= 17 && timeOfDay < 21) timePeriod = 'Evening';
    else timePeriod = 'Night';

    // Light calculations
    let lightIntensity = 0.8; // Default intensity
    let ambientIntensity = 0.6; // Default ambient
    let lightColor = new THREE.Color(0xffffff); // Default color

    // Morning transition (5:00 - 7:00)
    if (timeOfDay >= 5 && timeOfDay < 7) {
      const t = (timeOfDay - 5) / 2;
      lightIntensity = THREE.MathUtils.lerp(0.2, 0.8, t);
      ambientIntensity = THREE.MathUtils.lerp(0.2, 0.6, t);
      lightColor = new THREE.Color(0xff8c44).lerp(new THREE.Color(0xffffff), t);
    }
    // Day (7:00 - 17:00)
    else if (timeOfDay >= 7 && timeOfDay < 17) {
      lightIntensity = 0.8;
      ambientIntensity = 0.6;
      lightColor = new THREE.Color(0xffffff);
    }
    // Evening transition (17:00 - 19:00)
    else if (timeOfDay >= 17 && timeOfDay < 19) {
      const t = (timeOfDay - 17) / 2;
      lightIntensity = THREE.MathUtils.lerp(0.8, 0.2, t);
      ambientIntensity = THREE.MathUtils.lerp(0.6, 0.2, t);
      lightColor = new THREE.Color(0xffffff).lerp(new THREE.Color(0xff8c44), t);
    }
    // Night (19:00 - 5:00)
    else {
      lightIntensity = 0.2;
      ambientIntensity = 0.2;
      lightColor = new THREE.Color(0x4444ff);
    }

    return {
      timeOfDay,
      timePeriod,
      lightIntensity,
      lightColor,
      ambientIntensity,
    };
  }, [timeOfDay]);

  // Update time
  useEffect(() => {
    let lastTime = performance.now();

    const updateTime = () => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      setTimeOfDay(prevTime => (prevTime + deltaTime * TIME_SCALE) % 24);
      requestAnimationFrame(updateTime);
    };

    const animationFrame = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <GameContext.Provider value={gameState}>
      {children}
    </GameContext.Provider>
  );
} 