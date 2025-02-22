import * as THREE from 'three';

interface EyeConfig {
	size?: number;
	yPosition?: number;
	zOffset?: number;
	spacing?: number;
	roughness?: number;
	metalness?: number;
}

function createEyes(config: EyeConfig = {}): THREE.Group {
	const {
		size = 0.05,
		yPosition = 1.3,
		zOffset = 0.22,
		spacing = 0.24,
		roughness = 0.3,
		metalness = 0.7,
	} = config;

	const eyesGroup = new THREE.Group();

	// Create eye material with shine
	const eyeMaterial = new THREE.MeshStandardMaterial({
		color: 0x000000,
		roughness,
		metalness,
	});

	// Create eye geometry
	const eyeGeometry = new THREE.SphereGeometry(size, 12, 12);

	// Left eye
	const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
	leftEye.position.set(-spacing / 2, yPosition, zOffset);
	eyesGroup.add(leftEye);

	// Right eye
	const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
	rightEye.position.set(spacing / 2, yPosition, zOffset);
	eyesGroup.add(rightEye);

	// Add highlights for cuteness
	const highlightMaterial = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		roughness: 0.1,
		metalness: 0.9,
	});
	const highlightGeometry = new THREE.SphereGeometry(size * 0.3, 8, 8);

	// Left eye highlight
	const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
	leftHighlight.position.set(
		-spacing / 2 - 0.01,
		yPosition + 0.02,
		zOffset + 0.03
	);
	eyesGroup.add(leftHighlight);

	// Right eye highlight
	const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
	rightHighlight.position.set(
		spacing / 2 - 0.01,
		yPosition + 0.02,
		zOffset + 0.03
	);
	eyesGroup.add(rightHighlight);

	return eyesGroup;
}

export function createKingVisuals(): THREE.Group {
	const group = new THREE.Group();
	const material = new THREE.MeshStandardMaterial({
		color: 0x2c698d,
		roughness: 0.7,
	});

	// Base
	const baseGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.2, 16);
	const base = new THREE.Mesh(baseGeometry, material);
	base.position.y = 0.1;
	group.add(base);

	// Body
	const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.35, 0.9, 16);
	const body = new THREE.Mesh(bodyGeometry, material);
	body.position.y = 0.65;
	group.add(body);

	// Upper body
	const upperBodyGeometry = new THREE.CylinderGeometry(0.3, 0.25, 0.3, 16);
	const upperBody = new THREE.Mesh(upperBodyGeometry, material);
	upperBody.position.y = 1.25;
	group.add(upperBody);

	// Add eyes
	const eyes = createEyes({
		size: 0.05,
		yPosition: 1.3,
		zOffset: -0.22,
		spacing: 0.24,
	});
	group.add(eyes);

	// Crown base
	const crownBaseGeometry = new THREE.CylinderGeometry(0.35, 0.3, 0.15, 16);
	const crownBase = new THREE.Mesh(crownBaseGeometry, material);
	crownBase.position.y = 1.475;
	group.add(crownBase);

	// Crown points
	const numPoints = 5;
	const pointRadius = 0.3;
	for (let i = 0; i < numPoints; i++) {
		const angle = (i / numPoints) * Math.PI * 2;
		const pointGeometry = new THREE.ConeGeometry(0.07, 0.2, 8);
		const point = new THREE.Mesh(pointGeometry, material);
		point.position.set(
			Math.cos(angle) * pointRadius,
			1.65,
			Math.sin(angle) * pointRadius
		);
		group.add(point);
	}

	// Center cross
	const crossVerticalGeometry = new THREE.BoxGeometry(0.07, 0.3, 0.07);
	const crossVertical = new THREE.Mesh(crossVerticalGeometry, material);
	crossVertical.position.y = 1.65;
	group.add(crossVertical);

	const crossHorizontalGeometry = new THREE.BoxGeometry(0.18, 0.07, 0.07);
	const crossHorizontal = new THREE.Mesh(crossHorizontalGeometry, material);
	crossHorizontal.position.y = 1.7;
	group.add(crossHorizontal);

	// Set up shadows
	group.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			child.castShadow = true;
			child.receiveShadow = true;
		}
	});

	return group;
}

export function createPawnVisuals(): THREE.Group {
	const group = new THREE.Group();
	const material = new THREE.MeshStandardMaterial({
		color: 0x8c6d4a,
		roughness: 0.7,
	});

	// Base
	const baseGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 16);
	const base = new THREE.Mesh(baseGeometry, material);
	base.position.y = 0.1;
	group.add(base);

	// Body
	const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.3, 0.6, 16);
	const body = new THREE.Mesh(bodyGeometry, material);
	body.position.y = 0.5;
	group.add(body);

	// Head
	const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
	const head = new THREE.Mesh(headGeometry, material);
	head.position.y = 1.0;
	group.add(head);

	// Add eyes
	const eyes = createEyes({
		size: 0.04,
		yPosition: 1.05,
		zOffset: 0.2,
		spacing: 0.2,
		roughness: 0.5,
		metalness: 0.5,
	});
	group.add(eyes);

	// Set up shadows
	group.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			child.castShadow = true;
			child.receiveShadow = true;
		}
	});

	return group;
}

export function createRookVisuals(): THREE.Group {
	const group = new THREE.Group();
	const material = new THREE.MeshStandardMaterial({
		color: 0x4a6d8c,
		roughness: 0.7,
	});

	// Base
	const baseGeometry = new THREE.CylinderGeometry(0.35, 0.45, 0.2, 8);
	const base = new THREE.Mesh(baseGeometry, material);
	base.position.y = 0.1;
	group.add(base);

	// Body
	const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8);
	const body = new THREE.Mesh(bodyGeometry, material);
	body.position.y = 0.6;
	group.add(body);

	// Add eyes
	const eyes = createEyes({
		size: 0.04,
		yPosition: 0.9,
		zOffset: 0.25,
		spacing: 0.24,
		roughness: 0.5,
		metalness: 0.5,
	});
	group.add(eyes);

	// Top crown
	const crownGroup = new THREE.Group();
	crownGroup.position.y = 1.1;

	// Main crown cylinder
	const crownBaseGeometry = new THREE.CylinderGeometry(0.4, 0.3, 0.2, 8);
	const crownBase = new THREE.Mesh(crownBaseGeometry, material);
	crownGroup.add(crownBase);

	// Battlements
	const numBattlements = 4;
	for (let i = 0; i < numBattlements; i++) {
		const angle = (i / numBattlements) * Math.PI * 2;
		const battlementGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.15);
		const battlement = new THREE.Mesh(battlementGeometry, material);
		battlement.position.set(
			Math.cos(angle) * 0.25,
			0.2,
			Math.sin(angle) * 0.25
		);
		crownGroup.add(battlement);
	}

	group.add(crownGroup);

	// Set up shadows
	group.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			child.castShadow = true;
			child.receiveShadow = true;
		}
	});

	return group;
}
