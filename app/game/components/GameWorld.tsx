'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlayerEntity } from '../entities/PlayerEntity';
import { EntityManager } from '../core/EntityManager';
import { ResourceManager } from '../managers/ResourceManager';
import { ResourceType } from '../types/resources';
import { GameGUI } from './GameGUI';
import { useGameContext } from '../context/GameContext';
import { ResourceEntity } from '../entities/ResourceEntity';
import { NPCEntity } from '../entities/NPCEntity';
import { NPCProfession } from '../types/npc';

// Helper function to create a stylized tree with varying size
function createTree(height: number = 2): THREE.Group {
  const tree = new THREE.Group();

  // Create trunk with slight random variation
  const trunkHeight = height * 0.4;
  const trunkRadius = 0.1 + (height * 0.05); // Thicker trunk for taller trees
  const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.5, trunkHeight, 5);

  // Create trunk material with natural color variation
  const trunkHue = 0.25 + (Math.random() * 0.1); // Range around green-brown
  const trunkSaturation = 0.3 + (Math.random() * 0.2);
  const trunkLightness = 0.25 + (Math.random() * 0.1);
  const trunkColor = new THREE.Color().setHSL(trunkHue, trunkSaturation, trunkLightness);

  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: trunkColor,
    roughness: 0.8 + Math.random() * 0.2
  });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = trunkHeight * 0.5;

  // Create leaves with variation
  const leavesHeight = height * 0.8;
  const leavesRadius = 0.3 + (height * 0.15); // Wider canopy for taller trees
  const leavesGeometry = new THREE.ConeGeometry(leavesRadius, leavesHeight, 6);

  // Create leaves material with natural color variation
  const leafHue = 0.3 + (Math.random() * 0.1); // Range around green
  const leafSaturation = 0.4 + (Math.random() * 0.3);
  const leafLightness = 0.3 + (Math.random() * 0.2);
  const leafColor = new THREE.Color().setHSL(leafHue, leafSaturation, leafLightness);

  const leavesMaterial = new THREE.MeshStandardMaterial({
    color: leafColor,
    roughness: 0.6 + Math.random() * 0.2
  });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves.position.y = trunkHeight * 0.8 + leavesHeight * 0.5;

  // Add slight random rotation for variety
  tree.rotation.y = Math.random() * Math.PI * 2;
  tree.rotation.x = (Math.random() - 0.5) * 0.2;
  tree.rotation.z = (Math.random() - 0.5) * 0.2;

  tree.add(trunk);
  tree.add(leaves);
  return tree;
}

// Helper function to create a stylized rock with more variety
function createRock(size: 'small' | 'medium' | 'large' | 'landmark' = 'medium'): THREE.Mesh {
  const sizeScales = {
    small: { base: 0.3, variation: 0.1 },
    medium: { base: 0.6, variation: 0.2 },
    large: { base: 1.2, variation: 0.4 },
    landmark: { base: 2.5, variation: 0.5 }
  };

  const scale = sizeScales[size];
  const baseSize = scale.base + Math.random() * scale.variation;

  // Use different geometry types for variety
  let geometry;
  const rockType = Math.random();
  if (rockType < 0.4) {
    // Rough boulder
    geometry = new THREE.IcosahedronGeometry(baseSize, size === 'landmark' ? 2 : 1);
  } else if (rockType < 0.7) {
    // Angular rock
    geometry = new THREE.OctahedronGeometry(baseSize, size === 'landmark' ? 1 : 0);
  } else {
    // Smooth rock
    geometry = new THREE.SphereGeometry(baseSize, size === 'landmark' ? 6 : 4, size === 'landmark' ? 6 : 4);
  }

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x808080).multiplyScalar(0.8 + Math.random() * 0.4),
    roughness: 0.7 + Math.random() * 0.3,
    metalness: 0.1 + Math.random() * 0.1
  });

  const rock = new THREE.Mesh(geometry, material);

  // Apply random scaling for more natural look
  rock.scale.x = 0.8 + Math.random() * 0.4;
  rock.scale.y = 0.4 + Math.random() * 0.3;
  rock.scale.z = 0.8 + Math.random() * 0.4;

  // Random rotation
  rock.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );

  return rock;
}

