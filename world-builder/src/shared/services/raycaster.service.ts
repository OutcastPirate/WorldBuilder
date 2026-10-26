import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root',
})
export class RaycasterService {
  private raycaster = new THREE.Raycaster();

  // Casts a ray straight down from a world-space origin against `objects`
  // and returns the hits sorted by distance, skipping `ignore` and all of its
  // descendants.
  castDown(
    origin: THREE.Vector3,
    objects: THREE.Object3D[],
    ignore?: THREE.Object3D,
    distance = Infinity
  ): THREE.Intersection[] {
    const direction = new THREE.Vector3(0, -1, 0);

    this.raycaster.set(origin, direction);
    this.raycaster.far = distance;
    return this.raycaster
      .intersectObjects(objects, true)
      .filter((hit) => !ignore || !this.isDescendantOf(hit.object, ignore));
  }

  private isDescendantOf(
    object: THREE.Object3D,
    ancestor: THREE.Object3D
  ): boolean {
    for (let o: THREE.Object3D | null = object; o; o = o.parent) {
      if (o === ancestor) return true;
    }
    return false;
  }
}
