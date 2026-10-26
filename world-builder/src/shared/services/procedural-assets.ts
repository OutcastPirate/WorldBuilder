import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { PlacementCategoryId } from '../generation/config';
import { mulberry32 } from '../generation/rng';

// Simple models built in code, so the rocks and buildings categories have
// something to place without bundling third-party assets.
export interface ProceduralAsset {
  id: string;
  name: string;
  category: PlacementCategoryId;
  height: number; // metres
  build: () => THREE.Group;
}

export const PROCEDURAL_ASSETS: ProceduralAsset[] = [
  { id: 'procedural:rock', name: 'Rock', category: 'rocks', height: 1, build: () => rock(3, 0.25, '#8a8580', 'Rock') },
  { id: 'procedural:boulder', name: 'Boulder', category: 'rocks', height: 2.2, build: () => rock(17, 0.4, '#6f6a64', 'Boulder') },
  { id: 'procedural:house', name: 'House', category: 'buildings', height: 5.5, build: house },
  { id: 'procedural:hut', name: 'Hut', category: 'buildings', height: 4, build: hut },
];

// Materials are named so they are recognisable after export.
function standard(name: string, color: string, flatShading = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ name, color, roughness: 0.9, flatShading });
}

// Icosphere with its vertices pushed in and out by noise, squashed a little.
function rock(seed: number, roughness: number, color: string, name: string): THREE.Group {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const noise = createNoise3D(mulberry32(seed));
  const position = geometry.attributes['position'];
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const displacement = 1 + roughness * noise(vertex.x * 1.3, vertex.y * 1.3, vertex.z * 1.3);
    vertex.multiplyScalar(displacement);
    position.setXYZ(i, vertex.x * 1.2, vertex.y * 0.7, vertex.z);
  }
  geometry.computeVertexNormals();
  return new THREE.Group().add(new THREE.Mesh(geometry, standard(name, color, true)));
}

function house(): THREE.Group {
  const group = new THREE.Group();

  const walls = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 5), standard('House walls', '#d9cdb4'));
  walls.position.y = 1.5;

  // Gable roof: a triangle extruded along the depth of the house.
  const roofShape = new THREE.Shape([
    new THREE.Vector2(-3.4, 0),
    new THREE.Vector2(3.4, 0),
    new THREE.Vector2(0, 2.3),
  ]);
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape, { depth: 5.6, bevelEnabled: false });
  roofGeometry.translate(0, 3, -2.8);
  const roof = new THREE.Mesh(roofGeometry, standard('House roof', '#8a3b2a', true));

  const door = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.1), standard('House door', '#5a3a22'));
  door.position.set(0, 1, 2.52);

  group.add(walls, roof, door);
  return group;
}

function hut(): THREE.Group {
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2.2, 10), standard('Hut walls', '#b59a6e'));
  walls.position.y = 1.1;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.8, 10), standard('Hut roof', '#6b5a3a', true));
  roof.position.y = 2.2 + 0.9;
  return new THREE.Group().add(walls, roof);
}
