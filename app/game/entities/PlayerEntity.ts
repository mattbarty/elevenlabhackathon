import { Vector3 } from 'three';
import { Entity } from '../core/Entity';
import { EntityConfig } from '../core/Transform';
import { PlayerMovementComponent } from './PlayerMovementComponent';
import { NPCEntity } from './NPCEntity';
import { EntityManager } from '../core/EntityManager';
import * as THREE from 'three';

export interface PlayerConfig extends EntityConfig {
	speed?: number;
	turnRate?: number;
}

export class PlayerEntity extends Entity {
	private movementComponent: PlayerMovementComponent;
	private static readonly DEFAULT_COMMAND_RADIUS = 5; // Default radius for AOE commands
	private static readonly MAX_SINGLE_TARGET_DISTANCE = 8; // Maximum distance for single targeting
	private aoeIndicator: THREE.Group | null = null;
	private targetLine: THREE.Line | null = null;
	private currentAOERadius: number = 0;
	private pulseTime: number = 0;
	private isAOEMode: boolean = false; // Default to single-target mode

	constructor(config: PlayerConfig = {}) {
		super(config);
		this.movementComponent = this.addComponent(PlayerMovementComponent);
		// Initialize in single-target mode
		this.updateTargetLine();
	}

	public setTargetingMode(isAOE: boolean): void {
		this.isAOEMode = isAOE;
		if (isAOE) {
			this.showAOERadius(
				this.currentAOERadius || PlayerEntity.DEFAULT_COMMAND_RADIUS
			);
			this.hideTargetLine();
		} else {
			this.showAOERadius(null);
			this.updateTargetLine();
		}
	}

	private hideTargetLine(): void {
		if (this.targetLine && this.scene) {
			this.scene.remove(this.targetLine);
			if (this.targetLine.geometry) {
				this.targetLine.geometry.dispose();
			}
			if (this.targetLine.material instanceof THREE.Material) {
				this.targetLine.material.dispose();
			}
			this.targetLine = null;
		}
	}

