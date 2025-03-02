import * as THREE from 'three';
import { Entity } from '../core/Entity';
import {
	NPCConfig,
	NPCProfession,
	NPCState,
	NPCCombatStats,
	DEFAULT_COMBAT_STATS,
} from '../types/npc';
import { HealthComponent } from '../components/HealthComponent';
import { HealthBarComponent } from '../components/HealthBarComponent';
import { createPawnVisuals, createRookVisuals } from './ChessPieceVisuals';
import { ResourceEntity } from './ResourceEntity';
import { ResourceType } from '../types/resources';
import { EntityManager } from '../core/EntityManager';
import { PlayerEntity } from './PlayerEntity';
import { ConversationManager } from '../managers/ConversationManager';
import { NPCDialogueConfig } from '../types/dialogue';

export class NPCEntity extends Entity {
	private static readonly COLLISION_RADIUS = 0.75; // Radius for collision detection
	private static readonly CIRCLE_SPEED = 1.0; // Speed of circling movement
	private static readonly DIRECTION_CHANGE_INTERVAL = 3.0; // Change direction every 3 seconds
	private static readonly WOOD_GATHER_TIME = 3000; // 3 seconds to gather wood
	private static readonly WOOD_ZONE_POSITION = new THREE.Vector3(-3, 0, 0);
	private static readonly WANDER_RADIUS = 5; // Maximum distance to wander from current position
	private static readonly WANDER_INTERVAL_MIN = 4; // Minimum seconds between wandering
	private static readonly WANDER_INTERVAL_MAX = 8; // Maximum seconds between wandering
	private static readonly WANDER_CHANCE = 0.5; // 50% chance to start wandering when idle
	private static readonly WANDER_SPEAK_CHANCE = 0.3; // 30% chance to say something while wandering
	private static readonly COMBAT_SPEAK_CHANCE = 0.15; // Reduced to 15% chance to speak during combat actions
	private static readonly COMBAT_SPEAK_COOLDOWN = 5000; // 5 seconds cooldown between combat phrases
	private circleAngle: number = Math.random() * Math.PI * 2; // Random starting angle for circling
	private name: string;
	private profession: NPCProfession;
	private voiceId: string;
	private isFemale: boolean;
	private healthComponent: HealthComponent;
	private healthBarComponent: HealthBarComponent;
	private combatStats: NPCCombatStats;
	private originalColors: Map<THREE.Material, THREE.Color> = new Map();
	private state: NPCState = {
		isMoving: false,
		isTalking: false,
		isAttacking: false,
		lastAttackTime: 0,
		isHit: false,
		hitRecoveryTime: 0,
		inCombat: false,
		combatTarget: undefined,
		attackAnimationTime: 0,
		isDead: false,
		deathTime: 0,
		deathAnimationComplete: false,
		circlingClockwise: Math.random() < 0.5,
		lastDirectionChangeTime: 0,
		isRunning: false,
		isFollowing: false,
		followTarget: undefined,
		followDistance: 2,
		isWandering: false,
		lastWanderTime: 0,
		wanderTarget: undefined,
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
	private knockbackVelocity: THREE.Vector3 = new THREE.Vector3();
	private conversationManager: ConversationManager;
	private dialogueConfig: NPCDialogueConfig;
	private isGatheringWood: boolean = false;
	private gatheringProgress: number = 0;
	private progressBarMesh: THREE.Sprite | null = null;
	private lastCombatSpeechTime: number = 0;

	constructor(config: NPCConfig) {
		super({ position: config.position });

		// Store name info
		if (typeof config.name === 'string') {
			this.name = config.name;
			this.voiceId = '2KQQugeCbzK3DlEDAYh6'; // Default voice if string name provided
			this.isFemale = false; // Default to male if string name provided
		} else {
			this.name = config.name.fullName;
			this.voiceId = config.name.voiceId;
			this.isFemale = config.name.isFemale;
		}

		this.profession = config.profession;
		this.dialogueConfig = config.dialogueConfig || {};
		this.conversationManager = new ConversationManager(
			this,
			this.dialogueConfig
		);

		// Initialize combat stats
		this.combatStats = {
			...DEFAULT_COMBAT_STATS[this.profession],
			...config.combatStats,
		};

		// Initialize health component with profession-based max health
		const baseMaxHealth = this.profession === NPCProfession.GUARD ? 150 : 100;
		this.healthComponent = new HealthComponent({
			maxHealth: config.maxHealth ?? baseMaxHealth,
			currentHealth: config.maxHealth ?? baseMaxHealth,
		});
		this.healthComponent.setEntity(this);

		// Initialize health bar component
		this.healthBarComponent = new HealthBarComponent(this.healthComponent);
		this.healthBarComponent.setEntity(this);

		// Create visual representation
		this.createVisuals();
		this.createNameplate();
		this.createSpeechBubble();

		// Initialize wandering behavior
		this.state.lastWanderTime = 0; // Start with 0 to trigger immediate wandering
		this.tryStartWandering(); // Try to start wandering immediately
	}

	private createVisuals(): void {
		this.mesh = new THREE.Group();
		this.baseMesh = new THREE.Group();

		// Create the appropriate chess piece based on profession
		const visuals =
			this.profession === NPCProfession.VILLAGER
				? createPawnVisuals()
				: createRookVisuals();

		// Store original colors before adding to mesh
		visuals.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				if (Array.isArray(child.material)) {
					child.material.forEach((m) => {
						this.originalColors.set(m, m.color.clone());
					});
				} else {
					this.originalColors.set(child.material, child.material.color.clone());
				}
			}
		});

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

	private createProgressBar(): void {
		// Create canvas for progress bar
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 8;
		const context = canvas.getContext('2d')!;

		// Create sprite material using canvas texture
		const texture = new THREE.Texture(canvas);
		const spriteMaterial = new THREE.SpriteMaterial({
			map: texture,
			depthTest: false,
			transparent: true,
		});
		this.progressBarMesh = new THREE.Sprite(spriteMaterial);
		this.progressBarMesh.scale.set(1.5, 0.2, 1);
		this.progressBarMesh.visible = false;

		if (this.scene) {
			this.scene.add(this.progressBarMesh);
		}
	}

	private updateProgressBar(progress: number): void {
		if (!this.progressBarMesh) return;

		const canvas = (this.progressBarMesh.material as THREE.SpriteMaterial).map!
			.image;
		const context = canvas.getContext('2d')!;

		// Clear canvas
		context.clearRect(0, 0, canvas.width, canvas.height);

		// Draw background
		context.fillStyle = 'rgba(0, 0, 0, 0.5)';
		context.fillRect(0, 0, canvas.width, canvas.height);

		// Draw progress
		context.fillStyle = '#4CAF50';
		context.fillRect(0, 0, canvas.width * progress, canvas.height);

		// Update texture
		(this.progressBarMesh.material as THREE.SpriteMaterial).map!.needsUpdate =
			true;

		// Position above NPC
		if (this.mesh) {
			const position = this.mesh.position.clone();
			position.y += 2.5;
			this.progressBarMesh.position.copy(position);
		}

		// Make sprite face camera
		const sceneData = this.getScene();
		if (sceneData?.camera) {
			this.progressBarMesh.quaternion.copy(sceneData.camera.quaternion);
		}
	}

	public async startGatheringWood(): Promise<void> {
		if (this.isGatheringWood) return;
		this.isGatheringWood = true;

		// Create progress bar if it doesn't exist
		if (!this.progressBarMesh) {
			this.createProgressBar();
		}

		// Initial acknowledgment phrases
		const acknowledgmentPhrases = [
			'Right away!',
			'Yes, sir!',
			"I'll get right on it!",
			'Leave it to me!',
			'Consider it done!',
		];

		// Random woodcutting phrases (for occasional use while working)
		const woodcuttingPhrases = [
			'I love woodcutting!',
			'Nothing like a day in the forest.',
			'This is good exercise!',
			'The smell of fresh wood is wonderful.',
			'Another tree, another day!',
		];

		// Always say an acknowledgment phrase when starting
		const randomAcknowledgment =
			acknowledgmentPhrases[
				Math.floor(Math.random() * acknowledgmentPhrases.length)
			];
		await this.Say(randomAcknowledgment, 2000);

		while (this.isGatheringWood) {
			// Find nearest tree
			const trees = this.getResourcesByDistance(ResourceType.TREE).filter(
				({ entity }) => entity.getHealthComponent().getCurrentHealth() > 0
			);

			if (trees.length === 0) {
				await this.Say('No more trees to cut!');
				this.stopGatheringWood();
				return;
			}

			const nearestTree = trees[0].entity;
			const treePosition = nearestTree.getTransform().position;

			// Move to tree
			this.MoveTo(treePosition);

			// Wait until close to tree
			await new Promise<void>((resolve) => {
				const checkDistance = setInterval(() => {
					const distance = this.transform.position.distanceTo(treePosition);
					if (distance < 2) {
						clearInterval(checkDistance);
						resolve();
					}
				}, 100);
			});

			if (!this.isGatheringWood) return;

			// Show and update progress bar while chopping
			if (this.progressBarMesh) {
				this.progressBarMesh.visible = true;
			}

			// 10% chance to say something while chopping
			if (Math.random() < 0.1) {
				const randomPhrase =
					woodcuttingPhrases[
						Math.floor(Math.random() * woodcuttingPhrases.length)
					];
				await this.Say(randomPhrase, 2000);
			}

			// Chop the tree
			for (let progress = 0; progress <= 1; progress += 0.1) {
				if (!this.isGatheringWood) return;
				this.updateProgressBar(progress);
				await new Promise((resolve) => setTimeout(resolve, 300));
			}

			// Damage the tree
			nearestTree.getHealthComponent().damage(20);

			// Hide progress bar
			if (this.progressBarMesh) {
				this.progressBarMesh.visible = false;
			}

			if (!this.isGatheringWood) return;

			// Move to wood zone
			this.MoveTo(NPCEntity.WOOD_ZONE_POSITION);

			// Wait until at wood zone
			await new Promise<void>((resolve) => {
				const checkDistance = setInterval(() => {
					const distance = this.transform.position.distanceTo(
						NPCEntity.WOOD_ZONE_POSITION
					);
					if (distance < 2) {
						clearInterval(checkDistance);
						resolve();
					}
				}, 100);
			});

			if (!this.isGatheringWood) return;
		}
	}

	public stopGatheringWood(): void {
		this.isGatheringWood = false;
		if (this.progressBarMesh) {
			this.progressBarMesh.visible = false;
		}
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

	public MoveTo(
		target: THREE.Vector3 | Entity,
		shouldRun: boolean = false
	): void {
		this.state.isMoving = true;
		this.state.isRunning = shouldRun;
		if (target instanceof THREE.Vector3) {
			this.state.targetPosition = target.clone();
			this.state.targetEntity = undefined;
		} else {
			this.state.targetEntity = target;
			this.state.targetPosition = target.getTransform().position.clone();
		}
	}

	public Stop(): void {
		this.state.isMoving = false;
		this.state.isRunning = false;
		this.state.targetPosition = undefined;
		this.state.targetEntity = undefined;
		this.state.inCombat = false;
		this.state.combatTarget = undefined;
		this.state.isWandering = false;
		this.state.wanderTarget = undefined;
		this.stopFollowing();
	}

	public async Say(message: string, duration: number = 3000): Promise<void> {
		// Clear any existing dialogue timeout
		if (this.state.dialogueTimeout) {
			clearTimeout(this.state.dialogueTimeout);
		}

		this.state.isTalking = true;
		this.state.currentDialogue = message;

		// Update and show speech bubble
		this.updateSpeechBubble(message);
		this.speechBubble.visible = true;

		// Generate and play TTS audio
		try {
			const response = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: message,
					voiceId: this.voiceId,
					isFemale: this.isFemale,
				}),
			});

			const data = await response.json();
			if (data.audio) {
				const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
				await audio.play();
			}
		} catch (error) {
			console.error('Failed to play TTS audio:', error);
		}

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

	public takeDamage(damage: number, attacker?: Entity): void {
		this.healthComponent.damage(damage);
		this.updateHealthBarVisibility();

		// Check for death
		if (this.healthComponent.getCurrentHealth() <= 0 && !this.state.isDead) {
			this.die();
			return;
		}

		// Visual feedback
		this.state.isHit = true;
		this.state.hitRecoveryTime = 0;

		// Apply knockback with velocity
		if (attacker) {
			const knockbackDirection = this.transform.position
				.clone()
				.sub(attacker.getTransform().position)
				.normalize();

			// Stronger knockback and add some upward force
			this.knockbackVelocity
				.copy(knockbackDirection)
				.multiplyScalar(this.combatStats.knockbackForce * 5)
				.add(new THREE.Vector3(0, 2, 0));

			// Engage in combat with attacker if not already in combat or if current target has higher health
			if (
				attacker instanceof NPCEntity &&
				(!this.state.combatTarget ||
					(this.state.combatTarget instanceof NPCEntity &&
						this.state.combatTarget.getHealthComponent().getCurrentHealth() >
							attacker.getHealthComponent().getCurrentHealth()))
			) {
				this.engageInCombat(attacker);
			}
		}

		// Chance-based hurt phrases
		const now = Date.now();
		const timeSinceCombatSpeech = now - this.lastCombatSpeechTime;

		if (
			timeSinceCombatSpeech >= NPCEntity.COMBAT_SPEAK_COOLDOWN &&
			Math.random() < NPCEntity.COMBAT_SPEAK_CHANCE
		) {
			this.lastCombatSpeechTime = now;
			const hurtPhrases =
				this.profession === NPCProfession.GUARD
					? ['Is that all you got?', "You'll regret that!"]
					: ['Help! Help!', 'Guards, help me!'];
			const phrase =
				hurtPhrases[Math.floor(Math.random() * hurtPhrases.length)];
			this.Say(phrase);
		}
	}

	public engageInCombat(target: NPCEntity): void {
		this.state.inCombat = true;
		this.state.combatTarget = target;
		this.state.isMoving = true;
		this.state.targetEntity = target;
		this.state.targetPosition = target.getTransform().position.clone();
	}

	public attack(target: Entity): void {
		const now = Date.now();
		if (now - this.state.lastAttackTime < this.combatStats.attackInterval) {
			return; // Still on cooldown
		}

		const distance = this.transform.position.distanceTo(
			target.getTransform().position
		);
		if (distance <= this.combatStats.attackRange) {
			this.state.isAttacking = true;
			this.state.lastAttackTime = now;
			this.state.attackAnimationTime = 0;

			// If target is another NPC, make them take damage
			if (target instanceof NPCEntity) {
				target.takeDamage(this.combatStats.damage, this);

				// Chance-based attack phrases
				const timeSinceCombatSpeech = now - this.lastCombatSpeechTime;

				if (
					timeSinceCombatSpeech >= NPCEntity.COMBAT_SPEAK_COOLDOWN &&
					Math.random() < NPCEntity.COMBAT_SPEAK_CHANCE
				) {
					this.lastCombatSpeechTime = now;
					const attackPhrases =
						this.profession === NPCProfession.GUARD
							? ['Stand down!', 'Justice will be served!']
							: ['Take this!', "I won't go down easily!"];
					const phrase =
						attackPhrases[Math.floor(Math.random() * attackPhrases.length)];
					this.Say(phrase);
				}
			}
		}
	}

	private die(): void {
		this.state.isDead = true;
		this.state.deathTime = 0;
		this.state.isMoving = false;
		this.state.inCombat = false;
		this.state.combatTarget = undefined;
		this.state.targetEntity = undefined;
		this.state.targetPosition = undefined;

		// Death phrases are always said (no chance check since it's a significant event)
		const deathPhrases =
			this.profession === NPCProfession.GUARD
				? [
						'I... have failed...',
						'The guard... falls...',
						'Protect... the village...',
						'With my last breath...',
				  ]
				: [
						'I see the light...',
						'Goodbye, cruel world...',
						'I never meant for this...',
						'Tell my family...',
				  ];
		this.Say(
			deathPhrases[Math.floor(Math.random() * deathPhrases.length)],
			2000
		);

		// Hide health bar
		if (this.healthBarComponent) {
			this.healthBarComponent.getSprite().visible = false;
		}
	}

	private checkCollisionWithNPCs(): THREE.Vector3 {
		const correction = new THREE.Vector3();
		const npcs = this.getNPCsByDistance();

		for (const { entity: otherNPC, distance } of npcs) {
			if (distance < NPCEntity.COLLISION_RADIUS * 2) {
				const pushDirection = this.transform.position
					.clone()
					.sub(otherNPC.getTransform().position)
					.normalize();
				const overlap = NPCEntity.COLLISION_RADIUS * 2 - distance;
				correction.add(pushDirection.multiplyScalar(overlap * 0.5));
			}
		}

		return correction;
	}

	update(deltaTime: number): void {
		super.update(deltaTime);

		// Handle death animation and fade out
		if (this.state.isDead) {
			this.state.deathTime += deltaTime;

			if (!this.state.deathAnimationComplete) {
				// Fall over animation (rotate 90 degrees over 1 second)
				const fallProgress = Math.min(this.state.deathTime, 1);
				const fallAngle = (Math.PI / 2) * fallProgress;
				this.baseMesh.rotation.z = fallAngle;

				if (fallProgress >= 1) {
					this.state.deathAnimationComplete = true;
				}
			}

			// Start fading after 7 seconds, complete by 10 seconds
			if (this.state.deathTime > 7) {
				const fadeProgress = Math.min((this.state.deathTime - 7) / 3, 1);

				// Fade out all materials
				this.baseMesh.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						if (Array.isArray(child.material)) {
							child.material.forEach((m) => {
								m.transparent = true;
								m.opacity = 1 - fadeProgress;
							});
						} else {
							child.material.transparent = true;
							child.material.opacity = 1 - fadeProgress;
						}
					}
				});

				// Fade out nameplate and speech bubble
				if (this.nameplate.material instanceof THREE.SpriteMaterial) {
					this.nameplate.material.opacity = 1 - fadeProgress;
				}
				if (this.speechBubble.material instanceof THREE.SpriteMaterial) {
					this.speechBubble.material.opacity = 1 - fadeProgress;
				}

				// Remove entity after fade completes
				if (fadeProgress >= 1) {
					const entityManager = EntityManager.getInstance();
					entityManager.removeEntity(this);
					if (this.scene) {
						this.scene.remove(this.mesh);
					}
					return;
				}
			}
		}

		// Only process other updates if not dead
		if (!this.state.isDead) {
			// Apply knockback velocity with gravity
			if (this.knockbackVelocity.lengthSq() > 0) {
				// Apply gravity
				this.knockbackVelocity.y -= 9.8 * deltaTime;

				// Apply velocity to position
				const movement = this.knockbackVelocity
					.clone()
					.multiplyScalar(deltaTime);
				this.transform.position.add(movement);

				// Ground check
				if (this.transform.position.y < 0) {
					this.transform.position.y = 0;
					this.knockbackVelocity.set(0, 0, 0);
				} else {
					// Dampen horizontal velocity
					this.knockbackVelocity.x *= 0.95;
					this.knockbackVelocity.z *= 0.95;
				}

				this.mesh.position.copy(this.transform.position);
			}

			// Handle hit visual feedback
			if (this.state.isHit) {
				this.state.hitRecoveryTime += deltaTime;

				// Flash red
				this.baseMesh.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						if (Array.isArray(child.material)) {
							child.material.forEach((m) => {
								m.color.setRGB(
									1,
									this.state.hitRecoveryTime * 2,
									this.state.hitRecoveryTime * 2
								);
							});
						} else {
							child.material.color.setRGB(
								1,
								this.state.hitRecoveryTime * 2,
								this.state.hitRecoveryTime * 2
							);
						}
					}
				});

				// Reset after 0.5 seconds
				if (this.state.hitRecoveryTime >= 0.5) {
					this.state.isHit = false;
					this.state.hitRecoveryTime = 0;

					// Reset to original colors
					this.baseMesh.traverse((child) => {
						if (child instanceof THREE.Mesh) {
							if (Array.isArray(child.material)) {
								child.material.forEach((m) => {
									const originalColor = this.originalColors.get(m);
									if (originalColor) {
										m.color.copy(originalColor);
									}
								});
							} else {
								const originalColor = this.originalColors.get(child.material);
								if (originalColor) {
									child.material.color.copy(originalColor);
								}
							}
						}
					});
				}
			}

			// Handle attack animation
			if (this.state.isAttacking) {
				this.state.attackAnimationTime += deltaTime;
				const animationDuration = 0.5; // Half a second for full attack animation

				if (this.state.attackAnimationTime <= animationDuration) {
					// Simple forward and back swing animation
					const progress = this.state.attackAnimationTime / animationDuration;
					const swingAngle = Math.sin(progress * Math.PI) * (Math.PI / 6); // 30-degree swing
					this.baseMesh.rotation.x = swingAngle;
				} else {
					this.state.isAttacking = false;
					this.state.attackAnimationTime = 0;
					this.baseMesh.rotation.x = 0;
				}
			}

			// Handle following behavior
			if (this.state.isFollowing && this.state.followTarget) {
				const target = this.state.followTarget;
				const targetPos = target.getTransform().position;
				const distance = this.transform.position.distanceTo(targetPos);

				// Calculate position behind the target
				// First, get the target's forward direction (assuming they're looking at their movement direction)
				const targetForward = new THREE.Vector3();
				if (target instanceof NPCEntity || target instanceof PlayerEntity) {
					targetForward
						.copy(target.getTransform().position)
						.sub(this.transform.position)
						.normalize();
				}

				// Calculate the desired follow position behind the target
				const followPos = targetPos
					.clone()
					.sub(targetForward.multiplyScalar(this.state.followDistance));

				// Only move if we're too far from the desired follow position
				if (distance > this.state.followDistance + 0.5) {
					// Move towards the follow position at walking speed
					const moveDir = followPos
						.clone()
						.sub(this.transform.position)
						.normalize()
						.multiplyScalar(deltaTime * this.combatStats.walkSpeed);

					this.transform.position.add(moveDir);

					// Apply collision correction
					const correction = this.checkCollisionWithNPCs();
					this.transform.position.add(correction);
					this.mesh.position.copy(this.transform.position);

					// Look at target
					const lookAtPos = targetPos.clone();
					lookAtPos.y = this.transform.position.y; // Keep level
					this.mesh.lookAt(lookAtPos);
				}
			}

			// Handle combat behavior
			if (this.state.inCombat && this.state.combatTarget) {
				const target = this.state.combatTarget;
				const distance = this.transform.position.distanceTo(
					target.getTransform().position
				);

				// Calculate optimal combat positioning
				const optimalDistance = this.combatStats.attackRange * 0.8;

				if (distance > this.combatStats.attackRange * 1.2) {
					// Too far - move directly towards target at running speed
					const moveDir = target
						.getTransform()
						.position.clone()
						.sub(this.transform.position)
						.normalize()
						.multiplyScalar(deltaTime * this.combatStats.runSpeed);
					this.transform.position.add(moveDir);
				} else {
					// In combat range - circle around target at walking speed
					const currentTime = Date.now() / 1000;
					if (
						currentTime - this.state.lastDirectionChangeTime >=
						NPCEntity.DIRECTION_CHANGE_INTERVAL
					) {
						this.state.circlingClockwise = !this.state.circlingClockwise;
						this.state.lastDirectionChangeTime = currentTime;
					}

					this.circleAngle +=
						deltaTime *
						NPCEntity.CIRCLE_SPEED *
						(this.state.circlingClockwise ? -1 : 1);

					// Calculate desired position on circle around target
					const targetPos = target.getTransform().position;
					const circlePos = new THREE.Vector3(
						targetPos.x + Math.cos(this.circleAngle) * optimalDistance,
						targetPos.y,
						targetPos.z + Math.sin(this.circleAngle) * optimalDistance
					);

					// Move towards the circle position at walking speed
					const moveDir = circlePos
						.sub(this.transform.position)
						.normalize()
						.multiplyScalar(deltaTime * this.combatStats.walkSpeed);
					this.transform.position.add(moveDir);
				}

				// Apply collision correction (reduced strength during combat)
				const correction = this.checkCollisionWithNPCs();
				this.transform.position.add(correction.multiplyScalar(0.3)); // Reduced collision response
				this.mesh.position.copy(this.transform.position);

				// Always face the target
				const lookAtPos = target.getTransform().position.clone();
				lookAtPos.y = this.transform.position.y; // Keep level
				this.mesh.lookAt(lookAtPos);

				// Attack if in range and facing target
				if (distance <= this.combatStats.attackRange) {
					this.attack(target);
				}

				// End combat if target is dead or too far
				if (
					(target instanceof NPCEntity &&
						target.getHealthComponent().getCurrentHealth() <= 0) ||
					distance > 15 // Increased disengage distance
				) {
					this.state.inCombat = false;
					this.state.combatTarget = undefined;
				}
			}

			// Handle movement if we have a target and not in combat or following
			if (
				this.state.isMoving &&
				!this.state.inCombat &&
				!this.state.isFollowing
			) {
				// Try to start wandering when idle
				this.tryStartWandering();

				// Check if we've reached the wander target
				if (this.state.isWandering && this.state.wanderTarget) {
					const distanceToTarget = this.transform.position.distanceTo(
						this.state.wanderTarget
					);
					if (distanceToTarget < 0.1) {
						this.state.isWandering = false;
						this.state.wanderTarget = undefined;
						this.Stop();
					}
				}

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
						// Move towards target with appropriate speed
						direction.normalize();
						const currentSpeed = this.state.isRunning
							? this.combatStats.runSpeed
							: this.combatStats.walkSpeed;
						const movement = direction.multiplyScalar(deltaTime * currentSpeed);

						// Apply movement and collision correction
						this.transform.position.add(movement);
						const correction = this.checkCollisionWithNPCs();
						this.transform.position.add(correction);

						this.mesh.position.copy(this.transform.position);
						this.mesh.lookAt(this.state.targetPosition);
					} else {
						this.state.isMoving = false;
						this.state.isRunning = false;
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

		if (this.progressBarMesh) {
			if (this.scene) {
				this.scene.remove(this.progressBarMesh);
			}
			(this.progressBarMesh.material as THREE.SpriteMaterial).map?.dispose();
			this.progressBarMesh.material.dispose();
		}
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
		profession?: string;
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
		profession?: string;
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

	public async handlePlayerInput(input: string, player: Entity): Promise<void> {
		await this.conversationManager.processInput(input, player);
	}

	public isInConversation(): boolean {
		return this.conversationManager.isInConversation();
	}

	public endConversation(): void {
		this.conversationManager.endConversation();
	}

	public async startFollowing(target: Entity): Promise<void> {
		// Stop any current following
		this.stopFollowing();

		// Set following state
		this.state.isFollowing = true;
		this.state.followTarget = target;
		this.state.isMoving = true;

		// Acknowledge the command
		const acknowledgmentPhrases = [
			'I will follow!',
			'Right behind you!',
			'Lead the way!',
			'Following your lead!',
			'As you wish!',
		];
		const randomPhrase =
			acknowledgmentPhrases[
				Math.floor(Math.random() * acknowledgmentPhrases.length)
			];
		await this.Say(randomPhrase, 2000);
	}

	public stopFollowing(): void {
		if (this.state.isFollowing) {
			this.state.isFollowing = false;
			this.state.followTarget = undefined;
			this.state.isMoving = false;
			this.state.targetPosition = undefined;
			this.state.targetEntity = undefined;
		}
	}

	private tryStartWandering(): void {
		const now = Date.now() / 1000;
		if (
			!this.state.isWandering &&
			!this.state.isMoving &&
			!this.state.inCombat &&
			!this.state.isFollowing &&
			!this.state.isTalking &&
			!this.state.isAttacking &&
			now - this.state.lastWanderTime > this.getRandomWanderInterval() &&
			Math.random() < NPCEntity.WANDER_CHANCE
		) {
			// Generate random angle and distance within WANDER_RADIUS
			const angle = Math.random() * Math.PI * 2;
			const distance = Math.random() * NPCEntity.WANDER_RADIUS;

			// Calculate new position
			const wanderTarget = new THREE.Vector3(
				this.transform.position.x + Math.cos(angle) * distance,
				0,
				this.transform.position.z + Math.sin(angle) * distance
			);

			// Start wandering
			this.state.isWandering = true;
			this.state.wanderTarget = wanderTarget;
			this.state.lastWanderTime = now;
			this.MoveTo(wanderTarget);

			// Chance to say something while starting to wander
			if (Math.random() < NPCEntity.WANDER_SPEAK_CHANCE) {
				const wanderPhrases =
					this.profession === NPCProfession.GUARD
						? [
								'Just doing my rounds...',
								'Keeping the area secure.',
								'All quiet so far.',
								'Must remain vigilant.',
								'Patrolling the perimeter.',
						  ]
						: [
								'Nice day for a walk!',
								"Think I'll stretch my legs.",
								"Wonder what's over there...",
								'Just taking a stroll.',
								'Getting some fresh air.',
						  ];
				this.Say(
					wanderPhrases[Math.floor(Math.random() * wanderPhrases.length)],
					2000
				);
			}
		}
	}

	private getRandomWanderInterval(): number {
		return (
			NPCEntity.WANDER_INTERVAL_MIN +
			Math.random() *
				(NPCEntity.WANDER_INTERVAL_MAX - NPCEntity.WANDER_INTERVAL_MIN)
		);
	}

	public getVoiceId(): string {
		return this.voiceId;
	}

	public isFemaleNPC(): boolean {
		return this.isFemale;
	}
}
