import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Position } from '../interfaces/position';

@Injectable({
  providedIn: 'root',
})
export class BasicShapesService {
  constructor() {}

  // All shapes use Y as the height axis and `width` as the footprint size.
  getCube(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): THREE.Mesh {
    return this.createMesh(
      new THREE.BoxGeometry(width, height, width),
      color,
      position
    );
  }

  getCylinder(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): THREE.Mesh {
    return this.createMesh(
      new THREE.CylinderGeometry(width / 2, width / 2, height, 32),
      color,
      position
    );
  }

  getSphere(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): THREE.Mesh {
    // A sphere when height == width, otherwise an ellipsoid stretched along Y.
    const geometry = new THREE.SphereGeometry(width / 2, 32, 16);
    geometry.scale(1, height / width, 1);
    return this.createMesh(geometry, color, position);
  }

  getCone(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): THREE.Mesh {
    return this.createMesh(
      new THREE.ConeGeometry(width / 2, height, 32),
      color,
      position
    );
  }

  // Positions the mesh itself (not its geometry) so object.position matches
  // what is shown in the objects menu.
  private createMesh(
    geometry: THREE.BufferGeometry,
    color: string,
    position: Position = { x: 0, y: 0, z: 0 }
  ): THREE.Mesh {
    const material = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    return mesh;
  }
}
