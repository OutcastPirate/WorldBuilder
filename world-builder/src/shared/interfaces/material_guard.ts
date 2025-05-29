import * as THREE from 'three';

export function isMaterialWithColor(
  material: any
): material is THREE.Material & { color: THREE.Color } {
  return (
    material && 'color' in material && material.color instanceof THREE.Color
  );
}

export function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return object instanceof THREE.Mesh;
}
