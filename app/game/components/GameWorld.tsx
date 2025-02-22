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

// Helper function to create a stylized tree
function createTree(height: number = 2): THREE.Group {
  const tree = new THREE.Group();

  // Create trunk
  const trunkGeometry = new THREE.CylinderGeometry(0.1, 0.15, height * 0.4, 5);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5f39 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = height * 0.2;

  // Create leaves
  const leavesGeometry = new THREE.ConeGeometry(0.5, height, 4);
  const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x5a7c45 });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves.position.y = height * 0.6;

  tree.add(trunk);
  tree.add(leaves);
  return tree;
}

// Helper function to create a stylized rock
function createRock(): THREE.Mesh {
  const geometry = new THREE.IcosahedronGeometry(0.5, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.8
  });
  const rock = new THREE.Mesh(geometry, material);
  rock.scale.y = 0.5;
  rock.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );
  return rock;
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

  const gameContext = useGameContext();

  // Handle resource targeting
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

    // Get all resources and their meshes
    const resources = entityManagerRef.current
      .getAllEntities()
      .filter((entity): entity is ResourceEntity => entity instanceof ResourceEntity);

    const resourceObjects = resources
      .map(resource => resource.getMesh())
      .filter((obj): obj is THREE.Mesh | THREE.Group => obj !== null);

    // Find intersections with all meshes
    const intersects = raycaster.intersectObjects(resourceObjects, true);

    if (intersects.length > 0) {
      // Find the resource that owns this mesh by traversing up the parent chain
      const clickedObject = intersects[0].object;
      let targetObject = clickedObject;

      // Traverse up to find the top-level mesh/group
      while (targetObject.parent && !(targetObject.parent instanceof THREE.Scene)) {
        targetObject = targetObject.parent;
      }

      const clickedResource = resources.find(resource => resource.getMesh() === targetObject);

      if (clickedResource) {
        // Update previously targeted resource
        if (gameContext.targetedEntity !== null) {
          const prevResource = resources.find(r => r.getId() === gameContext.targetedEntity);
          if (prevResource) {
            prevResource.setTargeted(false);
          }
        }

        // Set new target
        clickedResource.setTargeted(true);
        gameContext.setTargetedEntity(clickedResource.getId());
      }
    } else {
      // Clear target when clicking empty space
      if (gameContext.targetedEntity !== null) {
        const prevResource = resources.find(r => r.getId() === gameContext.targetedEntity);
        if (prevResource) {
          prevResource.setTargeted(false);
        }
        gameContext.setTargetedEntity(null);
      }
    }
  }, [gameContext]);

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

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleClick, handleMouseMove]);

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

    // Add resources around the map
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 20;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      );

      // Create trees with 70% probability, stones with 30%
      if (Math.random() < 0.7) {
        const tree = resourceManager.createResource({
          type: ResourceType.TREE,
          position: position.clone(),
          properties: {
            maxHealth: 100 + Math.random() * 50, // Random health between 100-150
          }
        });
        const treeMesh = tree.getMesh();
        if (treeMesh !== null) {
          scene.add(treeMesh);
        }
        tree.setScene(scene);
      } else {
        const stone = resourceManager.createResource({
          type: ResourceType.STONE,
          position: position.clone(),
          properties: {
            maxHealth: 200 + Math.random() * 100, // Random health between 200-300
          }
        });
        const stoneMesh = stone.getMesh();
        if (stoneMesh !== null) {
          scene.add(stoneMesh);
        }
        stone.setScene(scene);
      }
    }

    // Create player with stylized look
    const player = new PlayerEntity({
      position: new THREE.Vector3(0, 0.5, 0),
      speed: 5,
      turnRate: 3,
    });
    playerRef.current = player;
    entityManagerRef.current.addEntity(player);

    // Create player mesh as a proper cube
    const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x2c698d });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    playerMesh.position.copy(player.getTransform().position);
    playerMesh.castShadow = true;
    scene.add(playerMesh);
    playerMeshRef.current = playerMesh;

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

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
      <GameGUI />
    </>
  );
} 