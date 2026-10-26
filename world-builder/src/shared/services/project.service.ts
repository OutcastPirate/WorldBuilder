import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  EmbeddedFile,
  parseProject,
  PROJECT_FORMAT,
  PROJECT_VERSION,
  ProjectFile,
  SavedObject,
  SavedOrigin,
} from '../generation/project';
import { AssetInstance, ObjectOrigin } from '../interfaces/assetInstance';
import { isMaterialWithColor, isMesh } from '../interfaces/material_guard';
import { AssetLibraryService } from './asset-library.service';
import { AssetLoaderService } from './asset-loader.service';
import { FileSaveService, SaveResult } from './file-save.service';
import { GenerationConfigService } from './generation-config.service';
import { ObjectsService } from './objects.service';
import { PlacementLayerService } from './placement-layer.service';
import { SceneService } from './scene.service';
import { SelectionService } from './selection.service';
import { TerrainMeshService } from './terrain-mesh.service';

const DEFAULT_NAME = 'Untitled world';
const EXTENSION = '.worldbuilder.json';

// Saves and opens whole worlds: generation settings, hand-placed objects,
// deleted generated objects, uploaded models and the scene settings.
@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  constructor(
    private configService: GenerationConfigService,
    private terrainMesh: TerrainMeshService,
    private objectsService: ObjectsService,
    private placementLayer: PlacementLayerService,
    private library: AssetLibraryService,
    private assetLoader: AssetLoaderService,
    private sceneService: SceneService,
    private selection: SelectionService,
    private fileSave: FileSaveService
  ) {}

  private _name = new BehaviorSubject<string>(DEFAULT_NAME);
  name$: Observable<string> = this._name.asObservable();

  async save(): Promise<SaveResult> {
    const project = await this.build();
    const result = await this.fileSave.saveFile(
      `${this._name.getValue()}${EXTENSION}`,
      JSON.stringify(project),
      [{ name: 'World Builder project', extensions: ['json'] }]
    );
    if (result.kind === 'saved') this._name.next(projectName(result.path));
    return result;
  }

  // Opens a project file. Returns warnings for objects that could not be
  // restored (the rest of the project still opens).
  async open(file: File): Promise<string[]> {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      throw new Error(`${file.name} is not a valid JSON file.`);
    }
    const project = parseProject(json);
    const warnings = await this.apply(project);
    this._name.next(projectName(file.name));
    return warnings;
  }

  // Back to default settings with no hand-placed objects.
  async newProject(): Promise<void> {
    this.clearWorld();
    this.configService.reset();
    const config = this.configService.config;
    await this.terrainMesh.generate(config.terrain);
    this.placementLayer.restoreRemovedKeys([], config.placement, this.terrainMesh.getBuiltConfig()!);
    this.sceneService.applySceneSettings({ background: '#202020', fog: null });
    this._name.next(DEFAULT_NAME);
  }

  async build(): Promise<ProjectFile> {
    const uploads = await Promise.all(
      this.library.uploads().map(async (asset) => {
        if (asset.source.kind !== 'upload') throw new Error('Unexpected model source');
        return {
          id: asset.id,
          name: asset.name,
          category: asset.category,
          height: asset.height,
          file: await embed(asset.source.file),
          material: asset.source.material ? await embed(asset.source.material) : undefined,
        };
      })
    );

    const objects: SavedObject[] = [];
    for (const instance of this.objectsService.objects) {
      if (!instance.origin) continue;
      const object = instance.object;
      objects.push({
        name: instance.name,
        origin: await saveOrigin(instance.origin),
        transform: {
          position: object.position.toArray(),
          rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
          scale: object.scale.toArray(),
        },
        snapToGround: instance.snapToGround,
        color: instance.origin.kind === 'shape' ? meshColor(object) : undefined,
      });
    }

    return {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      savedAt: new Date().toISOString(),
      config: structuredClone(this.configService.config),
      removedGenerated: this.placementLayer.getRemovedKeys(),
      uploads,
      objects,
      scene: this.sceneService.getSceneSettings(),
    };
  }

  private async apply(project: ProjectFile): Promise<string[]> {
    const warnings: string[] = [];
    this.clearWorld();

    for (const upload of project.uploads) {
      this.library.restoreUpload({
        ...upload,
        file: unembed(upload.file),
        material: upload.material ? unembed(upload.material) : undefined,
      });
    }

    this.configService.setConfig(project.config);
    const config = this.configService.config;
    await this.terrainMesh.generate(config.terrain);
    this.placementLayer.restoreRemovedKeys(
      project.removedGenerated,
      config.placement,
      this.terrainMesh.getBuiltConfig()!
    );

    for (const saved of project.objects) {
      const instance = await this.restoreObject(saved);
      if (!instance) {
        warnings.push(`"${saved.name}" could not be restored.`);
        continue;
      }
      instance.name = saved.name;
      instance.snapToGround = saved.snapToGround;
      const { position, rotation, scale } = saved.transform;
      instance.object.position.fromArray(position);
      instance.object.rotation.set(rotation[0], rotation[1], rotation[2]);
      instance.object.scale.fromArray(scale);
      instance.keepRatio = scale[0] === scale[1] && scale[1] === scale[2];
      if (saved.color) setMeshColor(instance.object, saved.color);
    }
    this.objectsService.notifyChanged();
    this.sceneService.applySceneSettings(project.scene);
    return warnings;
  }

  private async restoreObject(saved: SavedObject): Promise<AssetInstance | undefined> {
    const origin = saved.origin;
    try {
      switch (origin.kind) {
        case 'library':
          return await this.objectsService.addLibraryObject(origin.assetId, new THREE.Vector3());
        case 'predefined': {
          const entry = (await this.assetLoader.loadPredefinedManifest()).find((a) => a.id === origin.id);
          return entry ? await this.objectsService.addPredefined(entry) : undefined;
        }
        case 'shape':
          return this.objectsService.addShape(origin.shape, origin.height, origin.width, saved.color ?? '#ffffff');
        case 'file':
          return await this.objectsService.addFromFile(
            unembed(origin.file),
            origin.material ? unembed(origin.material) : undefined
          );
      }
    } catch (error) {
      console.error(`Could not restore ${saved.name}:`, error);
      return undefined;
    }
  }

  private clearWorld(): void {
    this.selection.stopPlacing();
    this.selection.clear();
    this.objectsService.clearObjects();
    this.library.clearUploads();
  }
}

async function saveOrigin(origin: ObjectOrigin): Promise<SavedOrigin> {
  if (origin.kind !== 'file') return origin;
  return {
    kind: 'file',
    file: await embed(origin.file),
    material: origin.material ? await embed(origin.material) : undefined,
  };
}

async function embed(file: File): Promise<EmbeddedFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { name: file.name, data: btoa(binary) };
}

function unembed(file: EmbeddedFile): File {
  const binary = atob(file.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], file.name);
}

function meshColor(object: THREE.Object3D): string | undefined {
  if (!isMesh(object)) return undefined;
  const material = Array.isArray(object.material) ? object.material[0] : object.material;
  return isMaterialWithColor(material) ? `#${material.color.getHexString()}` : undefined;
}

function setMeshColor(object: THREE.Object3D, color: string): void {
  if (!isMesh(object)) return;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  materials.forEach((m) => isMaterialWithColor(m) && m.color.set(color));
}

// "C:\\worlds\\My island.worldbuilder.json" -> "My island"
function projectName(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? DEFAULT_NAME;
  return file.replace(/\.worldbuilder\.json$/i, '').replace(/\.json$/i, '') || DEFAULT_NAME;
}
