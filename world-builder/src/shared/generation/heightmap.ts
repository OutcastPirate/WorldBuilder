import { createNoise2D } from 'simplex-noise';
import { TerrainConfig, TerrainShape } from './config';
import { fbm } from './fbm';
import { mulberry32 } from './rng';

// Square grid of normalised heights in [0, 1], row-major. Row r runs along
// +Z and column c along +X, the same order as the vertices of a
// PlaneGeometry rotated to lie flat.
export interface Heightmap {
  size: number;
  data: Float32Array;
}

// Builds the heightmap for `config`. `size` lets the preview sample the same
// terrain on a coarser grid: positions are always measured in full-resolution
// vertex units, because the article gives the scale s in vertices.
export function generateHeightmap(
  config: TerrainConfig,
  size: number = config.resolution
): Heightmap {
  const noise = createNoise2D(mulberry32(config.seed));
  const data = new Float32Array(size * size);
  const step = (config.resolution - 1) / (size - 1);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      data[row * size + col] = fbm(noise, col * step, row * step, config);
    }
  }

  // Distance of each sample from the centre in the map's own metric:
  // 1 = on the border (radius for a circle, half-side for a square).
  const borderDistance = (i: number) => {
    const p = ((i % size) / (size - 1)) * 2 - 1;
    const q = (Math.floor(i / size) / (size - 1)) * 2 - 1;
    return config.shape === 'circle' ? Math.hypot(p, q) : Math.max(Math.abs(p), Math.abs(q));
  };

  // Min-max normalisation: every terrain spans the full [0, 1] range, so the
  // texturing thresholds of Table 2 always apply to the whole height range.
  // Only samples on the map count (an island ignores the corners). Min and
  // max are read from the stored 32-bit values so the result is exactly 0
  // and 1 at the extremes.
  normalise(data, (i) => borderDistance(i) <= 1);

  // Edge falloff: heights fade to 0 towards the border (an island's beach).
  if (config.edgeFalloff > 0) {
    for (let i = 0; i < data.length; i++) {
      const t = Math.min(Math.max((1 - borderDistance(i)) / config.edgeFalloff, 0), 1);
      data[i] *= t * t * (3 - 2 * t); // smoothstep
    }
    // Peaks near the border were lowered; stretch so the top is 1 again.
    normalise(data, (i) => borderDistance(i) <= 1, true);
  }
  return { size, data };
}

// Rescales `data` so the samples where `onMap` holds span [0, 1] (or only
// [.., 1] when `keepMinimum`); samples off the map are clamped.
function normalise(
  data: Float32Array,
  onMap: (i: number) => boolean,
  keepMinimum = false
): void {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (!onMap(i)) continue;
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  if (keepMinimum) min = 0;
  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.min(Math.max((data[i] - min) / range, 0), 1);
  }
}

// Whether a disc of radius `margin` around world point (x, z) lies on the
// map (centred on the origin, `worldSize` across).
export function isOnMap(
  shape: TerrainShape,
  worldSize: number,
  x: number,
  z: number,
  margin = 0
): boolean {
  const half = worldSize / 2 - margin;
  if (half < 0) return false;
  return shape === 'circle'
    ? x * x + z * z <= half * half
    : Math.abs(x) <= half && Math.abs(z) <= half;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Distance along a ray (origin + t · direction, direction normalised) to the
// first point where it meets the terrain, or null if it misses. The terrain
// spans [-worldSize/2, worldSize/2] on X and Z, heights [0, heightScale].
// Marches in half-vertex steps, then refines by bisection: exact enough for
// picking and much cheaper than raycasting the triangle mesh. For a circular
// map, ground outside the circle doesn't count.
export function intersectTerrain(
  map: Heightmap,
  worldSize: number,
  heightScale: number,
  origin: Vec3,
  direction: Vec3,
  shape: TerrainShape = 'square'
): number | null {
  const half = worldSize / 2;
  const heightAt = (x: number, z: number) =>
    sampleHeightmap(map, (x + half) / worldSize, (z + half) / worldSize) * heightScale;

  // Clip the ray to the terrain's bounding box (slab method).
  let tMin = 0;
  let tMax = Infinity;
  const box: [keyof Vec3, number, number][] = [
    ['x', -half, half],
    ['y', 0, heightScale],
    ['z', -half, half],
  ];
  for (const [axis, low, high] of box) {
    const o = origin[axis];
    const d = direction[axis];
    if (Math.abs(d) < 1e-12) {
      if (o < low || o > high) return null;
      continue;
    }
    let t0 = (low - o) / d;
    let t1 = (high - o) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    if (tMin > tMax) return null;
  }

  const below = (t: number) => {
    const x = origin.x + direction.x * t;
    const z = origin.z + direction.z * t;
    if (!isOnMap(shape, worldSize, x, z)) return false;
    return origin.y + direction.y * t <= heightAt(x, z);
  };
  if (below(tMin)) return tMin;

  const step = (worldSize / (map.size - 1)) * 0.5;
  for (let t = tMin + step; t <= tMax + step; t += step) {
    const end = Math.min(t, tMax);
    if (below(end)) {
      let low = end - step;
      let high = end;
      for (let i = 0; i < 12; i++) {
        const middle = (low + high) / 2;
        if (below(middle)) high = middle;
        else low = middle;
      }
      return high;
    }
  }
  return null;
}

// Bilinear sample at u, v in [0, 1] (u along columns / X, v along rows / Z).
export function sampleHeightmap(map: Heightmap, u: number, v: number): number {
  const last = map.size - 1;
  const x = Math.min(Math.max(u, 0), 1) * last;
  const y = Math.min(Math.max(v, 0), 1) * last;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, last);
  const y1 = Math.min(y0 + 1, last);
  const tx = x - x0;
  const ty = y - y0;

  const at = (c: number, r: number) => map.data[r * map.size + c];
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}
