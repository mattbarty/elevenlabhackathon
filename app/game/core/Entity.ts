import { Vector3, Quaternion } from 'three';

let nextEntityId = 1;

export interface EntityConfig {
	position?: Vector3;
	rotation?: Quaternion;
	scale?: Vector3;
}

export interface Transform {
	position: Vector3;
	rotation: Quaternion;
	scale: Vector3;
}

export abstract class Component {
	protected entity: Entity | null = null;

	setEntity(entity: Entity | null) {
		this.entity = entity;
	}

	getEntity(): Entity | null {
		return this.entity;
	}

	abstract update(deltaTime: number): void;
}

export class Entity {
	protected readonly id: number;
	protected components: Map<string, Component>;
	protected transform: Transform;

	constructor(config: EntityConfig = {}) {
		this.id = nextEntityId++;
		this.components = new Map();

		this.transform = {
			position: config.position || new Vector3(0, 0, 0),
			rotation: config.rotation || new Quaternion(),
			scale: config.scale || new Vector3(1, 1, 1),
		};
	}

	getId(): number {
		return this.id;
	}

	getTransform(): Transform {
		return this.transform;
	}

	addComponent<T extends Component>(componentType: { new (): T }): T {
		const component = new componentType();
		component.setEntity(this);
		this.components.set(componentType.name, component);
		return component;
	}

	getComponent<T extends Component>(componentType: {
		new (): T;
	}): T | undefined {
		return this.components.get(componentType.name) as T;
	}

	removeComponent(componentType: { new (): Component }): void {
		const component = this.components.get(componentType.name);
		if (component) {
			component.setEntity(null);
			this.components.delete(componentType.name);
		}
	}

	update(deltaTime: number): void {
		for (const component of this.components.values()) {
			component.update(deltaTime);
		}
	}
}
