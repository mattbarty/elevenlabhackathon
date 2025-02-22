import { Entity } from './Entity';

export class EntityManager {
	private static instance: EntityManager;
	private entities: Map<number, Entity>;
	private entitiesToAdd: Entity[];
	private entitiesToRemove: Entity[];

	private constructor() {
		this.entities = new Map();
		this.entitiesToAdd = [];
		this.entitiesToRemove = [];
	}

	static getInstance(): EntityManager {
		if (!EntityManager.instance) {
			EntityManager.instance = new EntityManager();
		}
		return EntityManager.instance;
	}

	addEntity(entity: Entity): void {
		this.entitiesToAdd.push(entity);
	}

	removeEntity(entity: Entity): void {
		this.entitiesToRemove.push(entity);
	}

	getEntity(id: number): Entity | undefined {
		return this.entities.get(id);
	}

	getAllEntities(): Entity[] {
		return Array.from(this.entities.values());
	}

	update(deltaTime: number): void {
		// Process additions
		while (this.entitiesToAdd.length > 0) {
			const entity = this.entitiesToAdd.pop()!;
			this.entities.set(entity.getId(), entity);
		}

		// Update all entities
		this.entities.forEach((entity) => entity.update(deltaTime));

		// Process removals
		while (this.entitiesToRemove.length > 0) {
			const entity = this.entitiesToRemove.pop()!;
			entity.cleanup();
			this.entities.delete(entity.getId());
		}
	}

	cleanup(): void {
		this.entities.forEach((entity) => entity.cleanup());
		this.entities.clear();
		this.entitiesToAdd = [];
		this.entitiesToRemove = [];
	}
}
