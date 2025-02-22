import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlayerEntity } from '../entities/PlayerEntity';

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

export default function GameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<PlayerEntity | null>(null);
  const playerMeshRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number>();
  const controlsRef = useRef<OrbitControls | null>(null);

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add trees and rocks
    for (let i = 0; i < 30; i++) {
      const tree = createTree(1.5 + Math.random());
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 20;
      tree.position.set(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      );
      tree.castShadow = true;
      scene.add(tree);

      if (Math.random() > 0.7) {
        const rock = createRock();
        rock.position.set(
          Math.cos(angle + Math.random()) * (radius + Math.random() * 5),
          0,
          Math.sin(angle + Math.random()) * (radius + Math.random() * 5)
        );
        rock.castShadow = true;
        scene.add(rock);
      }
    }

    // Create player with stylized look
    const player = new PlayerEntity({
      position: new THREE.Vector3(0, 0.5, 0),
      speed: 5,
      turnRate: 3,
    });
    playerRef.current = player;

    // Create player mesh as connected cubes
    const playerGeometry = new THREE.BoxGeometry(0.8, 0.4, 0.4);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x2c698d });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    playerMesh.position.copy(player.getTransform().position);
    playerMesh.castShadow = true;
    scene.add(playerMesh);
    playerMeshRef.current = playerMesh;

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Animation loop
    let lastTime = 0;
    const animate = (time: number) => {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      if (playerRef.current) {
        playerRef.current.update(deltaTime);
        if (playerMeshRef.current) {
          const transform = playerRef.current.getTransform();
          playerMeshRef.current.position.copy(transform.position);
          playerMeshRef.current.quaternion.copy(transform.rotation);
        }
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

      // Clean up event listeners
      window.removeEventListener('resize', handleResize);

      // Clean up player
      if (playerRef.current) {
        playerRef.current.destroy();
      }

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

  return <div ref={containerRef} className="w-full h-full" />;
} 