// Helper function to create a tree cluster
function createTreeCluster(centerPos: THREE.Vector3, radius: number, density: number): {
  treePositions: THREE.Vector3[];
  stonePositions: Array<{ position: THREE.Vector3; size: 'small' | 'medium'; }>;
} {
  const treePositions: THREE.Vector3[] = [];
  const stonePositions: Array<{ position: THREE.Vector3; size: 'small' | 'medium'; }> = [];
  const numTrees = Math.floor(5 + Math.random() * density);

  // Create trees
  for (let i = 0; i < numTrees; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.pow(Math.random(), 0.5) * radius;
    const offset = new THREE.Vector3(
      Math.cos(angle) * distance,
      0,
      Math.sin(angle) * distance
    );
    const position = centerPos.clone().add(offset);
    treePositions.push(position);
  }

  // Add some stones to the forest (20% chance per cluster)
  if (Math.random() < 0.2) {
    const numStones = 1 + Math.floor(Math.random() * 3); // 1-3 stones
    for (let i = 0; i < numStones; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius * 0.8; // Keep stones within 80% of cluster radius
      const position = centerPos.clone().add(
        new THREE.Vector3(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        )
      );
      stonePositions.push({
        position,
        size: Math.random() < 0.7 ? 'small' : 'medium'
      });
    }
  }

  return { treePositions, stonePositions };
}

// Helper function to create a rock formation
function createRockFormation(centerPos: THREE.Vector3, radius: number): { position: THREE.Vector3; size: 'small' | 'medium' | 'large' | 'landmark'; }[] {
  const rocks: { position: THREE.Vector3; size: 'small' | 'medium' | 'large' | 'landmark'; }[] = [];

  // Chance for a landmark rock (10% chance)
  if (Math.random() < 0.1) {
    rocks.push({ position: centerPos.clone(), size: 'landmark' });
  } else {
    // Add one large central rock
    rocks.push({ position: centerPos.clone(), size: 'large' });
  }

  // Add medium rocks around
  const numMedium = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numMedium; i++) {
    const angle = (i / numMedium) * Math.PI * 2 + Math.random() * 0.5;
    const distance = radius * (0.4 + Math.random() * 0.3);
    const position = centerPos.clone().add(
      new THREE.Vector3(
        Math.cos(angle) * distance,
        0,
        Math.sin(angle) * distance
      )
    );
    rocks.push({ position, size: 'medium' });
  }

  // Add small rocks
  const numSmall = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numSmall; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = radius * (0.2 + Math.random() * 0.8);
    const position = centerPos.clone().add(
      new THREE.Vector3(
        Math.cos(angle) * distance,
        0,
        Math.sin(angle) * distance
      )
    );
    rocks.push({ position, size: 'small' });
  }

  return rocks;
}

// Helper function to calculate the ideal camera position behind the player
function calculateIdealCameraPosition(
  playerPosition: THREE.Vector3,
  playerRotation: THREE.Quaternion,
  distance: number = 8,
  height: number = 5
): THREE.Vector3 {
  // Get the backward direction from the player's rotation
  const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(playerRotation);
  // Calculate the ideal position
  return new THREE.Vector3()
    .copy(playerPosition)
    .add(backward.multiplyScalar(distance))
    .add(new THREE.Vector3(0, height, 0));
}

