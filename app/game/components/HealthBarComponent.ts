import * as THREE from 'three';
import { Component } from '../core/Component';
import { HealthComponent } from './HealthComponent';
import { ResourceEntity } from '../entities/ResourceEntity';

export class HealthBarComponent extends Component {
	private sprite: THREE.Sprite;
	private healthComponent: HealthComponent;
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D;
	private texture: THREE.Texture;
	private width = 64;
	private height = 8;

	constructor(healthComponent: HealthComponent) {
		super();
		this.healthComponent = healthComponent;

		// Create canvas for health bar
		this.canvas = document.createElement('canvas');
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.context = this.canvas.getContext('2d')!;

		// Create sprite material using canvas texture
		this.texture = new THREE.Texture(this.canvas);
		const spriteMaterial = new THREE.SpriteMaterial({
			map: this.texture,
			depthTest: false, // Ensure health bar is always visible
			transparent: true,
		});
		this.sprite = new THREE.Sprite(spriteMaterial);

		// Scale the sprite to be visible but not too large
		this.sprite.scale.set(1.5, 0.2, 1);
	}

	update(deltaTime: number): void {
		if (!this.entity) return;

		// Get the resource entity and its mesh
		const resourceEntity = this.entity as ResourceEntity;
		const mesh = resourceEntity.getMesh();
		if (!mesh) return;

		// Calculate mesh height by getting the bounding box
		const boundingBox = new THREE.Box3().setFromObject(mesh);
		const meshHeight = boundingBox.max.y - boundingBox.min.y;

		// Position health bar just above the mesh
		const entityPosition = this.entity.getTransform().position;
		this.sprite.position
			.copy(entityPosition)
			.add(new THREE.Vector3(0, meshHeight + 0.3, 0));

		// Update health bar appearance
		const health = this.healthComponent.getCurrentHealth();
		const maxHealth = this.healthComponent.getMaxHealth();
		const healthPercentage = health / maxHealth;

		// Clear canvas
		this.context.clearRect(0, 0, this.width, this.height);

		// Draw background
		this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';
		this.context.fillRect(0, 0, this.width, this.height);

		// Draw health bar
		this.context.fillStyle = this.getHealthColor(healthPercentage);
		this.context.fillRect(0, 0, this.width * healthPercentage, this.height);

		// Update texture
		this.texture.needsUpdate = true;

		// Make sprite face camera
		const sceneData = this.entity.getScene();
		if (sceneData?.camera) {
			this.sprite.quaternion.copy(sceneData.camera.quaternion);
		}
	}

	private getHealthColor(percentage: number): string {
		if (percentage > 0.6) return '#2ecc71'; // Green
		if (percentage > 0.3) return '#f1c40f'; // Yellow
		return '#e74c3c'; // Red
	}

	getSprite(): THREE.Sprite {
		return this.sprite;
	}

	cleanup(): void {
		if (this.sprite.material.map) {
			this.sprite.material.map.dispose();
		}
		this.sprite.material.dispose();
		if (this.sprite.parent) {
			this.sprite.parent.remove(this.sprite);
		}
	}
}
