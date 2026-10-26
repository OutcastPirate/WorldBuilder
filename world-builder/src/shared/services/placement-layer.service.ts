import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  from,
  map,
  Observable,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import { PlacementCategoryId, PlacementConfig, TerrainConfig } from '../generation/config';
import { PlacedObject, PlacementBlocker, PlacementResult } from '../generation/placement';
import { AssetLibraryService, AssetPrototype } from './asset-library.service';
import { GenerationConfigService } from './generation-config.service';
import { GenerationWorkerService } from './generation-worker.service';
import { ObjectsService } from './objects.service';
import { SceneService } from './scene.service';
import { TerrainMeshService } from './terrain-mesh.service';

export type PlacementStatus = 'idle' | 'placing' | 'loading';

export interface PlacementSummary {
  counts: Partial<Record<PlacementCategoryId, number>>;
  limitReached: PlacementCategoryId[];
  failedAssets: string[];
  triangles: number;
}

const sameJson = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

// Places environment objects with Poisson Disk Sampling (in the worker) and
// draws them as one InstancedMesh per model part. Re-runs automatically when
// the placement settings, the terrain or the hand-placed objects change
// (generated objects keep clear of hand-placed ones).
@Injectable({
  providedIn: 'root',
})
export class PlacementLayerService implements OnDestroy {
  constructor(
    private configService: GenerationConfigService,
    private terrainMesh: TerrainMeshService,
    private workerService: GenerationWorkerService,
    private sceneService: SceneService,
    private library: AssetLibraryService,
    private objectsService: ObjectsService
  ) {}

  private subscription?: Subscription;
  private layer = new THREE.Group();
  private objects: PlacedObject[] = [];
  private prototypes = new Map<string, AssetPrototype>();
  // World transform of each drawn object, by object id.
  private matrices = new Map<string, THREE.Matrix4>();
  private limitReached: PlacementCategoryId[] = [];
  // Generated objects the user deleted, by model and position. Kept while
  // only the hand-placed objects change; cleared when the placement settings
  // or the terrain change (positions are different then anyway).
  private removedKeys = new Set<string>();
  private lastInputs = '';
  private failedAssets: string[] = [];

  private _status = new BehaviorSubject<PlacementStatus>('idle');
  private _summary = new BehaviorSubject<PlacementSummary>({
    counts: {},
    limitReached: [],
    failedAssets: [],
    triangles: 0,
  });

  status$: Observable<PlacementStatus> = this._status.asObservable();
  summary$: Observable<PlacementSummary> = this._summary.asObservable();

  // Current automatically placed objects (for later export and editing).
  getObjects(): readonly PlacedObject[] {
    return this.objects;
  }

  getObject(id: string): PlacedObject | undefined {
    return this.objects.find((o) => o.id === id);
  }

  // Instanced meshes, for picking objects in the 3D view.
  getMeshes(): THREE.InstancedMesh[] {
    return this.layer.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
  }

  // The generated object drawn by `instanceId` of `mesh`.
  objectAt(mesh: THREE.InstancedMesh, instanceId: number): PlacedObject | undefined {
    const id = (mesh.userData['objectIds'] as string[] | undefined)?.[instanceId];
    return id ? this.getObject(id) : undefined;
  }

  // World-space bounding box of a generated object.
  boundingBox(id: string): THREE.Box3 | undefined {
    const object = this.getObject(id);
    const matrix = this.matrices.get(id);
    const prototype = object && this.prototypes.get(object.assetId);
    if (!matrix || !prototype) return undefined;
    const box = new THREE.Box3();
    for (const part of prototype.parts) {
      part.geometry.computeBoundingBox();
      box.union(part.geometry.boundingBox!.clone().applyMatrix4(matrix));
    }
    return box;
  }

  // Generated objects the user deleted (for saving a project).
  getRemovedKeys(): string[] {
    return [...this.removedKeys];
  }

  // Restores deletions from a project. They are kept as long as placement
  // runs with exactly these settings and this terrain.
  restoreRemovedKeys(keys: string[], placement: PlacementConfig, terrain: TerrainConfig): void {
    // Applied when a run with these exact inputs finishes; a run started
    // before the project was opened must not clear them.
    this.pendingRemoved = { keys, inputs: JSON.stringify([placement, terrain]) };
  }

  private pendingRemoved?: { keys: string[]; inputs: string };

  getMatrix(id: string): THREE.Matrix4 | undefined {
    return this.matrices.get(id)?.clone();
  }

  // Removes one generated object. It comes back when the placement settings
  // or the terrain change and placement runs again.
  remove(id: string): void {
    const object = this.getObject(id);
    if (object) this.removedKeys.add(objectKey(object));
    this.objects = this.objects.filter((o) => o.id !== id);
    this.redraw();
  }

