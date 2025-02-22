import { Vector3, Quaternion } from 'three';
import { Component } from '../core/Component';
import { Entity } from '../core/Entity';

export class PlayerMovementComponent extends Component {
	private speed: number;
	private turnRate: number;
	private moveDirection: Vector3 = new Vector3();
	private keys: { [key: string]: boolean } = {
		w: false,
		s: false,
		a: false,
		d: false,
		q: false,
		e: false,
	};

	constructor(speed: number = 5, turnRate: number = 3) {
		super();
		this.speed = speed;
		this.turnRate = turnRate;

		// Add keyboard listeners
		window.addEventListener('keydown', this.handleKeyDown);
		window.addEventListener('keyup', this.handleKeyUp);
	}

	private handleKeyDown = (event: KeyboardEvent) => {
		const key = event.key.toLowerCase();
		if (key in this.keys) {
			this.keys[key] = true;
		}
	};

	private handleKeyUp = (event: KeyboardEvent) => {
		const key = event.key.toLowerCase();
		if (key in this.keys) {
			this.keys[key] = false;
		}
	};

	update(deltaTime: number): void {
		if (!this.entity) return;

		const transform = this.entity.getTransform();
		this.moveDirection.set(0, 0, 0);

		// Get forward and right vectors based on current rotation
		const forward = new Vector3(0, 0, -1).applyQuaternion(transform.rotation);
		const right = new Vector3(1, 0, 0).applyQuaternion(transform.rotation);

		// Forward/Backward
		if (this.keys['w']) this.moveDirection.add(forward);
		if (this.keys['s']) this.moveDirection.sub(forward);

		// Strafe Left/Right
		if (this.keys['q']) this.moveDirection.sub(right);
		if (this.keys['e']) this.moveDirection.add(right);

		// Rotate Left/Right
		if (this.keys['a']) {
			transform.rotation.multiply(
				new Quaternion().setFromAxisAngle(
					new Vector3(0, 1, 0),
					this.turnRate * deltaTime
				)
			);
		}
		if (this.keys['d']) {
			transform.rotation.multiply(
				new Quaternion().setFromAxisAngle(
					new Vector3(0, 1, 0),
					-this.turnRate * deltaTime
				)
			);
		}

		// Normalize and apply movement
		if (this.moveDirection.lengthSq() > 0) {
			this.moveDirection.normalize();
			const movement = this.moveDirection.multiplyScalar(
				this.speed * deltaTime
			);
			transform.position.add(movement);
		}
	}

	cleanup(): void {
		// Clean up event listeners
		window.removeEventListener('keydown', this.handleKeyDown);
		window.removeEventListener('keyup', this.handleKeyUp);
	}
}
