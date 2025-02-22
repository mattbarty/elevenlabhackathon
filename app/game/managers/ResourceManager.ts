import * as THREE from 'three';
import {
	ResourceType,
	ResourceConfig,
	ResourceProperties,
	DEFAULT_RESOURCE_PROPERTIES,
} from '../types/resources';
import { Entity } from '../core/Entity';
import { EntityManager } from '../core/EntityManager';
import { ResourceEntity } from '../entities/ResourceEntity';
import { TreeResource } from '../entities/TreeResource';
import { StoneResource } from '../entities/StoneResource';

export class ResourceManager {
	private static instance: ResourceManager;
	private resources: Map<number, ResourceEntity>;
	private defaultProperties: Map<ResourceType, ResourceProperties>;

	private constructor() {
		this.resources = new Map();
		this.defaultProperties = new Map(
			Object.entries(DEFAULT_RESOURCE_PROPERTIES) as [
				ResourceType,
				ResourceProperties
			][]
		);
	}

	static getInstance(): ResourceManager {
		if (!ResourceManager.instance) {
			ResourceManager.instance = new ResourceManager();
		}
		return ResourceManager.instance;
	}

	createResource(config: ResourceConfig): ResourceEntity {
		const properties = {
			...this.defaultProperties.get(config.type),
			...config.properties,
		} as ResourceProperties;

		let resource: ResourceEntity;

		switch (config.type) {
			case ResourceType.TREE:
				resource = new TreeResource(config.type, {
					position: config.position,
					properties,
				});
				break;
			case ResourceType.STONE:
				resource = new StoneResource(config.type, {
					position: config.position,
					properties,
				});
				break;
			default:
				throw new Error(`Unknown resource type: ${config.type}`);
		}

		this.resources.set(resource.getId(), resource);
		EntityManager.getInstance().addEntity(resource);

		return resource;
	}

	removeResource(resource: ResourceEntity): void {
		this.resources.delete(resource.getId());
		EntityManager.getInstance().removeEntity(resource);
	}

	getResourcesInRange(
		position: THREE.Vector3,
		range: number
	): ResourceEntity[] {
		const rangeSquared = range * range;
		return Array.from(this.resources.values()).filter((resource) => {
			const resourcePos = resource.getTransform().position;
			return resourcePos.distanceToSquared(position) <= rangeSquared;
		});
	}

	getResourceById(id: number): ResourceEntity | undefined {
		return this.resources.get(id);
	}

	getAllResources(): ResourceEntity[] {
		return Array.from(this.resources.values());
	}

	cleanup(): void {
		this.resources.forEach((resource) => resource.cleanup());
		this.resources.clear();
	}
}
