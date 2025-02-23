import * as THREE from 'three';
import { Entity } from '../core/Entity';
import { NPCDialogueConfig } from './dialogue';

export enum NPCProfession {
	VILLAGER = 'Villager',
	GUARD = 'Guard',
}

export interface NPCCombatStats {
	damage: number;
	attackRange: number;
	attackInterval: number;
	knockbackForce: number;
	walkSpeed: number; // Base movement speed
	runSpeed: number; // Speed when running or pursuing in combat
}

export const DEFAULT_COMBAT_STATS: Record<NPCProfession, NPCCombatStats> = {
	[NPCProfession.VILLAGER]: {
		damage: 10,
		attackRange: 1.5,
		attackInterval: 2000, // 2 seconds
		knockbackForce: 0.5,
		walkSpeed: 2,
		runSpeed: 4,
	},
	[NPCProfession.GUARD]: {
		damage: 25,
		attackRange: 2,
		attackInterval: 1500, // 1.5 seconds
		knockbackForce: 1,
		walkSpeed: 2.5,
		runSpeed: 5,
	},
};

export interface NPCConfig {
	name: string;
	profession: NPCProfession;
	position?: THREE.Vector3;
	maxHealth?: number;
	combatStats?: Partial<NPCCombatStats>;
	dialogueConfig?: NPCDialogueConfig;
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
	inCombat: boolean;
	combatTarget?: Entity;
	attackAnimationTime: number;
	isDead: boolean;
	deathTime: number;
	deathAnimationComplete: boolean;
	circlingClockwise: boolean;
	lastDirectionChangeTime: number;
	isRunning: boolean;
	isFollowing: boolean; // Whether the NPC is actively following a target
	followTarget?: Entity; // The entity to follow
	followDistance: number; // How far behind the target to follow
}
