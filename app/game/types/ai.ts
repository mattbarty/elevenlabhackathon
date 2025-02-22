import { Command } from './commands';
import { NPCState } from './npc';
import { ResourceType } from './resources';
import * as THREE from 'three';

export interface CommandContext {
	npcState: NPCState;
	playerPosition: THREE.Vector3;
	nearbyResources: Array<{
		type: ResourceType;
		position: THREE.Vector3;
		health: number;
	}>;
	nearbyNPCs: Array<{
		name: string;
		position: THREE.Vector3;
		profession: string;
		health: number;
	}>;
	completedSteps: string[];
}

export interface GPTFunction {
	name: string;
	description: string;
	parameters: {
		type: string;
		properties: Record<string, any>;
		required: string[];
	};
}

export interface GPTResponse {
	commands: Command[];
	explanation: string;
}

export const NPC_COMMAND_FUNCTIONS: GPTFunction[] = [
	{
		name: 'moveToLocation',
		description: 'Move the NPC to a specific location',
		parameters: {
			type: 'object',
			properties: {
				x: {
					type: 'number',
					description: 'X coordinate',
				},
				z: {
					type: 'number',
					description: 'Z coordinate',
				},
				running: {
					type: 'boolean',
					description: 'Whether to run or walk',
				},
			},
			required: ['x', 'z'],
		},
	},
	{
		name: 'speak',
		description: 'Make the NPC say something',
		parameters: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					description: 'The message to say',
				},
			},
			required: ['message'],
		},
	},
	{
		name: 'attack',
		description: 'Attack a target NPC',
		parameters: {
			type: 'object',
			properties: {
				targetName: {
					type: 'string',
					description: 'Name of the NPC to attack',
				},
			},
			required: ['targetName'],
		},
	},
	{
		name: 'follow',
		description: 'Follow a target NPC or player',
		parameters: {
			type: 'object',
			properties: {
				targetName: {
					type: 'string',
					description: 'Name of the entity to follow',
				},
			},
			required: ['targetName'],
		},
	},
	{
		name: 'stop',
		description: 'Stop all current actions',
		parameters: {
			type: 'object',
			properties: {},
			required: [],
		},
	},
];
