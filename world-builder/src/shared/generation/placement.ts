import { PlacementCategoryId, PlacementConfig, TerrainShape } from './config';
import { Heightmap, isOnMap, sampleHeightmap } from './heightmap';
import { poissonDiskSampling } from './poisson-disk';
import { mulberry32 } from './rng';

// Safety limit per category (e.g. rMin 0.5 m on a 1 km terrain would
// otherwise produce millions of objects).
export const MAX_OBJECTS_PER_CATEGORY = 20000;

// One automatically placed object. Positions are world metres with the
// terrain centred on the origin; the height on the terrain is resolved when
// the object is drawn, because it depends on the model's footprint.
export interface PlacedObject {
  id: string; // unique within one placement run
  categoryId: PlacementCategoryId;
  assetId: string;
  x: number;
  z: number;
  rotationY: number;
  scale: number;
}

export interface PlacementResult {
  objects: PlacedObject[];
  // Categories that hit MAX_OBJECTS_PER_CATEGORY.
  limitReached: PlacementCategoryId[];
}

// Area generated objects must stay out of (e.g. a hand-placed house).
// x, z in world metres; r is treated like a minimum distance: an object of a
// category keeps (r + rMin) / 2 away from the blocker's centre.
export interface PlacementBlocker {
  x: number;
  z: number;
  r: number;
}

export interface PlacementInput {
  heightmap: Heightmap;
  worldSize: number;
  heightScale: number;
  placement: PlacementConfig;
  shape?: TerrainShape;
  // Footprint radius of each model at scale 1 (metres), so whole objects
  // stay on the map instead of hanging over its border.
  assetRadii?: Record<string, number>;
  blockers?: PlacementBlocker[];
}

// Places every enabled category in order. Poisson Disk Sampling covers the
// whole terrain; points are then dropped where the terrain is outside the
// category's height range or too steep, by the density setting, and where
// they come too close to objects of earlier categories or to blockers, and
// where the object would not fit inside the map's border.
// Filtering after sampling (rather than rejecting candidates during it)
// keeps the sampler from getting stuck in one valley when the allowed areas
// are disconnected.
export function placeObjects(input: PlacementInput): PlacementResult {
  const { heightmap, worldSize, heightScale, placement } = input;
  const objects: PlacedObject[] = [];
  const limitReached: PlacementCategoryId[] = [];
  const blockers = input.blockers ?? [];
  const earlier = new SpatialHash(
    Math.max(maxRMin(placement), ...blockers.map((b) => b.r))
  );
  for (const b of blockers) {
    earlier.add(b.x + worldSize / 2, b.z + worldSize / 2, b.r);
  }

  placement.categories.forEach((category, index) => {
    if (!category.enabled || category.assetIds.length === 0) return;
    const random = mulberry32(placement.seed * 7919 + index * 104729);
    const points = poissonDiskSampling(
      worldSize,
      worldSize,
      category.rMin,
      random,
      30,
      MAX_OBJECTS_PER_CATEGORY
    );
    if (points.length >= MAX_OBJECTS_PER_CATEGORY) limitReached.push(category.id);

    const accepted: { x: number; y: number }[] = [];
    for (const point of points) {
      // Draw all random values first so filters don't shift the sequence.
      const keep = random();
      const asset = random();
      const rotation = random();
      const size = random();

      const u = point.x / worldSize;
      const v = point.y / worldSize;
      const h = sampleHeightmap(heightmap, u, v);
      if (h < category.heightRange[0] || h > category.heightRange[1]) continue;
      if (slopeDegrees(heightmap, u, v, worldSize, heightScale) > category.maxSlope) continue;
      if (keep >= category.density) continue;
      if (earlier.isNear(point.x, point.y, category.rMin)) continue;

      const assetId = category.assetIds[Math.floor(asset * category.assetIds.length)];
      const scale = 1 + (size * 2 - 1) * category.scaleVariation;
      const x = point.x - worldSize / 2;
      const z = point.y - worldSize / 2;
      const radius = (input.assetRadii?.[assetId] ?? 0) * scale;
      if (!isOnMap(input.shape ?? 'square', worldSize, x, z, radius)) continue;

      accepted.push(point);
      objects.push({
        id: `${category.id}-${objects.length}`,
        categoryId: category.id,
        assetId,
        x,
        z,
        rotationY: rotation * 2 * Math.PI,
        scale,
      });
    }
    accepted.forEach((p) => earlier.add(p.x, p.y, category.rMin));
  });

  return { objects, limitReached };
}

// Terrain slope in degrees at (u, v), from the heightmap gradient.
export function slopeDegrees(
  map: Heightmap,
  u: number,
  v: number,
  worldSize: number,
  heightScale: number
): number {
  const step = 1 / (map.size - 1);
  // Central difference, one-sided at the terrain edge (divide by the real
  // distance between the two samples).
  const u0 = Math.max(u - step, 0);
  const u1 = Math.min(u + step, 1);
  const v0 = Math.max(v - step, 0);
  const v1 = Math.min(v + step, 1);
  const dx =
    ((sampleHeightmap(map, u1, v) - sampleHeightmap(map, u0, v)) * heightScale) /
    ((u1 - u0) * worldSize);
  const dz =
    ((sampleHeightmap(map, u, v1) - sampleHeightmap(map, u, v0)) * heightScale) /
    ((v1 - v0) * worldSize);
  return (Math.atan(Math.sqrt(dx * dx + dz * dz)) * 180) / Math.PI;
}

function maxRMin(placement: PlacementConfig): number {
  return Math.max(1, ...placement.categories.map((c) => c.rMin));
}

// Objects of earlier categories, for the "keep apart" check. Two objects
// must be at least the average of their minimum distances apart.
class SpatialHash {
  private cells = new Map<string, { x: number; y: number; r: number }[]>();

  constructor(private cellSize: number) {}

  add(x: number, y: number, r: number): void {
    const key = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    const cell = this.cells.get(key);
    if (cell) cell.push({ x, y, r });
    else this.cells.set(key, [{ x, y, r }]);
  }

  isNear(x: number, y: number, r: number): boolean {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        for (const p of this.cells.get(this.key(col + dc, row + dr)) ?? []) {
          const minDistance = (p.r + r) / 2;
          if ((p.x - x) ** 2 + (p.y - y) ** 2 < minDistance * minDistance) return true;
        }
      }
    }
    return false;
  }

  private key(col: number, row: number): string {
    return `${col},${row}`;
  }
}
