import * as THREE from 'three';
import { Entity } from '../core/Entity';
import { ResourceType, ResourceProperties } from '../types/resources';
import { HealthComponent } from '../components/HealthComponent';
import { HealthBarComponent } from '../components/HealthBarComponent';

interface ResourceEntityConfig {
	position: THREE.Vector3;
	properties: ResourceProperties;
}

export class ResourceEntity extends Entity {
	protected type: ResourceType;
	protected properties: ResourceProperties;
	protected healthComponent: HealthComponent;
	protected healthBarComponent: HealthBarComponent;
	protected mesh: THREE.Mesh | THREE.Group | null = null;
	private active: boolean = true;
	private respawnTimeout: NodeJS.Timeout | null = null;
	private isTargeted: boolean = false;

	constructor(type: ResourceType, config: ResourceEntityConfig) {
		super({ position: config.position });
		this.type = type;
		this.properties = {
			...config.properties,
			currentHealth: config.properties.maxHealth, // Ensure currentHealth starts at maxHealth
		};

		// Add health component with initial properties
		this.healthComponent = new HealthComponent({
			maxHealth: this.properties.maxHealth,
			currentHealth: this.properties.maxHealth, // Explicitly set current health to max
		});
		this.healthComponent.setEntity(this);
		this.healthComponent.onDeath(() => this.onDestroyed());

		// Add health bar component
		this.healthBarComponent = new HealthBarComponent(this.healthComponent);
		this.healthBarComponent.setEntity(this);

		// Create visual representation
		this.createVisuals();
	}

	protected createVisuals(): void {
		// Create basic mesh - will be overridden by specific resource types
		const geometry = new THREE.BoxGeometry(1, 1, 1);
		const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.copy(this.transform.position);
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
	}

	setScene(scene: THREE.Scene): void {
		super.setScene(scene);
		if (scene && this.healthBarComponent) {
			scene.add(this.healthBarComponent.getSprite());
		}
	}

	getMesh(): THREE.Mesh | THREE.Group | null {
		return this.mesh;
	}

	isActive(): boolean {
		return this.active;
	}

	setActive(active: boolean): void {
		this.active = active;
		if (this.mesh) {
			this.mesh.visible = active;
		}
		if (this.healthBarComponent) {
			this.healthBarComponent.getSprite().visible = active;
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
			this.healthBarComponent.getSprite().visible =
				this.active && shouldShowHealthBar;
		}
	}

	update(deltaTime: number): void {
		super.update(deltaTime);
		if (this.active) {
			this.updateHealthBarVisibility();
			if (this.healthBarComponent.getSprite().visible) {
				this.healthBarComponent.update(deltaTime);
			}
		}
	}

	protected onDestroyed(): void {
		this.setActive(false);
		if (this.properties.respawnTime > 0) {
			this.respawnTimeout = setTimeout(
				() => this.respawn(),
				this.properties.respawnTime * 1000
			);
		}
	}

	protected respawn(): void {
		if (this.healthComponent) {
			this.healthComponent.heal(this.properties.maxHealth);
		}
		this.setActive(true);
	}

	cleanup(): void {
		super.cleanup();
		if (this.respawnTimeout) {
			clearTimeout(this.respawnTimeout);
		}
		if (this.mesh) {
			if (this.mesh instanceof THREE.Mesh) {
				this.mesh.geometry.dispose();
				if (Array.isArray(this.mesh.material)) {
					this.mesh.material.forEach((m: THREE.Material) => m.dispose());
				} else {
					this.mesh.material.dispose();
				}
			} else if (this.mesh instanceof THREE.Group) {
				this.mesh.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						child.geometry.dispose();
						if (Array.isArray(child.material)) {
							child.material.forEach((m: THREE.Material) => m.dispose());
						} else {
							child.material.dispose();
						}
					}
				});
			}
		}
		this.healthBarComponent.cleanup();
	}

	getType(): ResourceType {
		return this.type;
	}

	getHealthComponent(): HealthComponent {
		return this.healthComponent;
	}
}