  start(): void {
    if (this.subscription) return;
    this.layer.name = 'Generated objects';
    this.sceneService.getScene().add(this.layer);
    this.library.load();

    const placement$ = this.configService.config$.pipe(
      map((config) => config.placement),
      distinctUntilChanged(sameJson)
    );
    const terrain$ = this.terrainMesh.builtConfig$.pipe(
      filter((config): config is TerrainConfig => config !== null)
    );
    const blockers$ = this.objectsService.changed$.pipe(
      startWith(undefined),
      map(() => this.objectsService.blockers()),
      distinctUntilChanged(sameJson)
    );

    this.subscription = combineLatest([placement$, terrain$, blockers$])
      .pipe(
        debounceTime(150),
        // A newer change cancels waiting for an older run.
        switchMap(([placement, terrain, blockers]) =>
          from(this.run(placement, terrain, blockers)).pipe(
            map((result) => ({ result, inputs: JSON.stringify([placement, terrain]) }))
          )
        )
      )
      .subscribe(({ result, inputs }) => {
        // A run started before a project was opened is out of date.
        const stale = !!this.pendingRemoved && inputs !== this.pendingRemoved.inputs;
        if (result && !stale) {
          if (this.pendingRemoved) {
            this.removedKeys = new Set(this.pendingRemoved.keys);
            this.pendingRemoved = undefined;
          } else if (inputs !== this.lastInputs) {
            this.removedKeys.clear();
          }
          this.lastInputs = inputs;
          this.objects = result.objects.filter((o) => !this.removedKeys.has(objectKey(o)));
          this.limitReached = result.limitReached;
          this.redraw();
        }
        this._status.next('idle');
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private async run(
    placement: PlacementConfig,
    terrain: TerrainConfig,
    blockers: PlacementBlocker[]
  ): Promise<PlacementResult | null> {
    const heightmap = this.terrainMesh.getHeightmap();
    if (!heightmap) return null;
    try {
      // Models are loaded first: their footprint sizes keep objects from
      // hanging over the map's border.
      this._status.next('loading');
      await this.library.load();
      const assetIds = new Set(
        placement.categories.filter((c) => c.enabled).flatMap((c) => c.assetIds)
      );
      this.failedAssets = [];
      const assetRadii: Record<string, number> = {};
      await Promise.all(
        [...assetIds].map(async (id) => {
          try {
            const prototype = await this.library.getPrototype(id);
            this.prototypes.set(id, prototype);
            assetRadii[id] = prototype.footprintRadius;
          } catch (error) {
            console.error(`Could not load model ${id}:`, error);
            this.failedAssets.push(this.library.find(id)?.name ?? id);
          }
        })
      );

      this._status.next('placing');
      return await this.workerService.placeObjects({
        heightmap,
        worldSize: terrain.worldSize,
        heightScale: terrain.heightScale,
        placement,
        shape: terrain.shape,
        assetRadii,
        blockers,
      });
    } catch (error) {
      console.error('Object placement failed:', error);
      return null;
    }
  }

  // Rebuilds the instanced meshes from `objects` and updates the summary.
  private redraw(): void {
    // Geometries and materials belong to the cached prototypes; only the
    // instanced wrappers are released here.
    for (const child of [...this.layer.children]) {
      if (child instanceof THREE.InstancedMesh) child.dispose();
      this.layer.remove(child);
    }
    this.matrices.clear();

    const byAsset = new Map<string, PlacedObject[]>();
    for (const object of this.objects) {
      if (!this.prototypes.has(object.assetId)) continue;
      const list = byAsset.get(object.assetId);
      if (list) list.push(object);
      else byAsset.set(object.assetId, [object]);
    }

    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const counts: PlacementSummary['counts'] = {};
    let triangles = 0;

    byAsset.forEach((list, assetId) => {
      const prototype = this.prototypes.get(assetId)!;
      const matrices = list.map((object) => {
        const y = this.groundHeight(object, prototype.footprintRadius * object.scale);
        position.set(object.x, y, object.z);
        rotation.setFromAxisAngle(up, object.rotationY);
        scale.setScalar(object.scale);
        const matrix = new THREE.Matrix4().compose(position, rotation, scale);
        this.matrices.set(object.id, matrix);
        counts[object.categoryId] = (counts[object.categoryId] ?? 0) + 1;
        triangles += prototype.triangles;
        return matrix;
      });

      for (const part of prototype.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = assetId;
        mesh.userData['objectIds'] = list.map((o) => o.id);
        this.layer.add(mesh);
      }
    });

    this._summary.next({
      counts,
      limitReached: this.limitReached,
      failedAssets: this.failedAssets,
      triangles,
    });
  }

  // Lowest terrain point under the object's centre and footprint, so it
  // stands on the ground instead of floating on slopes.
  private groundHeight(object: PlacedObject, radius: number): number {
    const r = radius * 0.7;
    const samples = [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
    ].map(([dx, dz]) => this.terrainMesh.sampleHeight(object.x + dx, object.z + dz));
    const heights = samples.filter((h): h is number => h !== undefined);
    return heights.length > 0 ? Math.min(...heights) : 0;
  }
}

function objectKey(object: PlacedObject): string {
  return `${object.assetId}@${object.x.toFixed(2)},${object.z.toFixed(2)}`;
}
