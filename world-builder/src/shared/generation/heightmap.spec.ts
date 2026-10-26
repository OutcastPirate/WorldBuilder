import { createNoise2D } from 'simplex-noise';
import { DEFAULT_TERRAIN_CONFIG, TerrainConfig } from './config';
import { fbm } from './fbm';
import { generateHeightmap, Heightmap, intersectTerrain, isOnMap, sampleHeightmap } from './heightmap';
import { mulberry32 } from './rng';

const config: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG, resolution: 129 };

// Mean absolute height difference between horizontal neighbours.
function roughness(map: Heightmap): number {
  let sum = 0;
  for (let row = 0; row < map.size; row++) {
    for (let col = 1; col < map.size; col++) {
      sum += Math.abs(map.data[row * map.size + col] - map.data[row * map.size + col - 1]);
    }
  }
  return sum / (map.size * (map.size - 1));
}

describe('fbm', () => {
  it('stays within [-1, 1]', () => {
    const noise = createNoise2D(mulberry32(3));
    for (let i = 0; i < 2000; i++) {
      const h = fbm(noise, i * 3.7, i * 1.3, config);
      expect(Math.abs(h)).toBeLessThanOrEqual(1);
    }
  });
});

describe('generateHeightmap', () => {
  it('is reproducible from the seed', () => {
    const a = generateHeightmap(config);
    const b = generateHeightmap(config);
    expect(a.data).toEqual(b.data);
  });

  it('changes with the seed', () => {
    const a = generateHeightmap(config);
    const b = generateHeightmap({ ...config, seed: config.seed + 1 });
    expect(a.data).not.toEqual(b.data);
  });

  it('normalises heights to exactly [0, 1]', () => {
    const map = generateHeightmap(config);
    let min = Infinity;
    let max = -Infinity;
    map.data.forEach((h) => {
      min = Math.min(min, h);
      max = Math.max(max, h);
    });
    expect(min).toBe(0);
    expect(max).toBe(1);
  });

  it('adds finer detail with more octaves', () => {
    // Guards the octave frequency direction. Octave k adds slope in
    // proportion to (p·λ)^k, so with p = 0.7 and λ = 2 six octaves should be
    // about 2.5× rougher than one. With the frequency divided by λ^k (as
    // equation (1) is printed) they would be smoother instead.
    const params = { ...config, persistence: 0.7, lacunarity: 2 };
    const smooth = generateHeightmap({ ...params, octaves: 1 });
    const detailed = generateHeightmap({ ...params, octaves: 6 });
    expect(roughness(detailed)).toBeGreaterThan(roughness(smooth) * 1.5);
  });

  it('builds a preview of the same terrain on a coarser grid', () => {
    const full = generateHeightmap(config);
    const preview = generateHeightmap(config, 33);
    expect(preview.size).toBe(33);
    // (129 - 1) / (33 - 1) = 4: preview pixel (r, c) samples vertex (4r, 4c).
    const errors: number[] = [];
    for (let row = 0; row < 33; row += 8) {
      for (let col = 0; col < 33; col += 8) {
        errors.push(Math.abs(preview.data[row * 33 + col] - full.data[row * 4 * 129 + col * 4]));
      }
    }
    // Only the min-max normalisation can differ slightly between the two.
    expect(Math.max(...errors)).toBeLessThan(0.05);
  });
});

describe('sampleHeightmap', () => {
  const map: Heightmap = { size: 2, data: new Float32Array([0, 1, 0, 1]) };

  it('returns grid values at the corners', () => {
    expect(sampleHeightmap(map, 0, 0)).toBe(0);
    expect(sampleHeightmap(map, 1, 1)).toBe(1);
  });

  it('interpolates between grid points', () => {
    expect(sampleHeightmap(map, 0.25, 0.5)).toBeCloseTo(0.25);
  });

  it('clamps positions outside the map', () => {
    expect(sampleHeightmap(map, 2, -1)).toBe(1);
  });
});

