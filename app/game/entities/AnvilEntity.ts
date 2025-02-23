import * as THREE from 'three';
import { Entity } from '../core/Entity';
import { EntityConfig } from '../core/Transform';

export class AnvilEntity extends Entity {
	private mesh: THREE.Group;
	private isInteractable: boolean = true;
	private isInConversation: boolean = false;
	private glowMaterial: THREE.MeshStandardMaterial;
	private originalMaterials: Map<THREE.Mesh, THREE.Material> = new Map();

	constructor(config: EntityConfig = {}) {
		super(config);
		this.mesh = this.createVisuals();
		this.mesh.position.copy(this.transform.position);

		// Create glow material for hover effect
		this.glowMaterial = new THREE.MeshStandardMaterial({
			color: 0x404040,
			metalness: 0.8,
			roughness: 0.2,
			emissive: 0x404040,
			emissiveIntensity: 0.5,
		});
	}

	private createVisuals(): THREE.Group {
		const group = new THREE.Group();

		// Material with metallic properties
		const anvilMaterial = new THREE.MeshStandardMaterial({
			color: 0x404040,
			metalness: 0.8,
			roughness: 0.2,
		});

		// Base
		const baseGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.5);
		const base = new THREE.Mesh(baseGeometry, anvilMaterial);
		base.position.y = 0.15;
		group.add(base);
		this.originalMaterials.set(base, base.material);

		// Main body
		const bodyGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
		const body = new THREE.Mesh(bodyGeometry, anvilMaterial);
		body.position.y = 0.5;
		group.add(body);
		this.originalMaterials.set(body, body.material);

		// Top working surface
		const topGeometry = new THREE.BoxGeometry(0.7, 0.2, 0.35);
		const top = new THREE.Mesh(topGeometry, anvilMaterial);
		top.position.y = 0.8;
		group.add(top);
		this.originalMaterials.set(top, top.material);

		// Horn (pointed end)
		const hornGeometry = new THREE.CylinderGeometry(0.08, 0.15, 0.3, 8);
		const horn = new THREE.Mesh(hornGeometry, anvilMaterial);
		horn.rotation.z = Math.PI / 2;
		horn.position.set(0.5, 0.8, 0);
		group.add(horn);
		this.originalMaterials.set(horn, horn.material);

		// Add some wear and tear details using small indentations
		const detailMaterial = new THREE.MeshStandardMaterial({
			color: 0x303030,
			metalness: 0.7,
			roughness: 0.4,
		});

		// Add some random dents and marks on the top surface
		for (let i = 0; i < 5; i++) {
			const markGeometry = new THREE.CircleGeometry(0.02, 8);
			const mark = new THREE.Mesh(markGeometry, detailMaterial);
			mark.rotation.x = -Math.PI / 2;
			mark.position.set(
				(Math.random() - 0.5) * 0.3,
				0.91,
				(Math.random() - 0.5) * 0.2
			);
			group.add(mark);
			this.originalMaterials.set(mark, mark.material);
		}

		// Set up shadows
		group.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.castShadow = true;
				child.receiveShadow = true;
			}
		});

		return group;
	}

	public getMesh(): THREE.Group {
		return this.mesh;
	}

	public getInteractionMesh(): THREE.Group {
		return this.mesh;
	}

	public setInConversation(inConversation: boolean): void {
		this.isInConversation = inConversation;
		this.setGlowEffect(inConversation);
	}

	public isInteracting(): boolean {
		return this.isInConversation;
	}

	private setGlowEffect(enabled: boolean): void {
		this.mesh.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				if (enabled) {
					child.material = this.glowMaterial;
				} else {
					const originalMaterial = this.originalMaterials.get(child);
					if (originalMaterial) {
						child.material = originalMaterial;
					}
				}
			}
		});
	}

	public setScene(scene: THREE.Scene): void {
		super.setScene(scene);
		if (scene) {
			scene.add(this.mesh);
		}
	}

	update(deltaTime: number): void {
		super.update(deltaTime);
		// Update mesh position to match transform
		this.mesh.position.copy(this.transform.position);
		this.mesh.quaternion.copy(this.transform.rotation);
	}

	cleanup(): void {
		super.cleanup();
		if (this.scene) {
			this.scene.remove(this.mesh);
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
		this.originalMaterials.clear();
		this.glowMaterial.dispose();
	}
}
