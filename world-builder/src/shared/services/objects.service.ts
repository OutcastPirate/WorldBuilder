import { Injectable } from '@angular/core';
import { SceneService } from './scene.service';
import * as THREE from 'three';
import { Position } from '../interfaces/position';
import { BehaviorSubject, Observable } from 'rxjs';
import { AssetInstance, AssetInterface } from '../interfaces/assetInstance';
import { AssetLoaderService } from './asset-loader.service';
import { BasicShapesService } from './basic-shapes.service';
import { RaycasterService } from './raycaster.service';

@Injectable({
  providedIn: 'root',
})
export class ObjectsService {
  constructor(
    private sceneService: SceneService,
    private assetLoader: AssetLoaderService,
    private basicShapes: BasicShapesService,
    private raycaster: RaycasterService
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
    position?: Position
  ): void {
    const cube = this.basicShapes.getCube(height, width, color, position);
    this.addObject(new AssetInstance('Cube', cube, true));
    this.sceneService.getScene().add(cube);
  }

  addCylinder(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): void {
    const shape = this.basicShapes.getCylinder(height, width, color, position);
    this.addObject(new AssetInstance('Cylinder', shape, true));
    this.sceneService.getScene().add(shape);
  }

  addSphere(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): void {
    const shape = this.basicShapes.getSphere(height, width, color, position);
    this.addObject(new AssetInstance('Sphere', shape, true));
    this.sceneService.getScene().add(shape);
  }

  addCone(
    height: number,
    width: number,
    color: string,
    position?: Position
  ): void {
    const shape = this.basicShapes.getCone(height, width, color, position);
    this.addObject(new AssetInstance('Cone', shape, true));
    this.sceneService.getScene().add(shape);
  }

  snapDown(object: THREE.Object3D, snapDistance = 0.1): void {
    const intersections = this.raycaster.castDown(
      object,
      this.sceneService.getScene()
    );

    const validIntersections = intersections.filter((i) => i.object !== object);

    if (validIntersections.length > 0) {
      const closest = validIntersections[0];

      const box = new THREE.Box3().setFromObject(object);
      const objectHeight = box.max.y - box.min.y;
      const objectBottom = object.position.y - objectHeight / 2;

      object.position.y = closest.point.y + objectHeight / 2 + snapDistance;
    }
  }

  snapDownPrototype(object: THREE.Object3D, snapDistance = 0.1): void {
    const intersections = this.raycaster.castDown(
      object,
      this.sceneService.getScene()
    );

    const validIntersections = intersections.filter((i) => i.object !== object);

    if (validIntersections.length > 0) {
      const closest = validIntersections[0];

      const box = new THREE.Box3().setFromObject(object);
      const objectHeight = box.max.y - box.min.y;
      const objectBottom = object.position.y - objectHeight / 2;

      object.position.y = closest.point.y;
    }
  }
}
