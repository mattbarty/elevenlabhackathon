import * as THREE from 'three';
import { Entity } from '../core/Entity';
import { NPCConfig, NPCProfession, NPCState } from '../types/npc';
import { HealthComponent } from '../components/HealthComponent';
import { HealthBarComponent } from '../components/HealthBarComponent';
import { createPawnVisuals, createRookVisuals } from './ChessPieceVisuals';
import { ResourceEntity } from './ResourceEntity';
import { ResourceType } from '../types/resources';
import { EntityManager } from '../core/EntityManager';
import { PlayerEntity } from './PlayerEntity';

export class NPCEntity extends Entity {
	private name: string;
	private profession: NPCProfession;
	private healthComponent: HealthComponent;
	private healthBarComponent: HealthBarComponent;
	private state: NPCState = {
		isMoving: false,
		isTalking: false,
	};
	private mesh!: THREE.Group;
	private baseMesh!: THREE.Group;
	private nameplate!: THREE.Sprite;
	private nameplateTexture!: THREE.Texture;
	private nameplateCanvas!: HTMLCanvasElement;
	private nameplateContext!: CanvasRenderingContext2D;
	private speechBubble!: THREE.Sprite;
	private speechBubbleTexture!: THREE.Texture;
	private speechBubbleCanvas!: HTMLCanvasElement;
	private speechBubbleContext!: CanvasRenderingContext2D;
	private isTargeted: boolean = false;

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

		// Initialize health bar component
		this.healthBarComponent = new HealthBarComponent(this.healthComponent);
		this.healthBarComponent.setEntity(this);

