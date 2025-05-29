// asset-loader.service.ts
import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

@Injectable({ providedIn: 'root' })
export class AssetLoaderService {
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXLoader;
  private objLoader: OBJLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();

    // Optional: For compressed GLTF models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.fbxLoader = new FBXLoader();
    this.objLoader = new OBJLoader();
  }

  async loadGLTF(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (error) => reject(error)
      );
    });
  }

  async loadFBX(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        url,
        (object) => resolve(object),
        undefined,
        (error) => reject(error)
      );
    });
  }

  async loadOBJ(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.objLoader.load(
        url,
        (object) => resolve(object),
        undefined,
        (error) => reject(error)
      );
    });
  }

  async loadOBJWithMTL(objUrl: string, mtlUrl: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      const mtlLoader = new MTLLoader();
      mtlLoader.load(
        mtlUrl,
        (materials) => {
          materials.preload();
          const objLoader = new OBJLoader();
          objLoader.setMaterials(materials);
          objLoader.load(
            objUrl,
            (object) => resolve(object),
            undefined,
            (error) => reject(error)
          );
        },
        undefined,
        (error) => reject(error)
      );
    });
  }
}
