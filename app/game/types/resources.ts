import { Vector3 } from 'three';

export enum ResourceType {
	TREE = 'tree',
	STONE = 'stone',
}

export interface ResourceProperties {
	maxHealth: number;
	currentHealth: number;
	respawnTime: number;
	harvestable: boolean;
}

export interface ResourceConfig {
	type: ResourceType;
	position: Vector3;
	properties?: Partial<ResourceProperties>;
}

export const DEFAULT_RESOURCE_PROPERTIES: Record<
	ResourceType,
	ResourceProperties
> = {
	[ResourceType.TREE]: {
		maxHealth: 100,
		currentHealth: 100,
		respawnTime: 300, // 5 minutes
		harvestable: true,
	},
	[ResourceType.STONE]: {
		maxHealth: 200,
		currentHealth: 200,
		respawnTime: 600, // 10 minutes
		harvestable: true,
	},
};