describe('intersectTerrain', () => {
  // Flat terrain at height 0.5 × 10 m = 5 m, 100 m wide.
  const flat: Heightmap = { size: 3, data: new Float32Array(9).fill(0.5) };

  it('finds the ground straight below', () => {
    const t = intersectTerrain(flat, 100, 10, { x: 0, y: 50, z: 0 }, { x: 0, y: -1, z: 0 });
    expect(t).toBeCloseTo(45, 2);
  });

  it('finds the ground along a slanted ray', () => {
    const d = { x: Math.SQRT1_2, y: -Math.SQRT1_2, z: 0 };
    const t = intersectTerrain(flat, 100, 10, { x: -40, y: 25, z: 0 }, d)!;
    expect(-40 + d.x * t).toBeCloseTo(-20, 1); // drops 20 m to reach y = 5
  });

  it('misses when the ray points away or passes beside the terrain', () => {
    expect(intersectTerrain(flat, 100, 10, { x: 0, y: 50, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
    expect(intersectTerrain(flat, 100, 10, { x: 80, y: 50, z: 0 }, { x: 0, y: -1, z: 0 })).toBeNull();
  });

  it('hits a hillside before the ground behind it', () => {
    // Ridge along the middle column: 0 | 1 | 0.
    const ridge: Heightmap = { size: 3, data: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]) };
    const t = intersectTerrain(ridge, 100, 10, { x: -60, y: 5, z: 0 }, { x: 1, y: 0, z: 0 })!;
    // Height 5 m is reached halfway up the slope at x = -25.
    expect(-60 + t).toBeCloseTo(-25, 1);
  });
});

describe('map shape and edge falloff', () => {
  const island: TerrainConfig = { ...config, shape: 'circle', edgeFalloff: 0.35 };

  it('slopes down to height 0 at the border', () => {
    const map = generateHeightmap(island);
    const size = map.size;
    // Border points of the circle: middle of each side of the square.
    const middle = (size - 1) / 2;
    for (const [row, col] of [[0, middle], [middle, 0], [size - 1, middle], [middle, size - 1]]) {
      expect(map.data[row * size + col]).toBeLessThan(0.01);
    }
  });

  it('still spans the full height range inside the map', () => {
    const map = generateHeightmap(island);
    expect(Math.max(...map.data)).toBeCloseTo(1, 5);
  });

  it('normalises over the circle only (corners do not count)', () => {
    const map = generateHeightmap({ ...config, shape: 'circle', edgeFalloff: 0 });
    const size = map.size;
    let min = Infinity;
    let max = -Infinity;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const p = (col / (size - 1)) * 2 - 1;
        const q = (row / (size - 1)) * 2 - 1;
        if (p * p + q * q > 1) continue;
        min = Math.min(min, map.data[row * size + col]);
        max = Math.max(max, map.data[row * size + col]);
      }
    }
    expect(min).toBe(0);
    expect(max).toBe(1);
  });

  it('tells whether a footprint fits on the map', () => {
    expect(isOnMap('square', 100, 49, 49)).toBeTrue();
    expect(isOnMap('square', 100, 49, 49, 2)).toBeFalse();
    expect(isOnMap('circle', 100, 40, 40)).toBeFalse(); // corner region
    expect(isOnMap('circle', 100, 30, 30, 5)).toBeTrue();
  });

  it('ignores ground outside an island when picking', () => {
    const flat: Heightmap = { size: 3, data: new Float32Array(9).fill(0.5) };
    // Straight down onto a corner of the square: outside the circle.
    expect(intersectTerrain(flat, 100, 10, { x: 45, y: 50, z: 45 }, { x: 0, y: -1, z: 0 }, 'circle')).toBeNull();
    expect(intersectTerrain(flat, 100, 10, { x: 45, y: 50, z: 45 }, { x: 0, y: -1, z: 0 }, 'square')).toBeCloseTo(45, 2);
  });
});
