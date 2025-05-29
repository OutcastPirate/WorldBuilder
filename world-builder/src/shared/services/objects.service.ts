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
export class ObjectsService {
  constructor(
    private sceneService: SceneService,
    private assetLoader: AssetLoaderService
  ) {}

  private _objects = new BehaviorSubject<AssetInstance[]>([]);

  // Public observable for components to subscribe to
  objects$: Observable<AssetInstance[]> = this._objects.asObservable();

  addObject(object: AssetInstance): void {
    const current = this._objects.getValue();
    this._objects.next([...current, object]);
  }

  removeObject(object: AssetInstance): void {
    const current = this._objects.getValue();
    this._objects.next(current.filter((obj) => obj !== object));
    // Remove from scene as well
    if (
      object.object &&
      this.sceneService.getScene().children.includes(object.object)
    ) {
      this.sceneService.getScene().remove(object.object);
    }
  }

  clearObjects(): void {
    this._objects.next([]);
  }

  addOBJ(file: File, material?: File): void {
    if (!file) {
      console.error('No file selected.');
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const fileContent = event.target?.result as string;

      // If your assetLoader.loadOBJ() expects a URL, you might need to create an Object URL
      const objectUrl = URL.createObjectURL(file);

      if (!material) {
        this.assetLoader
          .loadOBJ(objectUrl) // Pass the Object URL or file content, depending on your loader
          .then((object) => {
            const assetInstance = new AssetInstance('OBJ', object, false);
            this.addObject(assetInstance);
            this.sceneService.getScene().add(object);

            // Clean up the Object URL to avoid memory leaks
            URL.revokeObjectURL(objectUrl);
          })
          .catch((error) => {
            console.error('Error loading OBJ:', error);
            URL.revokeObjectURL(objectUrl); // Clean up even if loading fails
          });
      } else {
        const mtlUrl = URL.createObjectURL(material);
        this.assetLoader
          .loadOBJWithMTL(objectUrl, mtlUrl) // Pass the Object URL or file content, depending on your loader
          .then((object) => {
            const assetInstance = new AssetInstance('OBJ', object, false);
            this.addObject(assetInstance);
            this.sceneService.getScene().add(object);

            // Clean up the Object URL to avoid memory leaks
            URL.revokeObjectURL(objectUrl);
          })
          .catch((error) => {
            console.error('Error loading OBJ:', error);
            URL.revokeObjectURL(objectUrl); // Clean up even if loading fails
          });
      }
    };

    reader.onerror = (error) => {
      console.error('Error reading file:', error);
    };

    // Read the file as text (or ArrayBuffer if needed)
    reader.readAsText(file); // or reader.readAsArrayBuffer(file) for binary files
  }

  addGLTF(file: File): void {
    if (!file) {
      console.error('No file selected.');
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const fileContent = event.target?.result as string;

      // If your assetLoader.loadGLTF() expects a URL, you might need to create an Object URL
      const objectUrl = URL.createObjectURL(file);

      this.assetLoader
        .loadGLTF(objectUrl) // Pass the Object URL or file content, depending on your loader
        .then((object) => {
          const assetInstance = new AssetInstance('GLTF', object, false);
          this.addObject(assetInstance);
          this.sceneService.getScene().add(object);

          // Clean up the Object URL to avoid memory leaks
          URL.revokeObjectURL(objectUrl);
        })
        .catch((error) => {
          console.error('Error loading GLTF:', error);
          URL.revokeObjectURL(objectUrl); // Clean up even if loading fails
        });
    };

    reader.onerror = (error) => {
      console.error('Error reading file:', error);
    };

    // Read the file as text (or ArrayBuffer if needed)
    reader.readAsArrayBuffer(file); // Use readAsArrayBuffer for binary files like GLTF
  }

  addCube(
    height: number,
    width: number,
    color: string,
    position: Position
  ): void {
    const geometry = new THREE.BoxGeometry(width, 1, height);
    const material = new THREE.MeshStandardMaterial({ color: color });
    geometry.translate(position.x, position.y, position.z);
    const cube = new THREE.Mesh(geometry, material);
    this.addObject(new AssetInstance('Cube', cube, true));
    this.sceneService.getScene().add(cube);
  }

  // moveCube(index: number, translation: Position): void {
  //   const object = this.objects[index];
  //   object.position.x += translation.x;
  //   object.position.y += translation.y;
  //   object.position.z += translation.z;
  // }
}
