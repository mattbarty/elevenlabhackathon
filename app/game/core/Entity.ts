import { Component } from './Component';
import { Transform, EntityConfig, TransformUtils } from './Transform';
import * as THREE from 'three';

export class Entity {
	protected readonly id: number;
	protected components: Map<string, Component>;
	protected transform: Transform;
	protected scene: THREE.Scene | null = null;
	private static nextEntityId = 1;

	constructor(config: EntityConfig = {}) {
		this.id = Entity.nextEntityId++;
		this.components = new Map();
		this.transform = TransformUtils.createDefault();

		if (config.position) this.transform.position.copy(config.position);
		if (config.rotation) this.transform.rotation.copy(config.rotation);
		if (config.scale) this.transform.scale.copy(config.scale);
	}

	getId(): number {
		return this.id;
	}

	getTransform(): Transform {
		return this.transform;
	}

	setScene(scene: THREE.Scene): void {
		this.scene = scene;
	}

	getScene(): { scene: THREE.Scene; camera: THREE.Camera } | null {
		if (!this.scene) return null;
		const camera = this.scene.getObjectByProperty(
			'type',
			'PerspectiveCamera'
		) as THREE.Camera;
		return camera ? { scene: this.scene, camera } : null;
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

	cleanup(): void {
		this.components.forEach((component) => component.cleanup());
		this.components.clear();
	}
}
