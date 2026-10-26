import { Injectable } from '@angular/core';
import { SceneService } from './scene.service';
import * as THREE from 'three';
import { BehaviorSubject, Observable, skip, Subject } from 'rxjs';
import { PlacementBlocker } from '../generation/placement';
import { AssetInstance, ObjectOrigin, ShapeKind } from '../interfaces/assetInstance';
import { AssetLibraryService } from './asset-library.service';
import { PredefinedAsset } from '../interfaces/predefinedAsset';
import { AssetLoaderService } from './asset-loader.service';
import { BasicShapesService } from './basic-shapes.service';
import { RaycasterService } from './raycaster.service';
import { TerrainMeshService } from './terrain-mesh.service';

// Hand-placed objects: basic shapes, imported files and library models
// placed by clicking (or generated objects made editable).
@Injectable({
  providedIn: 'root',
})
export class ObjectsService {
  constructor(
    private sceneService: SceneService,
    private assetLoader: AssetLoaderService,
    private basicShapes: BasicShapesService,
    private raycaster: RaycasterService,
    private terrainMesh: TerrainMeshService,
    private library: AssetLibraryService
  ) {
    // Keep objects standing on the ground when the terrain is rebuilt.
    this.terrainMesh.builtConfig$.pipe(skip(1)).subscribe(() => {
      this._objects
        .getValue()
        .filter((o) => o.snapToGround)
        .forEach((o) => this.snapDown(o.object));
      this.notifyChanged();
    });
  }

  private _objects = new BehaviorSubject<AssetInstance[]>([]);
  private _changed = new Subject<void>();

  // Public observable for components to subscribe to
  objects$: Observable<AssetInstance[]> = this._objects.asObservable();
  // Fires when objects are added, removed or moved (positions are mutated in
  // place, so objects$ alone doesn't report moves).
  changed$: Observable<void> = this._changed.asObservable();

  get objects(): AssetInstance[] {
    return this._objects.getValue();
  }

  notifyChanged(): void {
    this._changed.next();
  }

  addObject(object: AssetInstance): void {
    const current = this._objects.getValue();
    this._objects.next([...current, object]);
    this.notifyChanged();
  }

  removeObject(object: AssetInstance): void {
    const current = this._objects.getValue();
    this._objects.next(current.filter((obj) => obj !== object));
    // Remove from scene as well and free its GPU resources. Library models
    // share geometry and materials with the automatic placement, so those
    // are kept.
    if (object.object) {
      object.object.removeFromParent();
      if (!object.assetId) this.disposeObject(object.object);
    }
    this.notifyChanged();
  }

  // Adds a library model at a world position (base on the ground). Returns
  // the new object, or undefined if the model can't be loaded.
  async addLibraryObject(
    assetId: string,
    position: THREE.Vector3,
    rotationY = 0,
    scale = 1
  ): Promise<AssetInstance | undefined> {
    const asset = this.library.find(assetId);
    if (!asset) return undefined;
    const prototype = await this.library.getPrototype(assetId);
    const group = new THREE.Group();
    for (const part of prototype.parts) {
      group.add(new THREE.Mesh(part.geometry, part.material));
    }
    group.position.copy(position);
    group.rotation.y = rotationY;
    group.scale.setScalar(scale);
    return this.addToScene(asset.name, group, { kind: 'library', assetId });
  }

  // Ground areas automatic placement should keep clear of (see
  // PlacementBlocker): every hand-placed object's footprint.
  blockers(): PlacementBlocker[] {
    return this._objects.getValue().flatMap((o) => {
      const box = new THREE.Box3().setFromObject(o.object);
      if (box.isEmpty()) return [];
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const r = Math.max(size.x, size.z);
      return [{ x: round(center.x), z: round(center.z), r: round(r) }];
    });
  }

  // Removes every hand-placed object from the list and the scene.
  clearObjects(): void {
    [...this._objects.getValue()].forEach((o) => this.removeObject(o));
  }

