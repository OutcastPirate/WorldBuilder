import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BehaviorSubject, Observable } from 'rxjs';
import { TerrainConfig } from '../generation/config';
import { Heightmap, intersectTerrain, isOnMap, sampleHeightmap } from '../generation/heightmap';
import { GenerationConfigService } from './generation-config.service';
import { GenerationWorkerService } from './generation-worker.service';
import { SceneService } from './scene.service';

@Injectable({
  providedIn: 'root',
})
export class TerrainMeshService {
  constructor(
    private sceneService: SceneService,
    private workerService: GenerationWorkerService,
    private configService: GenerationConfigService
  ) {}

  private mesh?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private heightmap?: Heightmap;
  private albedoCanvas?: HTMLCanvasElement;

  private _generating = new BehaviorSubject<boolean>(false);
  // Config the current mesh was built from (null before the first build).
  private _builtConfig = new BehaviorSubject<TerrainConfig | null>(null);

  generating$: Observable<boolean> = this._generating.asObservable();
  builtConfig$: Observable<TerrainConfig | null> =
    this._builtConfig.asObservable();

  getMesh(): THREE.Mesh | undefined {
    return this.mesh;
  }

  getHeightmap(): Heightmap | undefined {
    return this.heightmap;
  }

  async generate(
    config: TerrainConfig = this.configService.config.terrain
  ): Promise<void> {
    this._generating.next(true);
    try {
      const map = await this.workerService.generateHeightmap(config);
      this.applyHeightmap(map, config);
    } catch (error) {
      console.error('Terrain generation failed:', error);
    } finally {
      this._generating.next(false);
    }
  }

  // Terrain height in metres at world position (x, z), or undefined outside
  // the terrain.
  sampleHeight(x: number, z: number): number | undefined {
    const config = this._builtConfig.getValue();
    if (!this.heightmap || !config) return undefined;
    const u = (x + config.worldSize / 2) / config.worldSize;
    const v = (z + config.worldSize / 2) / config.worldSize;
    if (!isOnMap(config.shape, config.worldSize, x, z)) return undefined;
    return sampleHeightmap(this.heightmap, u, v) * config.heightScale;
  }

  // First point where `ray` meets the terrain, or undefined.
  intersectRay(ray: THREE.Ray): THREE.Vector3 | undefined {
    const config = this._builtConfig.getValue();
    if (!this.heightmap || !config) return undefined;
    const t = intersectTerrain(
      this.heightmap,
      config.worldSize,
      config.heightScale,
      ray.origin,
      ray.direction,
      config.shape
    );
    return t === null ? undefined : ray.at(t, new THREE.Vector3());
  }

  // Applies a baked colour texture (RGBA, size × size, row 0 = far edge -Z).
  setAlbedo(pixels: Uint8ClampedArray, size: number): void {
    if (!this.mesh) return;
    const material = this.mesh.material;

    if (!this.albedoCanvas || this.albedoCanvas.width !== size) {
      this.albedoCanvas = document.createElement('canvas');
      this.albedoCanvas.width = size;
      this.albedoCanvas.height = size;
      material.map?.dispose();
      // Canvas row 0 is the top of the image, which a CanvasTexture maps to
      // v = 1: the plane's -Z edge, the same edge as heightmap row 0.
      const texture = new THREE.CanvasTexture(this.albedoCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.sceneService.getMaxAnisotropy();
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }

    const context = this.albedoCanvas.getContext('2d')!;
    context.putImageData(new ImageData(pixels, size, size), 0, 0);
    material.map!.needsUpdate = true;
  }

  private applyHeightmap(map: Heightmap, config: TerrainConfig): void {
    const { worldSize, heightScale } = config;
    const segments = map.size - 1;
    const geometry = new THREE.PlaneGeometry(worldSize, worldSize, segments, segments);
    // Lay the plane flat: vertex rows now run along +Z, matching the
    // heightmap's row order.
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes['position'];
    const uv = geometry.attributes['uv'];
    const radius = worldSize / 2;
    const heightAt = (x: number, z: number) =>
      sampleHeightmap(map, x / worldSize + 0.5, z / worldSize + 0.5) * heightScale;
    for (let i = 0; i < position.count; i++) {
      let x = position.getX(i);
      let z = position.getZ(i);
      if (config.shape === 'circle') {
        // Pull vertices outside the circle onto its rim. Triangles that lie
        // fully outside collapse to nothing; the rest form a round edge.
        const r = Math.hypot(x, z);
        if (r > radius) {
          x *= radius / r;
          z *= radius / r;
          position.setX(i, x);
          position.setZ(i, z);
          uv.setXY(i, x / worldSize + 0.5, 0.5 - z / worldSize);
        }
        position.setY(i, heightAt(x, z));
      } else {
        position.setY(i, map.data[i] * heightScale);
      }
    }
    geometry.computeVertexNormals();
    this.updateBase(geometry, config);

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geometry;
    } else {
      // Plain green until the first texture bake arrives.
      const material = new THREE.MeshStandardMaterial({
        color: 0x4f7f3a,
        roughness: 0.95,
      });
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.name = 'Terrain';
      this.mesh.receiveShadow = true;
      this.sceneService.getScene().add(this.mesh);
    }

    const previous = this._builtConfig.getValue();
    this.heightmap = map;
    this._builtConfig.next({ ...config });

    if (
      !previous ||
      previous.worldSize !== config.worldSize ||
      previous.heightScale !== config.heightScale
    ) {
      this.sceneService.configureForWorld(config.worldSize, config.heightScale);
    }
  }

