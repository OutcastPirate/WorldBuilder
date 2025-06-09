import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root',
})
export class RaycasterService {
  private raycaster = new THREE.Raycaster();

  castDown(
    object: THREE.Object3D,
    scene: THREE.Scene,
    distance = 100
  ): THREE.Intersection[] {
    const position = object.position.clone();
    const direction = new THREE.Vector3(0, -1, 0); // Down direction

    this.raycaster.set(position, direction);
    return this.raycaster.intersectObjects(scene.children, true);
  }
}
