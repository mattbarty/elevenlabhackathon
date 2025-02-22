import { Vector3, Quaternion } from 'three';

export interface Transform {
	position: Vector3;
	rotation: Quaternion;
	scale: Vector3;
}

export interface EntityConfig {
	position?: Vector3;
	rotation?: Quaternion;
	scale?: Vector3;
}

export const TransformUtils = {
	createDefault(): Transform {
		return {
			position: new Vector3(0, 0, 0),
			rotation: new Quaternion(),
			scale: new Vector3(1, 1, 1),
		};
	},

	clone(transform: Transform): Transform {
		return {
			position: transform.position.clone(),
			rotation: transform.rotation.clone(),
			scale: transform.scale.clone(),
		};
	},
};
