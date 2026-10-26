// asset-loader.service.ts
import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { PredefinedAsset } from '../interfaces/predefinedAsset';

@Injectable({ providedIn: 'root' })
export class AssetLoaderService {
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXLoader;
  private objLoader: OBJLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();

    // Optional: For compressed GLTF models. The decoders are copied from
    // node_modules/three into the build (see angular.json), so this works offline.
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('draco/');
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.fbxLoader = new FBXLoader();
    this.objLoader = new OBJLoader();
  }

  static readonly PREDEFINED_PATH = 'assets/predefined/';

  async loadPredefinedManifest(): Promise<PredefinedAsset[]> {
    const response = await fetch(
      AssetLoaderService.PREDEFINED_PATH + 'manifest.json'
    );
    if (!response.ok) {
      throw new Error(`Cannot load asset manifest: ${response.status}`);
    }
    return response.json();
  }

  // Picks the loader by file extension. `materialUrl` is only used for OBJ.
  loadModel(
    url: string,
    extension: string,
    materialUrl?: string
  ): Promise<THREE.Group> {
    switch (extension.toLowerCase()) {
      case 'gltf':
      case 'glb':
        return this.loadGLTF(url);
      case 'fbx':
        return this.loadFBX(url);
      case 'obj':
        return materialUrl
          ? this.loadOBJWithMTL(url, materialUrl)
          : this.loadOBJ(url);
      default:
        return Promise.reject(new Error(`Unsupported format: ${extension}`));
    }
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
