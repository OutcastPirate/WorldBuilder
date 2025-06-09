import { Injectable } from '@angular/core';
import { SceneService } from './scene.service';
import * as THREE from 'three';
import { Position } from '../interfaces/position';
import { BehaviorSubject, Observable } from 'rxjs';
import { AssetInstance, AssetInterface } from '../interfaces/assetInstance';
import { AssetLoaderService } from './asset-loader.service';

@Injectable({
  providedIn: 'root',
})
export class BasicShapesService {
  constructor() {}

  getCube(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): any {
    const geometry = new THREE.BoxGeometry(width, width, height);
    const material = new THREE.MeshStandardMaterial({ color: color });
    if (!position) {
      position = {
        x: 0,
        y: 0,
        z: 0,
      };
    }
    geometry.translate(position.x, position.y, position.z);
    const cube = new THREE.Mesh(geometry, material);
    return cube;
  }

  getCylinder(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): any {
    const geometry = new THREE.CylinderGeometry(width / 2, width / 2, height);
    const material = new THREE.MeshStandardMaterial({ color: color });
    if (!position) {
      position = {
        x: 0,
        y: 0,
        z: 0,
      };
    }
    geometry.translate(position.x, position.y, position.z);
    const cube = new THREE.Mesh(geometry, material);
    return cube;
  }

  getSphere(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): any {
    const geometry = new THREE.SphereGeometry(width / 2);
    const material = new THREE.MeshStandardMaterial({ color: color });
    if (!position) {
      position = {
        x: 0,
        y: 0,
        z: 0,
      };
    }
    geometry.translate(position.x, position.y, position.z);
    const cube = new THREE.Mesh(geometry, material);
    return cube;
  }

  getCone(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): any {
    const geometry = new THREE.ConeGeometry(width / 2, height);
    const material = new THREE.MeshStandardMaterial({ color: color });
    if (!position) {
      position = {
        x: 0,
        y: 0,
        z: 0,
      };
    }
    geometry.translate(position.x, position.y, position.z);
    const cube = new THREE.Mesh(geometry, material);
    return cube;
  }
}