export default function GameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<PlayerEntity | null>(null);
  const playerMeshRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number>(0);
  const controlsRef = useRef<OrbitControls | null>(null);
  const lastPlayerPosition = useRef(new THREE.Vector3());
  const lastPlayerRotation = useRef(new THREE.Quaternion());
  const isMoving = useRef(false);
  const entityManagerRef = useRef<EntityManager>(EntityManager.getInstance());
  const [timeOfDay, setTimeOfDay] = useState(12); // Start at noon
  const TIME_SCALE = 0.1; // 1 game hour = 10 real seconds
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const [selectedNPC, setSelectedNPC] = useState<NPCEntity | null>(null);

  const gameContext = useGameContext();

  // Update handleClick to handle NPC selection
  const handleClick = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !sceneRef.current || !cameraRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = containerRef.current.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Get all entities that can be targeted
    const entities = entityManagerRef.current
      .getAllEntities()
      .filter((entity): entity is (ResourceEntity | NPCEntity) =>
        entity instanceof ResourceEntity || entity instanceof NPCEntity
      );

    // Get all meshes that can be targeted
    const targetableMeshes = entities
      .map(entity => {
        const mesh = entity instanceof ResourceEntity ? entity.getMesh() : (entity as NPCEntity).getMesh();
        if (mesh) {
          // Store the entity reference on the mesh for later lookup
          (mesh as any).entity = entity;
        }
        return mesh;
      })
      .filter((obj): obj is THREE.Group | THREE.Mesh => obj !== null);

    // Find intersections with meshes and their children
    const intersects = raycaster.intersectObjects([...targetableMeshes], true);

    if (intersects.length > 0) {
      // Find the entity that owns this mesh
      let targetObject: THREE.Object3D | null = intersects[0].object;

      // Traverse up to find the top-level object with the entity reference
      while (targetObject && !(targetObject as any).entity) {
        targetObject = targetObject.parent;
      }

      if (targetObject && (targetObject as any).entity) {
        const entity = (targetObject as any).entity as (ResourceEntity | NPCEntity);

        if (entity instanceof ResourceEntity) {
          // Handle resource targeting as before
          if (gameContext.targetedEntity !== null) {
            const prevResource = entities.find(r =>
              r instanceof ResourceEntity && r.getId() === gameContext.targetedEntity
            ) as ResourceEntity;
            if (prevResource) {
              prevResource.setTargeted(false);
            }
          }
          entity.setTargeted(true);
          gameContext.setTargetedEntity(entity.getId());
          setSelectedNPC(null);
        } else if (entity instanceof NPCEntity) {
          // Handle NPC selection
          setSelectedNPC(entity);
          if (gameContext.targetedEntity !== null) {
            const prevResource = entities.find(r =>
              r instanceof ResourceEntity && r.getId() === gameContext.targetedEntity
            ) as ResourceEntity;
            if (prevResource) {
              prevResource.setTargeted(false);
            }
            gameContext.setTargetedEntity(null);
          }
        }
      }
    } else {
      // Clear selections when clicking empty space
      if (gameContext.targetedEntity !== null) {
        const prevResource = entities.find(r =>
          r instanceof ResourceEntity && r.getId() === gameContext.targetedEntity
        ) as ResourceEntity;
        if (prevResource) {
          prevResource.setTargeted(false);
        }
        gameContext.setTargetedEntity(null);
      }
      setSelectedNPC(null);
    }
  }, [gameContext]);

  // Add right-click handler for NPC movement
  const handleContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    if (!selectedNPC || !containerRef.current || !sceneRef.current || !cameraRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const rect = containerRef.current.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, cameraRef.current);

    // Find intersection with ground plane
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, targetPoint);

    if (targetPoint) {
      selectedNPC.MoveTo(targetPoint);
    }
  }, [selectedNPC]);

  // Handle resource hover effects
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !sceneRef.current || !cameraRef.current) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = containerRef.current.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Get all resources and their meshes
    const resources = entityManagerRef.current
      .getAllEntities()
      .filter((entity): entity is ResourceEntity => entity instanceof ResourceEntity);

    const resourceObjects = resources
      .map(resource => resource.getMesh())
      .filter((obj): obj is THREE.Mesh | THREE.Group => obj !== null);

    // Reset all resource hover states
    resourceObjects.forEach(object => {
      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissive.setScalar(0);
        }
      });
    });

    // Find intersections with all meshes
    const intersects = raycaster.intersectObjects(resourceObjects, true);

    // Highlight hovered resource
    if (intersects.length > 0) {
      // Find the top-level mesh/group
      let targetObject = intersects[0].object;
      while (targetObject.parent && !(targetObject.parent instanceof THREE.Scene)) {
        targetObject = targetObject.parent;
      }

      // Apply hover effect to all child meshes
      targetObject.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissive.setScalar(0.2);
        }
      });

      containerRef.current.style.cursor = 'pointer';
    } else {
      containerRef.current.style.cursor = 'default';
    }
  }, []);

  // Add event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('click', handleClick);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('contextmenu', handleContextMenu);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleClick, handleMouseMove, handleContextMenu]);

  // Effect for handling lighting updates
  useEffect(() => {
    if (!sceneRef.current || !ambientLightRef.current || !directionalLightRef.current) return;

    ambientLightRef.current.intensity = gameContext.ambientIntensity;
    directionalLightRef.current.intensity = gameContext.lightIntensity;
    directionalLightRef.current.color.copy(gameContext.lightColor);

    if (sceneRef.current.fog instanceof THREE.FogExp2) {
      sceneRef.current.fog.color.copy(gameContext.lightColor);
    }
    if (sceneRef.current.background instanceof THREE.Color) {
      (sceneRef.current.background as THREE.Color).copy(
        gameContext.lightColor.clone().multiplyScalar(0.5)
      );
    }
  }, [gameContext]);

  useEffect(() => {
    // Prevent double initialization
    if (sceneRef.current || !containerRef.current) return;

    // Initialize Three.js scene with fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x88c773, 0.02);
    scene.background = new THREE.Color(0x88c773);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer with shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create ground with grid
    const groundSize = 50;
    const gridDivisions = 50;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, gridDivisions, gridDivisions);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x7cb668,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(groundSize, gridDivisions, 0x538d4e, 0x538d4e);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, gameContext.ambientIntensity);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const directionalLight = new THREE.DirectionalLight(0xffffff, gameContext.lightIntensity);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.color.copy(gameContext.lightColor);
    scene.add(directionalLight);
    directionalLightRef.current = directionalLight;

    // Initialize resource manager and create resources
    const resourceManager = ResourceManager.getInstance();

    // Create tree clusters (reduced number)
    const numClusters = 3;
    for (let i = 0; i < numClusters; i++) {
      const angle = (i / numClusters) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 8 + Math.random() * 15;
      const clusterCenter = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      );

      // Create trees and stones in cluster
      const { treePositions, stonePositions } = createTreeCluster(clusterCenter, 5, 8);

      // Create trees in cluster
      for (const position of treePositions) {
        // Calculate tree health based on random factors
        const baseHealth = 100;
        const healthVariation = Math.random() * 50;
        const health = baseHealth + healthVariation;

        // Calculate tree height based on health
        const minHeight = 1.5;
        const maxHeight = 3.0;
        const heightRange = maxHeight - minHeight;
        const healthRange = 50;
        const height = minHeight + (heightRange * (healthVariation / healthRange));

        const tree = resourceManager.createResource({
          type: ResourceType.TREE,
          position: position,
          properties: {
            maxHealth: health,
          }
        });
        const treeMesh = tree.getMesh();
        if (treeMesh !== null) {
          treeMesh.scale.setScalar(height / 2);
          scene.add(treeMesh);
        }
        tree.setScene(scene);
      }

      // Create forest stones
      for (const stone of stonePositions) {
        const stoneResource = resourceManager.createResource({
          type: ResourceType.STONE,
          position: stone.position,
          properties: {
            maxHealth: stone.size === 'medium' ? 200 + Math.random() * 50 : 100 + Math.random() * 50,
          }
        });
        const stoneMesh = stoneResource.getMesh();
        if (stoneMesh !== null) {
          scene.add(stoneMesh);
        }
        stoneResource.setScene(scene);
      }
    }

    // Create scattered individual trees
    const numScatteredTrees = 20;
    for (let i = 0; i < numScatteredTrees; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 20; // Wider distribution
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      );

      // Add some random offset to break up the circular pattern
      position.x += (Math.random() - 0.5) * 5;
      position.z += (Math.random() - 0.5) * 5;

      const baseHealth = 100;
      const healthVariation = Math.random() * 50;
      const health = baseHealth + healthVariation;
      const height = 1.5 + (1.5 * (healthVariation / 50));

      const tree = resourceManager.createResource({
        type: ResourceType.TREE,
        position: position,
        properties: {
          maxHealth: health,
        }
      });
      const treeMesh = tree.getMesh();
      if (treeMesh !== null) {
        treeMesh.scale.setScalar(height / 2);
        scene.add(treeMesh);
      }
      tree.setScene(scene);
    }

    // Create rock formations (reduced number)
    const numFormations = 2;
    for (let i = 0; i < numFormations; i++) {
      const angle = (i / numFormations) * Math.PI * 2 + Math.random();
      const radius = 10 + Math.random() * 15;
      const formationCenter = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      );

      const rocks = createRockFormation(formationCenter, 4);
      for (const rock of rocks) {
        const stone = resourceManager.createResource({
          type: ResourceType.STONE,
          position: rock.position,
          properties: {
            maxHealth: rock.size === 'landmark' ? 800 + Math.random() * 200 :
              rock.size === 'large' ? 400 + Math.random() * 100 :
                rock.size === 'medium' ? 250 + Math.random() * 100 :
                  150 + Math.random() * 50,
          }
        });
        const stoneMesh = stone.getMesh();
        if (stoneMesh !== null) {
          scene.add(stoneMesh);
        }
        stone.setScene(scene);
      }
    }

    // Create scattered individual rocks
    const numScatteredRocks = 15;
    for (let i = 0; i < numScatteredRocks; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 20;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      );

      // Add random offset to break up the circular pattern
      position.x += (Math.random() - 0.5) * 5;
      position.z += (Math.random() - 0.5) * 5;

      // Determine rock size with bias towards smaller rocks
      const sizeRoll = Math.random();
      const size = sizeRoll < 0.6 ? 'small' :
        sizeRoll < 0.9 ? 'medium' :
          'large';

      const stone = resourceManager.createResource({
        type: ResourceType.STONE,
        position: position,
        properties: {
          maxHealth: size === 'large' ? 400 + Math.random() * 100 :
            size === 'medium' ? 250 + Math.random() * 100 :
              150 + Math.random() * 50,
        }
      });
      const stoneMesh = stone.getMesh();
      if (stoneMesh !== null) {
        scene.add(stoneMesh);
      }
      stone.setScene(scene);
    }

    // Create player with stylized look
    const player = new PlayerEntity({
      position: new THREE.Vector3(0, 0, 0),
      speed: 5,
      turnRate: 3,
    });
    playerRef.current = player;
    entityManagerRef.current.addEntity(player);

    // Create player mesh as a king chess piece
    const playerGroup = new THREE.Group();

    // Base
    const baseGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.2, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c698d,
      roughness: 0.7
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.1;
    playerGroup.add(base);

    // Body - made more slender
    const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.35, 0.9, 16);
    const body = new THREE.Mesh(bodyGeometry, baseMaterial);
    body.position.y = 0.65;
    playerGroup.add(body);

    // Upper body - adjusted proportions
    const upperBodyGeometry = new THREE.CylinderGeometry(0.3, 0.25, 0.3, 16);
    const upperBody = new THREE.Mesh(upperBodyGeometry, baseMaterial);
    upperBody.position.y = 1.25;
    playerGroup.add(upperBody);

    // Add cute eyes (slightly larger than NPC eyes)
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.3,  // More glossy than NPC eyes
      metalness: 0.7   // More metallic for a shiny look
    });
    const eyeGeometry = new THREE.SphereGeometry(0.05, 12, 12);  // Larger and smoother than NPC eyes

    // Left eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.12, 1.3, 0.22);
    playerGroup.add(leftEye);

    // Right eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.12, 1.3, 0.22);
    playerGroup.add(rightEye);

    // Crown base - slightly smaller
    const crownBaseGeometry = new THREE.CylinderGeometry(0.35, 0.3, 0.15, 16);
    const crownBase = new THREE.Mesh(crownBaseGeometry, baseMaterial);
    crownBase.position.y = 1.475;
    playerGroup.add(crownBase);

    // Crown points - adjusted position
    const numPoints = 5;
    const pointRadius = 0.3;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const pointGeometry = new THREE.ConeGeometry(0.07, 0.2, 8);
      const point = new THREE.Mesh(pointGeometry, baseMaterial);
      point.position.set(
        Math.cos(angle) * pointRadius,
        1.65,
        Math.sin(angle) * pointRadius
      );
      playerGroup.add(point);
    }

    // Center cross - adjusted position
    const crossVerticalGeometry = new THREE.BoxGeometry(0.07, 0.3, 0.07);
    const crossVertical = new THREE.Mesh(crossVerticalGeometry, baseMaterial);
    crossVertical.position.y = 1.65;
    playerGroup.add(crossVertical);

    const crossHorizontalGeometry = new THREE.BoxGeometry(0.18, 0.07, 0.07);
    const crossHorizontal = new THREE.Mesh(crossHorizontalGeometry, baseMaterial);
    crossHorizontal.position.y = 1.7;
    playerGroup.add(crossHorizontal);

    // Set up the mesh group
    playerGroup.position.copy(player.getTransform().position);
    playerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(playerGroup);
    playerMeshRef.current = playerGroup as unknown as THREE.Mesh;

    // Add orbit controls with constraints
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;

    // Set initial camera position and store initial player state
    camera.position.set(0, 8, 12);
    controls.target.copy(player.getTransform().position);
    lastPlayerPosition.current.copy(player.getTransform().position);
    lastPlayerRotation.current.copy(player.getTransform().rotation);

    // Animation loop
    let lastTime = 0;
    const animate = (time: number) => {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      // Update time of day
      setTimeOfDay(prevTime => {
        const newTime = (prevTime + deltaTime * TIME_SCALE) % 24;
        return newTime;
      });

      entityManagerRef.current.update(deltaTime);

      if (playerRef.current && playerMeshRef.current) {
        const transform = playerRef.current.getTransform();
        playerMeshRef.current.position.copy(transform.position);
        playerMeshRef.current.quaternion.copy(transform.rotation);

        // Check if player is moving or rotating
        const moveThreshold = 0.001;
        const rotationThreshold = 0.0001; // More sensitive rotation threshold

        const isPositionChanged = transform.position.distanceToSquared(lastPlayerPosition.current) > moveThreshold;

        // Calculate rotation difference using angle
        const currentRotationAngle = new THREE.Euler().setFromQuaternion(transform.rotation).y;
        const lastRotationAngle = new THREE.Euler().setFromQuaternion(lastPlayerRotation.current).y;
        const rotationDiff = Math.abs(currentRotationAngle - lastRotationAngle);
        const isRotationChanged = rotationDiff > rotationThreshold;

        isMoving.current = isPositionChanged || isRotationChanged;

        if (isMoving.current && controlsRef.current && cameraRef.current) {
          // Calculate ideal camera position behind player
          const idealPosition = calculateIdealCameraPosition(
            transform.position,
            transform.rotation
          );

          // Smoothly interpolate camera position
          const cameraMoveSpeed = 2 * deltaTime;
          cameraRef.current.position.lerp(idealPosition, cameraMoveSpeed);

          // Update controls target
          controlsRef.current.target.copy(transform.position);
        }

        // Store current state for next frame
        lastPlayerPosition.current.copy(transform.position);
        lastPlayerRotation.current.copy(transform.rotation);
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    // Handle window resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Add some NPCs
    const npcs = [
      {
        name: "John",
        profession: NPCProfession.VILLAGER,
        position: new THREE.Vector3(2, 0, 2)
      },
      {
        name: "Guard Mike",
        profession: NPCProfession.GUARD,
        position: new THREE.Vector3(-2, 0, -2)
      }
    ];

    npcs.forEach(npcConfig => {
      const npc = new NPCEntity(npcConfig);
      entityManagerRef.current.addEntity(npc);
      scene.add(npc.getMesh());
      npc.setScene(scene);
    });

    return () => {
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clean up through entity manager
      entityManagerRef.current.cleanup();

      // Clean up event listeners
      window.removeEventListener('resize', handleResize);

      // Clean up Three.js resources
      if (rendererRef.current) {
        rendererRef.current.dispose();
        const domElement = rendererRef.current.domElement;
        domElement.parentElement?.removeChild(domElement);
      }

      // Clean up controls
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      // Reset refs
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      playerRef.current = null;
      playerMeshRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  // Add debug UI for selected NPC
  const renderDebugUI = () => {
    if (!selectedNPC) return null;

    return (
      <div className="absolute bottom-8 right-8 bg-black/40 backdrop-blur-md rounded-lg p-4 text-white">
        <h3 className="font-bold mb-2">Selected NPC: {selectedNPC.getName()}</h3>
        <div className="space-y-2">
          <button
            className="block w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded"
            onClick={() => selectedNPC.Say("Hello there!")}
          >
            Make NPC Say "Hello there!"
          </button>
          <p className="text-sm text-gray-300">Right-click anywhere to make the NPC move there</p>
        </div>
      </div>
    );
  };

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
      <GameGUI />
      {renderDebugUI()}
    </>
  );
} 