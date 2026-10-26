import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { browserDeflate, encodePng } from '../generation/png';
import {
  encodeRaw16,
  encodeSplatmap,
  ExportedObject,
  terrainDataJson,
  toTerrainLocal,
  unityReadme,
} from '../generation/terrain-export';
import { AssetLibraryService } from './asset-library.service';
import { FileSaveService, SaveResult } from './file-save.service';
import { GenerationConfigService } from './generation-config.service';
import { ObjectsService } from './objects.service';
import { writeObj } from './obj-writer';
import { PlacementLayerService } from './placement-layer.service';
import { TerrainMeshService } from './terrain-mesh.service';

const OBJ_FILE = 'world.obj';
const MTL_FILE = 'world.mtl';

export interface ExportOptions {
  terrainSides: boolean;
  generatedObjects: boolean;
  handPlacedObjects: boolean;
  // Generated objects as EXT_mesh_gpu_instancing (smaller, needs importer
  // support) instead of one node per object sharing the same mesh data.
  gpuInstancing: boolean;
}

export interface ExportOutcome {
  result: SaveResult;
  bytes: number;
}

// Exports the world for game engines (section 4.1, stage 5): a GLB with
// everything, an OBJ + MTL folder, or native Unity Terrain data.
@Injectable({
  providedIn: 'root',
})
export class ExportService {
  constructor(
    private terrainMesh: TerrainMeshService,
    private placementLayer: PlacementLayerService,
    private objectsService: ObjectsService,
    private configService: GenerationConfigService,
    private library: AssetLibraryService,
    private fileSave: FileSaveService
  ) {}

  canExport(): boolean {
    return !!this.terrainMesh.getMesh() && !!this.terrainMesh.getBuiltConfig();
  }

  async exportGlb(options: ExportOptions): Promise<ExportOutcome> {
    const scene = this.buildScene(options);
    const glb = (await new GLTFExporter().parseAsync(scene, {
      binary: true,
      onlyVisible: true,
    })) as ArrayBuffer;
    const result = await this.fileSave.saveFile(`${this.baseName()}.glb`, glb, [
      { name: 'glTF binary', extensions: ['glb'] },
    ]);
    return { result, bytes: glb.byteLength };
  }

  async exportObj(options: ExportOptions): Promise<ExportOutcome> {
    // OBJ has no instancing: every object is written out in full.
    const scene = this.buildScene({ ...options, gpuInstancing: false });
    const { obj, mtl, textures } = writeObj(scene, MTL_FILE);
    const files: { name: string; data: string | Uint8Array }[] = [
      { name: OBJ_FILE, data: obj },
      { name: MTL_FILE, data: mtl },
    ];
    for (const texture of textures) {
      files.push({ name: texture.name, data: await imageToPng(texture.image) });
    }
    const result = await this.fileSave.saveFiles(`${this.baseName()} (OBJ)`, files);
    return { result, bytes: files.reduce((sum, f) => sum + byteLength(f.data), 0) };
  }

  async exportTerrainData(options: Pick<ExportOptions, 'generatedObjects' | 'handPlacedObjects'>): Promise<ExportOutcome> {
    const terrain = this.terrainMesh.getBuiltConfig()!;
    const heightmap = this.terrainMesh.getHeightmap()!;
    const texturing = this.configService.config.texturing;

    const raw = encodeRaw16(heightmap);
    const splatmap = await encodePng(
      heightmap.size,
      heightmap.size,
      encodeSplatmap(heightmap, texturing),
      browserDeflate
    );
    const json = terrainDataJson(terrain, texturing, this.exportedObjects(options));
    const files = [
      { name: 'heightmap.raw', data: raw },
      { name: 'splatmap.png', data: splatmap },
      { name: 'objects.json', data: json },
      { name: 'README.txt', data: unityReadme(terrain, texturing) },
    ];
    const result = await this.fileSave.saveFiles(`${this.baseName()} (Unity terrain)`, files);
    return { result, bytes: files.reduce((sum, f) => sum + byteLength(f.data), 0) };
  }

