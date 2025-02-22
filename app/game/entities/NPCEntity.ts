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

export class NPCEntity extends Entity {
	private static readonly COLLISION_RADIUS = 0.75; // Radius for collision detection
	private static readonly CIRCLE_SPEED = 1.0; // Speed of circling movement
	private static readonly DIRECTION_CHANGE_INTERVAL = 3.0; // Change direction every 3 seconds
	private circleAngle: number = Math.random() * Math.PI * 2; // Random starting angle for circling
	private name: string;
	private profession: NPCProfession;
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

	constructor(config: NPCConfig) {
		super({ position: config.position });

		this.name = config.name;
		this.profession = config.profession;

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

		// Profession-specific hurt phrases
		const hurtPhrases =
			this.profession === NPCProfession.GUARD
				? [
						'Is that all you got?',
						"You'll regret that!",
						"I've had worse!",
						'Stand and fight!',
				  ]
				: [
						'Help! Help!',
						'Please, no more!',
						'I surrender!',
						'Guards, help me!',
				  ];
		this.Say(hurtPhrases[Math.floor(Math.random() * hurtPhrases.length)], 1000);
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

				// Profession-specific attack phrases
				const attackPhrases =
					this.profession === NPCProfession.GUARD
						? [
								'For justice!',
								'Stand down!',
								'In the name of the law!',
								'Surrender now!',
						  ]
						: [
								'Take that!',
								'Leave me alone!',
								"I don't want to do this!",
								'Stay back!',
						  ];
				this.Say(
					attackPhrases[Math.floor(Math.random() * attackPhrases.length)],
					1000
				);
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

		// Say a death phrase based on profession
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

			// Handle movement if we have a target and not in combat
			if (this.state.isMoving && !this.state.inCombat) {
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
