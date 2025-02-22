import * as THREE from 'three';

export enum NPCProfession {
	VILLAGER = 'Villager',
	GUARD = 'Guard',
}

export interface NPCConfig {
	name: string;
	profession: NPCProfession;
	position?: THREE.Vector3;
	maxHealth?: number;
}

export interface NPCState {
	isMoving: boolean;
	isTalking: boolean;
	targetPosition?: THREE.Vector3;
	currentDialogue?: string;
	dialogueTimeout?: NodeJS.Timeout;
}