  // A separate scene holding copies of what should be exported (sharing
  // geometry and materials), without editor helpers such as the gizmo,
  // the selection box or the lights.
  buildScene(options: ExportOptions): THREE.Scene {
    const scene = new THREE.Scene();
    const world = new THREE.Group();
    world.name = 'World Builder';
    scene.add(world);

    const terrain = this.terrainMesh.getMesh();
    if (terrain) world.add(named(new THREE.Mesh(terrain.geometry, terrain.material), 'Terrain'));
    const base = this.terrainMesh.getBase();
    if (options.terrainSides && base) world.add(named(base.clone(), 'Terrain sides'));

    if (options.generatedObjects) world.add(this.generatedGroup(options.gpuInstancing));

    if (options.handPlacedObjects) {
      const group = named(new THREE.Group(), 'Hand-placed objects');
      for (const instance of this.objectsService.objects) {
        group.add(named(instance.object.clone(), instance.name));
      }
      world.add(group);
    }
    return scene;
  }

  private generatedGroup(gpuInstancing: boolean): THREE.Group {
    const group = named(new THREE.Group(), 'Generated objects');
    const meshes = this.placementLayer.getMeshes();

    if (gpuInstancing) {
      for (const mesh of meshes) {
        const copy = new THREE.InstancedMesh(mesh.geometry, mesh.material, mesh.count);
        copy.instanceMatrix.copy(mesh.instanceMatrix);
        group.add(named(copy, this.assetName(mesh.name)));
      }
      return group;
    }

    // One node per object; its parts reuse the same mesh data, which glTF
    // stores only once, so the file stays small.
    const nodes = new Map<string, THREE.Group>();
    const matrix = new THREE.Matrix4();
    for (const mesh of meshes) {
      const ids = mesh.userData['objectIds'] as string[];
      for (let i = 0; i < mesh.count; i++) {
        let node = nodes.get(ids[i]);
        if (!node) {
          node = named(new THREE.Group(), this.assetName(mesh.name));
          mesh.getMatrixAt(i, matrix);
          matrix.decompose(node.position, node.quaternion, node.scale);
          nodes.set(ids[i], node);
          group.add(node);
        }
        node.add(new THREE.Mesh(mesh.geometry, mesh.material));
      }
    }
    return group;
  }

  private exportedObjects(options: Pick<ExportOptions, 'generatedObjects' | 'handPlacedObjects'>): ExportedObject[] {
    const worldSize = this.terrainMesh.getBuiltConfig()!.worldSize;
    const objects: ExportedObject[] = [];
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();

    if (options.generatedObjects) {
      for (const object of this.placementLayer.getObjects()) {
        const matrix = this.placementLayer.getMatrix(object.id);
        if (!matrix) continue;
        matrix.decompose(position, quaternion, scale);
        objects.push({
          name: this.assetName(object.assetId),
          assetId: object.assetId,
          category: object.categoryId,
          source: 'generated',
          position: toTerrainLocal(worldSize, position.x, position.y, position.z),
          rotationY: round(THREE.MathUtils.radToDeg(object.rotationY)),
          scale: round(object.scale),
        });
      }
    }
    if (options.handPlacedObjects) {
      for (const instance of this.objectsService.objects) {
        const object = instance.object;
        euler.setFromQuaternion(object.quaternion, 'YXZ');
        objects.push({
          name: instance.name,
          assetId: instance.assetId,
          category: instance.assetId ? this.library.find(instance.assetId)?.category : undefined,
          source: 'hand-placed',
          position: toTerrainLocal(worldSize, object.position.x, object.position.y, object.position.z),
          rotationY: round(THREE.MathUtils.radToDeg(euler.y)),
          scale: round(object.scale.x),
        });
      }
    }
    return objects;
  }

  private assetName(assetId: string): string {
    return this.library.find(assetId)?.name ?? assetId;
  }

  private baseName(): string {
    const terrain = this.terrainMesh.getBuiltConfig();
    const shape = terrain?.shape === 'circle' ? 'island' : 'world';
    return `world-builder-${shape}-${terrain?.seed ?? 0}`;
  }
}

function named<T extends THREE.Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function byteLength(data: string | Uint8Array): number {
  return typeof data === 'string' ? new TextEncoder().encode(data).length : data.byteLength;
}

async function imageToPng(image: CanvasImageSource): Promise<Uint8Array> {
  let canvas: HTMLCanvasElement;
  if (image instanceof HTMLCanvasElement) {
    canvas = image;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = (image as HTMLImageElement).width;
    canvas.height = (image as HTMLImageElement).height;
    canvas.getContext('2d')!.drawImage(image, 0, 0);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The texture could not be converted to PNG.');
  return new Uint8Array(await blob.arrayBuffer());
}
