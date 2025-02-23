import * as THREE from 'three';
import { NPCEntity } from '../entities/NPCEntity';
import { NPCProfession } from '../types/npc';
import { NameGenerator } from './nameGenerator';

export module NPCSpawner {
	const SPAWN_RADIUS = 8; // Maximum radius from center where NPCs can spawn

	export function generateRandomPosition(): THREE.Vector3 {
		const angle = Math.random() * Math.PI * 2;
		const radius = Math.random() * SPAWN_RADIUS;
		return new THREE.Vector3(
			Math.cos(angle) * radius,
			0,
			Math.sin(angle) * radius
		);
	}

	export function spawnRandomNPCs(scene: THREE.Scene): NPCEntity[] {
		const npcs: NPCEntity[] = [];

		// Randomly determine number of guards (1-2)
		const numGuards = Math.floor(Math.random() * 2) + 1;

		// Randomly determine number of villagers (2-3)
		const numVillagers = Math.floor(Math.random() * 2) + 2;

		// Spawn guards
		for (let i = 0; i < numGuards; i++) {
			const npc = new NPCEntity({
				name: NameGenerator.generateRandomName('Guard'),
				profession: NPCProfession.GUARD,
				position: generateRandomPosition(),
			});
			npcs.push(npc);
		}

		// Spawn villagers
		for (let i = 0; i < numVillagers; i++) {
			const npc = new NPCEntity({
				name: NameGenerator.generateRandomName('Villager'),
				profession: NPCProfession.VILLAGER,
				position: generateRandomPosition(),
			});
			npcs.push(npc);
		}

		return npcs;
	}
}
