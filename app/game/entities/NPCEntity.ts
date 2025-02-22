import * as THREE from 'three';
import { Entity } from '../core/Entity';
import { NPCConfig, NPCProfession, NPCState } from '../types/npc';
import { HealthComponent } from '../components/HealthComponent';
import { createPawnVisuals, createRookVisuals } from './ChessPieceVisuals';

export class NPCEntity extends Entity {
	private name: string;
	private profession: NPCProfession;
	private healthComponent: HealthComponent;
	private state: NPCState;
	private mesh!: THREE.Group;
	private nameplate!: THREE.Sprite;
	private nameplateTexture!: THREE.Texture;
	private nameplateCanvas!: HTMLCanvasElement;
	private nameplateContext!: CanvasRenderingContext2D;

	constructor(config: NPCConfig) {
		super({ position: config.position });

		this.name = config.name;
		this.profession = config.profession;

		// Initialize health component
		this.healthComponent = new HealthComponent({
			maxHealth: config.maxHealth ?? 100,
			currentHealth: config.maxHealth ?? 100,
		});
		this.healthComponent.setEntity(this);

		// Initialize state
		this.state = {
			isMoving: false,
			isTalking: false,
		};

		// Create visual representation
		this.createVisuals();
		this.createNameplate();
	}

	private createVisuals(): void {
		this.mesh = new THREE.Group();

		// Create the appropriate chess piece based on profession
		const visuals =
			this.profession === NPCProfession.VILLAGER
				? createPawnVisuals()
				: createRookVisuals();

		// Add the visuals to the mesh group
		this.mesh.add(visuals);

		// Position the mesh and set up shadows
		this.mesh.position.copy(this.transform.position);
		this.mesh.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.castShadow = true;
				child.receiveShadow = true;
			}
		});
	}

	private createNameplate(): void {
		// Create canvas for nameplate
		this.nameplateCanvas = document.createElement('canvas');
		this.nameplateCanvas.width = 256;
		this.nameplateCanvas.height = 64;
		this.nameplateContext = this.nameplateCanvas.getContext('2d')!;

		// Create sprite material using canvas texture
		this.nameplateTexture = new THREE.Texture(this.nameplateCanvas);
		const spriteMaterial = new THREE.SpriteMaterial({
			map: this.nameplateTexture,
			depthTest: false,
			transparent: true,
		});
		this.nameplate = new THREE.Sprite(spriteMaterial);
		this.nameplate.scale.set(2, 0.5, 1);
		this.nameplate.position.y = 2;

		// Add nameplate to mesh
		this.mesh.add(this.nameplate);
		this.updateNameplate();
	}

	private updateNameplate(): void {
		const ctx = this.nameplateContext;
		ctx.clearRect(
			0,
			0,
			this.nameplateCanvas.width,
			this.nameplateCanvas.height
		);

		// Set text style
		ctx.textAlign = 'center';
		ctx.fillStyle = 'white';
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 3;

		// Draw name
		ctx.font = 'bold 24px Arial';
		ctx.strokeText(this.name, 128, 24);
		ctx.fillText(this.name, 128, 24);

		// Draw profession
		ctx.font = '18px Arial';
		ctx.strokeText(`<${this.profession}>`, 128, 48);
		ctx.fillText(`<${this.profession}>`, 128, 48);

		// Update texture
		this.nameplateTexture.needsUpdate = true;
	}

	public MoveTo(position: THREE.Vector3): void {
		this.state.isMoving = true;
		this.state.targetPosition = position.clone();
		// Movement logic will be handled in update()
	}

	public Say(message: string, duration: number = 3000): void {
		// Clear any existing dialogue timeout
		if (this.state.dialogueTimeout) {
			clearTimeout(this.state.dialogueTimeout);
		}

		this.state.isTalking = true;
		this.state.currentDialogue = message;

		// Create a speech bubble or update nameplate with dialogue
		// For now, we'll just log it
		console.log(`${this.name} says: ${message}`);

		// Clear the dialogue after duration
		this.state.dialogueTimeout = setTimeout(() => {
			this.state.isTalking = false;
			this.state.currentDialogue = undefined;
		}, duration);
	}

	public getMesh(): THREE.Group {
		return this.mesh;
	}

	public getName(): string {
		return this.name;
	}

	public getProfession(): NPCProfession {
		return this.profession;
	}

	update(deltaTime: number): void {
		super.update(deltaTime);

		// Handle movement if we have a target position
		if (this.state.isMoving && this.state.targetPosition) {
			const direction = this.state.targetPosition
				.clone()
				.sub(this.transform.position);
			const distance = direction.length();

			if (distance > 0.1) {
				// Move towards target
				direction.normalize();
				const moveSpeed = 2 * deltaTime; // 2 units per second
				const movement = direction.multiplyScalar(moveSpeed);

				this.transform.position.add(movement);
				this.mesh.position.copy(this.transform.position);

				// Rotate to face movement direction
				this.mesh.lookAt(this.state.targetPosition);
			} else {
				// Reached target
				this.state.isMoving = false;
				this.state.targetPosition = undefined;
			}
		}

		// Make nameplate face camera
		const sceneData = this.getScene();
		if (sceneData?.camera) {
			this.nameplate.quaternion.copy(sceneData.camera.quaternion);
		}
	}

	cleanup(): void {
		super.cleanup();

		// Clean up timeouts
		if (this.state.dialogueTimeout) {
			clearTimeout(this.state.dialogueTimeout);
		}

		// Clean up Three.js resources
		if (this.nameplateTexture) {
			this.nameplateTexture.dispose();
		}
		this.mesh.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.geometry.dispose();
				if (Array.isArray(child.material)) {
					child.material.forEach((m) => m.dispose());
				} else {
					child.material.dispose();
				}
			}
		});
	}
}