  // Loads a user-selected file (.obj with optional .mtl, .gltf, .glb).
  // Note: files referencing other files (.gltf with an external .bin, textures
  // used by an .mtl) cannot be resolved from a single picked file.
  async addFromFile(file: File, material?: File): Promise<AssetInstance | undefined> {
    const extension = this.getExtension(file.name);
    const objectUrl = URL.createObjectURL(file);
    const mtlUrl = material ? URL.createObjectURL(material) : undefined;

    try {
      const object = await this.assetLoader.loadModel(
        objectUrl,
        extension,
        mtlUrl
      );
      return this.addToScene(this.stripExtension(file.name), object, { kind: 'file', file, material });
    } catch (error) {
      console.error(`Error loading ${file.name}:`, error);
      return undefined;
    } finally {
      // Clean up the Object URLs to avoid memory leaks
      URL.revokeObjectURL(objectUrl);
      if (mtlUrl) URL.revokeObjectURL(mtlUrl);
    }
  }

  async addPredefined(asset: PredefinedAsset): Promise<AssetInstance | undefined> {
    const basePath = AssetLoaderService.PREDEFINED_PATH;
    try {
      const object = await this.assetLoader.loadModel(
        basePath + asset.file,
        this.getExtension(asset.file),
        asset.material ? basePath + asset.material : undefined
      );
      return this.addToScene(asset.name, object, { kind: 'predefined', id: asset.id });
    } catch (error) {
      console.error(`Error loading ${asset.name}:`, error);
      return undefined;
    }
  }

  addShape(shape: ShapeKind, height: number, width: number, color: string): AssetInstance {
    const build = {
      Cube: () => this.basicShapes.getCube(height, width, color),
      Cylinder: () => this.basicShapes.getCylinder(height, width, color),
      Sphere: () => this.basicShapes.getSphere(height, width, color),
      Cone: () => this.basicShapes.getCone(height, width, color),
    }[shape];
    return this.addToScene(shape, build(), { kind: 'shape', shape, height, width }, true);
  }

  addCube(height: number, width: number, color: string): AssetInstance {
    return this.addShape('Cube', height, width, color);
  }

  addCylinder(height: number, width: number, color: string): AssetInstance {
    return this.addShape('Cylinder', height, width, color);
  }

  addSphere(height: number, width: number, color: string): AssetInstance {
    return this.addShape('Sphere', height, width, color);
  }

  addCone(height: number, width: number, color: string): AssetInstance {
    return this.addShape('Cone', height, width, color);
  }

  // Moves the object vertically so the bottom of its bounding box rests on the
  // highest surface below its centre: the terrain or another object. Works
  // regardless of where the model's pivot is.
  snapDown(object: THREE.Object3D, snapDistance = 0): void {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    // The terrain height comes straight from the heightmap (exact, and no
    // raycast against a mesh with hundreds of thousands of triangles).
    const terrainY = this.terrainMesh.sampleHeight(center.x, center.z);
    const objectY = this.firstObjectHit(
      new THREE.Vector3(center.x, box.max.y, center.z),
      object
    )?.point.y;

    const surfaces = [terrainY, objectY].filter(
      (y): y is number => y !== undefined
    );
    if (surfaces.length === 0) return;

    // Objects are direct children of the (untransformed) scene, so a world
    // space offset can be applied directly to the local position.
    object.position.y += Math.max(...surfaces) + snapDistance - box.min.y;
  }

  private firstObjectHit(
    origin: THREE.Vector3,
    ignore: THREE.Object3D
  ): THREE.Intersection | undefined {
    const terrain = this.terrainMesh.getMesh();
    const objects = this._objects.getValue().map((o) => o.object);
    return this.raycaster.castDown(
      origin,
      objects.filter((o) => o !== terrain),
      ignore
    )[0];
  }

  private addToScene(
    name: string,
    object: THREE.Object3D,
    origin: ObjectOrigin,
    isMesh = false
  ): AssetInstance {
    const assetId = origin.kind === 'library' ? origin.assetId : undefined;
    object.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    this.sceneService.getScene().add(object);
    // New objects usually start inside the terrain (at the origin, or at the
    // clicked point with the pivot above the base).
    this.snapDown(object);
    const instance = new AssetInstance(name, object, isMesh, true, assetId);
    instance.origin = origin;
    this.addObject(instance);
    return instance;
  }

  private disposeObject(root: THREE.Object3D): void {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material: THREE.Material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
        material.dispose();
      });
    });
  }

  private getExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() ?? '';
  }

  private stripExtension(fileName: string): string {
    return fileName.replace(/\.[^.]+$/, '');
  }
}

// Centimetre precision, so tiny float changes don't count as a move.
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