  // Sides and bottom of the terrain block: walls from the terrain's edge
  // down to -baseThickness, coloured like layered soil, and a flat bottom.
  private updateBase(terrain: THREE.BufferGeometry, config: TerrainConfig): void {
    if (this.base) {
      this.base.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      this.base.removeFromParent();
    }

    const depth = config.baseThickness;
    const half = config.worldSize / 2;
    const walls = new WallBuilder(depth);
    const edge = edgeVertices(terrain, config);

    if (config.shape === 'circle') {
      walls.add(edge, (p) => new THREE.Vector3(p.x, 0, p.z).normalize(), true);
    } else {
      // One wall per side, each with its own outward normal.
      const side = (filter: (p: THREE.Vector3) => boolean, sort: (p: THREE.Vector3) => number, normal: THREE.Vector3) =>
        walls.add(edge.filter(filter).sort((a, b) => sort(a) - sort(b)), () => normal, false);
      const on = (value: number, target: number) => Math.abs(value - target) < 1e-6;
      side((p) => on(p.z, -half), (p) => p.x, new THREE.Vector3(0, 0, -1));
      side((p) => on(p.x, half), (p) => p.z, new THREE.Vector3(1, 0, 0));
      side((p) => on(p.z, half), (p) => -p.x, new THREE.Vector3(0, 0, 1));
      side((p) => on(p.x, -half), (p) => -p.z, new THREE.Vector3(-1, 0, 0));
    }

    const bottomGeometry =
      config.shape === 'circle'
        ? new THREE.CircleGeometry(half, 128)
        : new THREE.PlaneGeometry(config.worldSize, config.worldSize);
    bottomGeometry.rotateX(Math.PI / 2); // face down
    bottomGeometry.translate(0, -depth, 0);

    const material = (options: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide, ...options });
    const wallMesh = new THREE.Mesh(walls.build(), (this.baseMaterials.walls ??= material({ vertexColors: true })));
    const bottomMesh = new THREE.Mesh(bottomGeometry, (this.baseMaterials.bottom ??= material({ color: 0x2f241a })));
    wallMesh.castShadow = wallMesh.receiveShadow = true;

    this.base = new THREE.Group().add(wallMesh, bottomMesh);
    this.base.name = 'Terrain base';
    this.sceneService.getScene().add(this.base);
  }

  private base?: THREE.Group;
  private baseMaterials: { walls?: THREE.Material; bottom?: THREE.Material } = {};
}

// Terrain vertices on the map's border (deduplicated).
function edgeVertices(geometry: THREE.BufferGeometry, config: TerrainConfig): THREE.Vector3[] {
  const position = geometry.attributes['position'];
  const half = config.worldSize / 2;
  const seen = new Set<string>();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(position, i);
    const onEdge =
      config.shape === 'circle'
        ? Math.hypot(p.x, p.z) > half - 1e-6
        : Math.abs(Math.abs(p.x) - half) < 1e-6 || Math.abs(Math.abs(p.z) - half) < 1e-6;
    const key = `${p.x.toFixed(5)},${p.z.toFixed(5)}`;
    if (!onEdge || seen.has(key)) continue;
    seen.add(key);
    points.push(p);
  }
  if (config.shape === 'circle') {
    points.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  }
  return points;
}

// Builds vertical walls under a line of edge points. Each column runs from
// the terrain height down through soil layers to -depth; vertex colours
// darken with depth and alternate slightly, giving a layered look.
class WallBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private static readonly LAYERS = [
    new THREE.Color(0x6b4f35),
    new THREE.Color(0x7a5c3e),
    new THREE.Color(0x5a432d),
    new THREE.Color(0x4f3b27),
    new THREE.Color(0x3a2c1e),
  ];

  constructor(private depth: number) {}

  add(points: THREE.Vector3[], normalOf: (p: THREE.Vector3) => THREE.Vector3, closed: boolean): void {
    const layers = WallBuilder.LAYERS;
    const rows = layers.length + 1; // the terrain edge, then one row per layer
    const first = this.positions.length / 3;

    for (const p of points) {
      const normal = normalOf(p);
      for (let row = 0; row < rows; row++) {
        // Row 0 follows the terrain; the rest sit at fixed depths 0 … -depth.
        const y = row === 0 ? p.y : -this.depth * ((row - 1) / (layers.length - 1));
        const color = layers[Math.max(row - 1, 0)];
        this.positions.push(p.x, Math.min(y, p.y), p.z);
        this.normals.push(normal.x, normal.y, normal.z);
        this.colors.push(color.r, color.g, color.b);
      }
    }

    const columns = points.length;
    const segments = closed ? columns : columns - 1;
    for (let c = 0; c < segments; c++) {
      const a = first + c * rows;
      const b = first + ((c + 1) % columns) * rows;
      for (let row = 0; row < rows - 1; row++) {
        this.indices.push(a + row, a + row + 1, b + row, b + row, a + row + 1, b + row + 1);
      }
    }
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    return geometry;
  }
}
