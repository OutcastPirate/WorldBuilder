import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BehaviorSubject, Observable } from 'rxjs';
import { PlacementCategoryId } from '../generation/config';
import { AssetLoaderService } from './asset-loader.service';
import { PROCEDURAL_ASSETS } from './procedural-assets';

export type LibraryAssetSource =
  | { kind: 'manifest'; file: string; material?: string; color?: string }
  | { kind: 'procedural'; build: () => THREE.Group }
  | { kind: 'upload'; file: File; material?: File };

// A model that can be placed automatically.
export interface LibraryAsset {
  id: string;
  name: string;
  category: PlacementCategoryId;
  height: number; // metres after normalisation
  warning?: string;
  source: LibraryAssetSource;
}

// One mesh of a model, already transformed into the model's normalised
// space (base at y = 0, centred on the origin, scaled to `height`). Each part
// becomes one InstancedMesh.
export interface PrototypePart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

export interface AssetPrototype {
  parts: PrototypePart[];
  // Half the model's width/depth, for sampling the ground under it.
  footprintRadius: number;
  triangles: number;
}

const DEFAULT_UPLOAD_HEIGHT: Record<PlacementCategoryId, number> = {
  buildings: 6,
  rocks: 1,
  vegetation: 5,
};

@Injectable({
  providedIn: 'root',
})
export class AssetLibraryService {
  constructor(private assetLoader: AssetLoaderService) {}

  private _assets = new BehaviorSubject<LibraryAsset[]>(
    PROCEDURAL_ASSETS.map((asset) => ({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      height: asset.height,
      source: { kind: 'procedural', build: asset.build },
    }))
  );
  private prototypes = new Map<string, Promise<AssetPrototype>>();
  private manifestLoaded?: Promise<void>;
  private uploadCount = 0;

  assets$: Observable<LibraryAsset[]> = this._assets.asObservable();

  // Adds the categorised models from assets/predefined/manifest.json.
  load(): Promise<void> {
    this.manifestLoaded ??= this.assetLoader
      .loadPredefinedManifest()
      .then((manifest) => {
        const fromManifest: LibraryAsset[] = manifest.flatMap((entry) =>
          entry.category
            ? [
                {
                  id: entry.id,
                  name: entry.name,
                  category: entry.category,
                  height: entry.height ?? DEFAULT_UPLOAD_HEIGHT[entry.category],
                  warning: entry.warning,
                  source: {
                    kind: 'manifest',
                    file: entry.file,
                    material: entry.material,
                    color: entry.color,
                  },
                } satisfies LibraryAsset,
              ]
            : []
        );
        this._assets.next([...this._assets.getValue(), ...fromManifest]);
      })
      .catch((error) => console.error('Asset library:', error));
    return this.manifestLoaded;
  }

  find(id: string): LibraryAsset | undefined {
    return this._assets.getValue().find((asset) => asset.id === id);
  }

  // Adds a user's model to a category for this session.
  addUpload(file: File, category: PlacementCategoryId, material?: File): LibraryAsset {
    const asset: LibraryAsset = {
      id: `upload:${++this.uploadCount}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      category,
      height: DEFAULT_UPLOAD_HEIGHT[category],
      source: { kind: 'upload', file, material },
    };
    this._assets.next([...this._assets.getValue(), asset]);
    return asset;
  }

  getPrototype(id: string): Promise<AssetPrototype> {
    let prototype = this.prototypes.get(id);
    if (!prototype) {
      const asset = this.find(id);
      prototype = asset
        ? this.loadGroup(asset).then((group) => normalise(group, asset.height))
        : Promise.reject(new Error(`Unknown asset ${id}`));
      // Forget failures so a later attempt can retry.
      prototype.catch(() => this.prototypes.delete(id));
      this.prototypes.set(id, prototype);
    }
    return prototype;
  }

  private async loadGroup(asset: LibraryAsset): Promise<THREE.Group> {
    const source = asset.source;
    switch (source.kind) {
      case 'procedural':
        return source.build();
      case 'manifest': {
        const base = AssetLoaderService.PREDEFINED_PATH;
        const group = await this.assetLoader.loadModel(
          base + source.file,
          extension(source.file),
          source.material ? base + source.material : undefined
        );
        if (source.color) applyColor(group, source.color);
        return group;
      }
      case 'upload': {
        const url = URL.createObjectURL(source.file);
        const materialUrl = source.material ? URL.createObjectURL(source.material) : undefined;
        try {
          return await this.assetLoader.loadModel(url, extension(source.file.name), materialUrl);
        } finally {
          URL.revokeObjectURL(url);
          if (materialUrl) URL.revokeObjectURL(materialUrl);
        }
      }
    }
  }
}

function extension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

// Replaces the materials of a model that came without a material file.
function applyColor(group: THREE.Group, color: string): void {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) child.material = material;
  });
}

// Bakes every mesh's transform into a copy of its geometry, then scales the
// whole model to `height` metres with its base at y = 0 and its centre on
// the Y axis.
function normalise(group: THREE.Group, height: number): AssetPrototype {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? height / size.y : 1;
  const toNormalised = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));

  const parts: PrototypePart[] = [];
  let triangles = 0;
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = (child.geometry as THREE.BufferGeometry).clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toNormalised, child.matrixWorld));
    geometry.computeBoundingSphere();
    triangles += (geometry.index?.count ?? geometry.attributes['position'].count) / 3;
    parts.push({ geometry, material: child.material });
  });

  return {
    parts,
    footprintRadius: (Math.max(size.x, size.z) * scale) / 2,
    triangles: Math.round(triangles),
  };
}