	private updateTargetLine(): void {
		if (!this.scene) return;

		// Remove existing line
		this.hideTargetLine();

		// Find nearest NPC
		const nearestNPC = this.getNearestNPC();
		if (!nearestNPC) return;

		// Calculate distance
		const distance = this.transform.position.distanceTo(
			nearestNPC.getTransform().position
		);
		if (distance > PlayerEntity.MAX_SINGLE_TARGET_DISTANCE) return;

		// Create line geometry
		const points = [
			this.transform.position.clone(),
			nearestNPC.getTransform().position.clone(),
		];
		const geometry = new THREE.BufferGeometry().setFromPoints(points);

		// Create line material with opacity based on distance
		const opacity = 1 - distance / PlayerEntity.MAX_SINGLE_TARGET_DISTANCE;
		const material = new THREE.LineBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: opacity * 0.6, // Make it a bit more subtle
			depthWrite: false,
			linewidth: 3, // Note: Due to WebGL limitations, this may not work in all browsers
		});

		// Create thicker line using multiple lines
		const lineGroup = new THREE.Group();

		// Create multiple offset lines for thickness effect
		const offsets = [
			new THREE.Vector3(0.02, 0, 0),
			new THREE.Vector3(-0.02, 0, 0),
			new THREE.Vector3(0, 0, 0.02),
			new THREE.Vector3(0, 0, -0.02),
		];

		offsets.forEach((offset) => {
			const offsetPoints = points.map((p) => p.clone().add(offset));
			const offsetGeometry = new THREE.BufferGeometry().setFromPoints(
				offsetPoints
			);
			const line = new THREE.Line(offsetGeometry, material);
			lineGroup.add(line);
		});

		// Create central line
		const centralLine = new THREE.Line(geometry, material);
		lineGroup.add(centralLine);

		this.targetLine = lineGroup as unknown as THREE.Line;
		this.targetLine.position.y = 0.1; // Slightly above ground
		this.scene.add(this.targetLine);
	}

	private getNearestNPC(): NPCEntity | null {
		const npcs = EntityManager.getInstance()
			.getAllEntities()
			.filter((entity): entity is NPCEntity => entity instanceof NPCEntity)
			.filter((npc) => npc.getHealthComponent().getCurrentHealth() > 0);

		if (npcs.length === 0) return null;

		let nearestNPC: NPCEntity | null = null;
		let nearestDistance = Infinity;

		npcs.forEach((npc) => {
			const distance = this.transform.position.distanceTo(
				npc.getTransform().position
			);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestNPC = npc;
			}
		});

		return nearestNPC;
	}

	public getTargetedNPC(): NPCEntity | null {
		if (this.isAOEMode) {
			return null;
		}
		const nearestNPC = this.getNearestNPC();
		if (!nearestNPC) return null;

		const distance = this.transform.position.distanceTo(
			nearestNPC.getTransform().position
		);
		return distance <= PlayerEntity.MAX_SINGLE_TARGET_DISTANCE
			? nearestNPC
			: null;
	}

	public getNPCsInRadius(
		radius: number = PlayerEntity.DEFAULT_COMMAND_RADIUS
	): NPCEntity[] {
		const entityManager = EntityManager.getInstance();
		const npcs = entityManager
			.getAllEntities()
			.filter((entity): entity is NPCEntity => entity instanceof NPCEntity)
			.filter((npc) => {
				const distance = this.transform.position.distanceTo(
					npc.getTransform().position
				);
				return (
					distance <= radius && npc.getHealthComponent().getCurrentHealth() > 0
				);
			});
		return npcs;
	}

	public showAOERadius(radius: number | null): void {
		if (!this.scene) return;

		// Remove existing indicator if it exists
		if (this.aoeIndicator) {
			this.scene.remove(this.aoeIndicator);
			this.aoeIndicator.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material instanceof THREE.Material)
						child.material.dispose();
				}
			});
			this.aoeIndicator = null;
		}

		// If radius is null, we're hiding the indicator
		if (radius === null) {
			this.currentAOERadius = 0;
			return;
		}

		// Create new indicator group
		this.aoeIndicator = new THREE.Group();

		// Create main ring with higher opacity
		const ringGeometry = new THREE.RingGeometry(radius - 0.1, radius, 64);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0.4,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.rotation.x = -Math.PI / 2;
		ring.position.y = 0.1; // Lower to ground

		// Create inner fill with higher opacity
		const fillGeometry = new THREE.CircleGeometry(radius - 0.1, 64);
		const fillMaterial = new THREE.MeshBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0.15, // More subtle fill
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const fill = new THREE.Mesh(fillGeometry, fillMaterial);
		fill.rotation.x = -Math.PI / 2;
		fill.position.y = 0.09;

		// Create outer glow ring with more prominent effect
		const glowGeometry = new THREE.RingGeometry(radius - 0.2, radius + 0.4, 64);
		const glowMaterial = new THREE.MeshBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0.2,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const glow = new THREE.Mesh(glowGeometry, glowMaterial);
		glow.rotation.x = -Math.PI / 2;
		glow.position.y = 0.08;

		// Create shorter vertical walls
		const wallGeometry = new THREE.CylinderGeometry(
			radius,
			radius,
			0.3, // Much shorter walls
			64,
			2, // Fewer segments
			true
		);
		const wallMaterial = new THREE.MeshBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0.1,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const walls = new THREE.Mesh(wallGeometry, wallMaterial);
		walls.position.y = 0.15; // Lower position

		// Add all elements to the group
		this.aoeIndicator.add(ring);
		this.aoeIndicator.add(fill);
		this.aoeIndicator.add(glow);
		this.aoeIndicator.add(walls);

		// Position the group at player's position
		this.aoeIndicator.position.copy(this.transform.position);

		this.scene.add(this.aoeIndicator);
		this.currentAOERadius = radius;
		this.pulseTime = 0;
	}

	update(deltaTime: number): void {
		super.update(deltaTime);

		// Update AOE indicator position and animation if it exists
		if (this.aoeIndicator && this.aoeIndicator.children.length >= 4) {
			// Always update position to match player
			this.aoeIndicator.position.copy(this.transform.position);

			// Animate the indicator with more subtle effects
			this.pulseTime += deltaTime;

			// Update materials with more subtle animations
			this.aoeIndicator.traverse((child) => {
				if (
					child instanceof THREE.Mesh &&
					child.material instanceof THREE.Material &&
					this.aoeIndicator?.children
				) {
					const children = this.aoeIndicator.children;
					if (child === children[0]) {
						// Main ring - gentle pulse
						child.material.opacity = 0.4 + Math.sin(this.pulseTime * 3) * 0.1;
					} else if (child === children[1]) {
						// Fill - very subtle pulse
						child.material.opacity = 0.15 + Math.sin(this.pulseTime * 2) * 0.05;
					} else if (child === children[2]) {
						// Glow - medium speed pulse
						child.material.opacity = 0.2 + Math.sin(this.pulseTime * 2.5) * 0.1;
					} else {
						// Walls - subtle pulse
						child.material.opacity = 0.1 + Math.sin(this.pulseTime * 2) * 0.05;
					}
				}
			});
		}

		// Update target line in single-target mode
		if (!this.isAOEMode) {
			this.updateTargetLine();
		}
	}

	cleanup(): void {
		super.cleanup();
		if (this.aoeIndicator && this.scene) {
			this.scene.remove(this.aoeIndicator);
			this.aoeIndicator.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material instanceof THREE.Material)
						child.material.dispose();
				}
			});
		}
		this.hideTargetLine();
	}

	destroy(): void {
		this.movementComponent.cleanup();
		this.cleanup();
	}
}
