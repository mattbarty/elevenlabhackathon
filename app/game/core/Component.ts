import { Entity } from './Entity';

export abstract class Component {
	protected entity: Entity | null = null;

	setEntity(entity: Entity | null) {
		this.entity = entity;
	}

	getEntity(): Entity | null {
		return this.entity;
	}

	abstract update(deltaTime: number): void;

	cleanup(): void {}
}
