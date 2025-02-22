import * as THREE from 'three';
import { ResourceEntity } from './ResourceEntity';
import { ResourceType } from '../types/resources';

export class StoneResource extends ResourceEntity {
	protected createVisuals(): void {
		// Create a low-poly rock using IcosahedronGeometry
		const geometry = new THREE.IcosahedronGeometry(0.5, 0);
		const material = new THREE.MeshStandardMaterial({
			color: 0x808080,
			roughness: 0.8,
			metalness: 0.2,
		});

		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.copy(this.transform.position);
		this.mesh.rotation.set(
			Math.random() * Math.PI,
			Math.random() * Math.PI,
			Math.random() * Math.PI
		);
		this.mesh.scale.set(1, 0.7, 1); // Slightly flattened
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
	}
}
