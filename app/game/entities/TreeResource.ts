import * as THREE from 'three';
import { ResourceEntity } from './ResourceEntity';
import { ResourceType } from '../types/resources';

export class TreeResource extends ResourceEntity {
	protected createVisuals(): void {
		const group = new THREE.Group();

		// Create trunk
		const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
		const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5f39 });
		const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
		trunk.position.y = 1;
		group.add(trunk);

		// Create leaves
		const leavesGeometry = new THREE.ConeGeometry(1, 3, 8);
		const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x5a7c45 });
		const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
		leaves.position.y = 2.5;
		group.add(leaves);

		// Set up the mesh
		this.mesh = group as unknown as THREE.Mesh;
		this.mesh.position.copy(this.transform.position);
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
	}
}
