import { Vector3 } from 'three';
import { Entity } from '../core/Entity';
import { EntityConfig } from '../core/Transform';
import { PlayerMovementComponent } from './PlayerMovementComponent';

export interface PlayerConfig extends EntityConfig {
	speed?: number;
	turnRate?: number;
}

export class PlayerEntity extends Entity {
	private movementComponent: PlayerMovementComponent;

	constructor(config: PlayerConfig = {}) {
		super(config);
		this.movementComponent = this.addComponent(PlayerMovementComponent);
	}

	cleanup(): void {
		super.cleanup();
	}

	destroy(): void {
		this.movementComponent.cleanup();
	}
}
