import * as THREE from 'three';
import { Entity } from '../core/Entity';

export enum NPCProfession {
	VILLAGER = 'Villager',
	GUARD = 'Guard',
}

export interface NPCCombatStats {
	damage: number;
	attackRange: number;
	attackInterval: number;
	knockbackForce: number;
}

export const DEFAULT_COMBAT_STATS: Record<NPCProfession, NPCCombatStats> = {
	[NPCProfession.VILLAGER]: {
		damage: 10,
		attackRange: 1.5,
		attackInterval: 2000, // 2 seconds
		knockbackForce: 0.5,
	},
	[NPCProfession.GUARD]: {
		damage: 25,
		attackRange: 2,
		attackInterval: 1500, // 1.5 seconds
		knockbackForce: 1,
	},
};

export interface NPCConfig {
	name: string;
	profession: NPCProfession;
	position?: THREE.Vector3;
	maxHealth?: number;
	combatStats?: Partial<NPCCombatStats>;
}

export interface NPCState {
	isMoving: boolean;
	isTalking: boolean;
	isAttacking: boolean;
	lastAttackTime: number;
	isHit: boolean;
	hitRecoveryTime: number;
	targetPosition?: THREE.Vector3;
	targetEntity?: Entity;
	currentDialogue?: string;
	dialogueTimeout?: NodeJS.Timeout;
}
