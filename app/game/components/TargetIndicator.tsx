import React from 'react';
import { useGameContext } from '../context/GameContext';
import { EntityManager } from '../core/EntityManager';
import { ResourceEntity } from '../entities/ResourceEntity';
import { NPCEntity } from '../entities/NPCEntity';
import { HealthComponent } from '../components/HealthComponent';

export function TargetIndicator() {
  const { targetedEntity } = useGameContext();
  const entityManager = EntityManager.getInstance();

  if (!targetedEntity) return null;

  const entity = entityManager.getEntity(targetedEntity);
  if (!(entity instanceof ResourceEntity || entity instanceof NPCEntity)) return null;

  const healthComponent = entity instanceof ResourceEntity ?
    entity.getHealthComponent() :
    entity instanceof NPCEntity ?
      entity.getHealthComponent() : null;

  if (!healthComponent) return null;

  const health = healthComponent.getCurrentHealth();
  const maxHealth = healthComponent.getMaxHealth();
  const healthPercentage = (health / maxHealth) * 100;

  // Get display name based on entity type
  const displayName = entity instanceof ResourceEntity ?
    entity.getType() :
    entity instanceof NPCEntity ?
      `${entity.getName()} (${entity.getProfession()})` : '';

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-none">
      <div className="bg-black/40 backdrop-blur-md rounded-lg p-4 text-center min-w-[200px]
                    border border-white/10 shadow-lg">
        <div className="text-white/90 font-light mb-2">
          {displayName}
        </div>

        {/* Health bar */}
        <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-out rounded-full"
            style={{
              width: `${healthPercentage}%`,
              backgroundColor: getHealthColor(healthPercentage)
            }}
          />
        </div>

        {/* Health numbers */}
        <div className="text-white/80 text-sm mt-1">
          {Math.round(health)} / {Math.round(maxHealth)}
        </div>
      </div>
    </div>
  );
}

function getHealthColor(percentage: number): string {
  if (percentage > 60) return '#2ecc71'; // Green
  if (percentage > 30) return '#f1c40f'; // Yellow
  return '#e74c3c'; // Red
} 