		// Create visual representation
		this.createVisuals();
		this.createNameplate();
		this.createSpeechBubble();
	}

	private createVisuals(): void {
		this.mesh = new THREE.Group();
		this.baseMesh = new THREE.Group();

		// Create the appropriate chess piece based on profession
		const visuals =
			this.profession === NPCProfession.VILLAGER
				? createPawnVisuals()
				: createRookVisuals();

		// Add the visuals to the base mesh group
		this.baseMesh.add(visuals);
		this.mesh.add(this.baseMesh);

		// Position the mesh and set up shadows
		this.mesh.position.copy(this.transform.position);
		this.baseMesh.traverse((child) => {
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

	private createSpeechBubble(): void {
		// Create canvas for speech bubble
		this.speechBubbleCanvas = document.createElement('canvas');
		this.speechBubbleCanvas.width = 512; // Larger canvas for better text quality
		this.speechBubbleCanvas.height = 256;
		this.speechBubbleContext = this.speechBubbleCanvas.getContext('2d')!;

		// Create sprite material using canvas texture
		this.speechBubbleTexture = new THREE.Texture(this.speechBubbleCanvas);
		const spriteMaterial = new THREE.SpriteMaterial({
			map: this.speechBubbleTexture,
			depthTest: false,
			transparent: true,
		});
		this.speechBubble = new THREE.Sprite(spriteMaterial);
		this.speechBubble.scale.set(4, 2, 1); // Make it wider for text
		this.speechBubble.position.y = 3; // Position above nameplate
		this.speechBubble.visible = false; // Hide initially

		// Add speech bubble to mesh
		this.mesh.add(this.speechBubble);
	}

	private updateSpeechBubble(message: string): void {
		const ctx = this.speechBubbleContext;
		const canvas = this.speechBubbleCanvas;
		const padding = 20;
		const borderRadius = 20;

		// Clear the canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Set up text properties
		ctx.font = '32px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Measure text for bubble size
		const maxWidth = canvas.width - padding * 4;
		const words = message.split(' ');
		let lines = [];
		let currentLine = words[0];

		// Word wrap
		for (let i = 1; i < words.length; i++) {
			const word = words[i];
			const width = ctx.measureText(currentLine + ' ' + word).width;
			if (width < maxWidth) {
				currentLine += ' ' + word;
			} else {
				lines.push(currentLine);
				currentLine = word;
			}
		}
		lines.push(currentLine);

		const lineHeight = 40;
		const bubbleHeight = lines.length * lineHeight + padding * 2;
		const bubbleWidth = maxWidth + padding * 2;
		const startY = (canvas.height - bubbleHeight) / 2;

		// Draw bubble background
		ctx.fillStyle = 'white';
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 4;

		// Draw rounded rectangle for bubble
		ctx.beginPath();
		ctx.moveTo(padding + borderRadius, startY);
		ctx.lineTo(padding + bubbleWidth - borderRadius, startY);
		ctx.quadraticCurveTo(
			padding + bubbleWidth,
			startY,
			padding + bubbleWidth,
			startY + borderRadius
		);
		ctx.lineTo(padding + bubbleWidth, startY + bubbleHeight - borderRadius);
		ctx.quadraticCurveTo(
			padding + bubbleWidth,
			startY + bubbleHeight,
			padding + bubbleWidth - borderRadius,
			startY + bubbleHeight
		);

		// Add tail to bubble
		const tailWidth = 20;
		const tailHeight = 40;
		ctx.lineTo(canvas.width / 2 + tailWidth, startY + bubbleHeight);
		ctx.lineTo(canvas.width / 2, startY + bubbleHeight + tailHeight);
		ctx.lineTo(canvas.width / 2 - tailWidth, startY + bubbleHeight);

		ctx.lineTo(padding + borderRadius, startY + bubbleHeight);
		ctx.quadraticCurveTo(
			padding,
			startY + bubbleHeight,
			padding,
			startY + bubbleHeight - borderRadius
		);
		ctx.lineTo(padding, startY + borderRadius);
		ctx.quadraticCurveTo(padding, startY, padding + borderRadius, startY);
		ctx.closePath();

		ctx.fill();
		ctx.stroke();

		// Draw text
		ctx.fillStyle = 'black';
		lines.forEach((line, i) => {
			ctx.fillText(
				line,
				canvas.width / 2,
				startY + padding + i * lineHeight + lineHeight / 2
			);
		});

		// Update texture
		this.speechBubbleTexture.needsUpdate = true;
	}

	setScene(scene: THREE.Scene): void {
		super.setScene(scene);
		if (scene && this.healthBarComponent) {
			scene.add(this.healthBarComponent.getSprite());
		}
	}

	setTargeted(targeted: boolean): void {
		this.isTargeted = targeted;
		this.updateHealthBarVisibility();
	}

	private updateHealthBarVisibility(): void {
		const shouldShowHealthBar =
			this.isTargeted ||
			this.healthComponent.getCurrentHealth() <
				this.healthComponent.getMaxHealth();

		if (this.healthBarComponent) {
			this.healthBarComponent.getSprite().visible = shouldShowHealthBar;
		}
	}

	public MoveTo(target: THREE.Vector3 | Entity): void {
		this.state.isMoving = true;
		if (target instanceof THREE.Vector3) {
			this.state.targetPosition = target.clone();
			this.state.targetEntity = undefined;
		} else {
			this.state.targetEntity = target;
			this.state.targetPosition = target.getTransform().position.clone();
		}
	}

	public Say(message: string, duration: number = 3000): void {
		// Clear any existing dialogue timeout
		if (this.state.dialogueTimeout) {
			clearTimeout(this.state.dialogueTimeout);
		}

		this.state.isTalking = true;
		this.state.currentDialogue = message;

		// Update and show speech bubble
		this.updateSpeechBubble(message);
		this.speechBubble.visible = true;

		// Clear the dialogue after duration
		this.state.dialogueTimeout = setTimeout(() => {
			this.state.isTalking = false;
			this.state.currentDialogue = undefined;
			this.speechBubble.visible = false;
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

	public getHealthComponent(): HealthComponent {
		return this.healthComponent;
	}

	// Add method to get the base mesh for raycasting
	public getInteractionMesh(): THREE.Group {
		return this.baseMesh;
	}

	update(deltaTime: number): void {
		super.update(deltaTime);

		// Handle movement if we have a target
		if (this.state.isMoving) {
			// Update target position if we're tracking an entity
			if (this.state.targetEntity) {
				this.state.targetPosition = this.state.targetEntity
					.getTransform()
					.position.clone();
			}

			if (this.state.targetPosition) {
				const direction = this.state.targetPosition
					.clone()
					.sub(this.transform.position);
				const distance = direction.length();

				if (distance > 0.1) {
					// Move towards target
					direction.normalize();
					const moveSpeed = 2 * deltaTime;
					const movement = direction.multiplyScalar(moveSpeed);

					this.transform.position.add(movement);
					this.mesh.position.copy(this.transform.position);

					// Rotate to face movement direction
					this.mesh.lookAt(this.state.targetPosition);
				} else {
					// Reached target
					this.state.isMoving = false;
					this.state.targetPosition = undefined;
					this.state.targetEntity = undefined;
				}
			}
		}

		// Update health bar
		this.updateHealthBarVisibility();
		if (this.healthBarComponent.getSprite().visible) {
			// Position health bar just above the nameplate
			const healthBarSprite = this.healthBarComponent.getSprite();
			healthBarSprite.position.copy(this.transform.position);
			healthBarSprite.position.y = 1.8; // Lower position, just above the nameplate
			this.healthBarComponent.update(deltaTime);
		}

		// Make nameplate, health bar, and speech bubble face camera
		const sceneData = this.getScene();
		if (sceneData?.camera) {
			this.nameplate.quaternion.copy(sceneData.camera.quaternion);
			if (this.state.isTalking) {
				this.speechBubble.quaternion.copy(sceneData.camera.quaternion);
			}
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
		if (this.speechBubbleTexture) {
			this.speechBubbleTexture.dispose();
		}
		if (this.healthBarComponent) {
			this.healthBarComponent.cleanup();
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

	private getEntitiesByDistance<T extends Entity>(
		filter: (entity: Entity) => entity is T,
		excludeSelf: boolean = true
	): Array<{ entity: T; distance: number }> {
		const entityManager = EntityManager.getInstance();
		const entities = entityManager
			.getAllEntities()
			.filter(filter)
			.filter((entity) => !excludeSelf || entity.getId() !== this.getId())
			.map((entity) => ({
				entity,
				distance: this.transform.position.distanceTo(
					entity.getTransform().position
				),
			}));

		return entities.sort((a, b) => a.distance - b.distance);
	}

	public getResourcesByDistance(
		type?: ResourceType
	): Array<{ entity: ResourceEntity; distance: number }> {
		return this.getEntitiesByDistance(
			(entity): entity is ResourceEntity =>
				entity instanceof ResourceEntity && (!type || entity.getType() === type)
		);
	}

	public getNPCsByDistance(options?: {
		profession?: NPCProfession;
		name?: string;
	}): Array<{ entity: NPCEntity; distance: number }> {
		return this.getEntitiesByDistance((entity): entity is NPCEntity => {
			if (!(entity instanceof NPCEntity)) return false;
			if (options?.profession && entity.getProfession() !== options.profession)
				return false;
			if (options?.name && entity.getName() !== options.name) return false;
			return true;
		});
	}

	public getCharactersByDistance(
		includingPlayer: boolean = true
	): Array<{ entity: Entity; distance: number }> {
		return this.getEntitiesByDistance(
			(entity): entity is Entity =>
				entity instanceof NPCEntity ||
				(includingPlayer && entity instanceof PlayerEntity)
		);
	}

	// Movement methods using the new sorted arrays
	public moveToNearestResource(type?: ResourceType): void {
		const resources = this.getResourcesByDistance(type);
		if (resources.length > 0) {
			this.MoveTo(resources[0].entity);
			console.log(
				`${this.name} moving to nearest ${
					type || 'resource'
				} (${resources[0].distance.toFixed(2)} units away)`
			);
		} else {
			console.log(`${this.name} found no ${type || 'resources'} nearby`);
		}
	}

	public moveToFurthestResource(type?: ResourceType): void {
		const resources = this.getResourcesByDistance(type);
		if (resources.length > 0) {
			this.MoveTo(resources[resources.length - 1].entity);
			console.log(
				`${this.name} moving to furthest ${type || 'resource'} (${resources[
					resources.length - 1
				].distance.toFixed(2)} units away)`
			);
		} else {
			console.log(`${this.name} found no ${type || 'resources'} nearby`);
		}
	}

	public moveToNearestCharacter(includingPlayer: boolean = true): void {
		const characters = this.getCharactersByDistance(includingPlayer);
		if (characters.length > 0) {
			this.MoveTo(characters[0].entity);
			const targetName =
				characters[0].entity instanceof PlayerEntity
					? 'Player'
					: characters[0].entity instanceof NPCEntity
					? characters[0].entity.getName()
					: 'Unknown';
			console.log(
				`${
					this.name
				} moving to nearest character (${targetName}, ${characters[0].distance.toFixed(
					2
				)} units away)`
			);
		} else {
			console.log(`${this.name} found no other characters nearby`);
		}
	}

	public moveToNearestNPC(options?: {
		profession?: NPCProfession;
		name?: string;
	}): void {
		const npcs = this.getNPCsByDistance(options);
		if (npcs.length > 0) {
			this.MoveTo(npcs[0].entity);
			const targetDesc = options?.name
				? `NPC named ${options.name}`
				: options?.profession
				? `${options.profession}`
				: 'NPC';
			console.log(
				`${
					this.name
				} moving to nearest ${targetDesc} (${npcs[0].entity.getName()}, ${npcs[0].distance.toFixed(
					2
				)} units away)`
			);
		} else {
			const searchDesc = options?.name
				? `NPC named ${options.name}`
				: options?.profession
				? `${options.profession}`
				: 'other NPCs';
			console.log(`${this.name} found no ${searchDesc} nearby`);
		}
	}
}
