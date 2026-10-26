import { DEFAULT_PLACEMENT_CONFIG, PlacementCategoryConfig, PlacementConfig } from './config';
import { Heightmap, sampleHeightmap } from './heightmap';
import { placeObjects, slopeDegrees } from './placement';
import { poissonDiskSampling } from './poisson-disk';
import { mulberry32 } from './rng';

function minDistance(points: { x: number; y: number }[]): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      min = Math.min(min, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return min;
}

// Heightmap rising linearly from 0 (row 0, -Z) to 1 (last row, +Z).
function ramp(size = 65): Heightmap {
  const data = new Float32Array(size * size);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) data[row * size + col] = row / (size - 1);
  }
  return { size, data };
}

const category = (patch: Partial<PlacementCategoryConfig>): PlacementCategoryConfig => ({
  id: 'vegetation',
  name: 'Vegetation',
  enabled: true,
  assetIds: ['a', 'b'],
  rMin: 4,
  heightRange: [0, 1],
  maxSlope: 90,
  density: 1,
  scaleVariation: 0,
  ...patch,
});

describe('poissonDiskSampling', () => {
  const points = poissonDiskSampling(100, 100, 4, mulberry32(5));

  it('keeps every pair of points at least rMin apart', () => {
    expect(minDistance(points)).toBeGreaterThanOrEqual(4);
  });

  it('stays inside the area', () => {
    expect(points.every((p) => p.x >= 0 && p.x < 100 && p.y >= 0 && p.y < 100)).toBeTrue();
  });

  it('covers the area densely (no large empty regions)', () => {
    // Maximal Poisson disk sets reach roughly 0.6–0.7 points per rMin² area unit.
    const density = points.length / ((100 * 100) / (4 * 4));
    expect(density).toBeGreaterThan(0.5);
    // Every 2·rMin square cell should contain a point.
    for (let x = 0; x < 100; x += 8) {
      for (let y = 0; y < 100; y += 8) {
        const hit = points.some((p) => p.x >= x && p.x < x + 8 && p.y >= y && p.y < y + 8);
        expect(hit).withContext(`cell ${x},${y}`).toBeTrue();
      }
    }
  });

  it('is reproducible from the seed', () => {
    expect(poissonDiskSampling(50, 50, 3, mulberry32(9))).toEqual(
      poissonDiskSampling(50, 50, 3, mulberry32(9))
    );
  });

  it('stops at maxPoints', () => {
    expect(poissonDiskSampling(100, 100, 1, mulberry32(1), 30, 50).length).toBe(50);
  });
});

describe('placeObjects', () => {
  const heightmap = ramp();
  const input = (categories: PlacementCategoryConfig[]): Parameters<typeof placeObjects>[0] => ({
    heightmap,
    worldSize: 64,
    heightScale: 4,
    placement: { seed: 3, categories } satisfies PlacementConfig,
  });

  it('only places objects inside the height range', () => {
    const { objects } = placeObjects(input([category({ heightRange: [0.25, 0.5] })]));
    expect(objects.length).toBeGreaterThan(0);
    for (const o of objects) {
      const h = sampleHeightmap(heightmap, (o.x + 32) / 64, (o.z + 32) / 64);
      expect(h).toBeGreaterThanOrEqual(0.25);
      expect(h).toBeLessThanOrEqual(0.5);
    }
  });

  it('skips ground steeper than the maximum slope', () => {
    // The ramp climbs 4 m over 64 m: about 3.6°.
    expect(slopeDegrees(heightmap, 0.5, 0.5, 64, 4)).toBeCloseTo(3.58, 1);
    expect(placeObjects(input([category({ maxSlope: 3 })])).objects.length).toBe(0);
    expect(placeObjects(input([category({ maxSlope: 5 })])).objects.length).toBeGreaterThan(0);
  });

  it('thins objects out by density', () => {
    const full = placeObjects(input([category({ density: 1 })])).objects.length;
    const half = placeObjects(input([category({ density: 0.5 })])).objects.length;
    expect(half).toBeGreaterThan(full * 0.35);
    expect(half).toBeLessThan(full * 0.65);
  });

  it('keeps later categories away from earlier ones', () => {
    const { objects } = placeObjects(
      input([
        category({ id: 'buildings', rMin: 10, assetIds: ['house'] }),
        category({ id: 'vegetation', rMin: 2, assetIds: ['tree'] }),
      ])
    );
    const buildings = objects.filter((o) => o.categoryId === 'buildings');
    const trees = objects.filter((o) => o.categoryId === 'vegetation');
    expect(buildings.length).toBeGreaterThan(0);
    for (const tree of trees) {
      for (const building of buildings) {
        // (10 + 2) / 2 = 6 m
        expect(Math.hypot(tree.x - building.x, tree.z - building.z)).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('skips disabled categories and categories without models', () => {
    expect(placeObjects(input([category({ enabled: false })])).objects.length).toBe(0);
    expect(placeObjects(input([category({ assetIds: [] })])).objects.length).toBe(0);
  });

  it('is reproducible and changes with the seed', () => {
    const config = input(DEFAULT_PLACEMENT_CONFIG.categories);
    expect(placeObjects(config)).toEqual(placeObjects(config));
    const other = { ...config, placement: { ...config.placement, seed: 4 } };
    expect(placeObjects(other).objects).not.toEqual(placeObjects(config).objects);
  });
});

describe('placeObjects with blockers', () => {
  it('keeps generated objects away from hand-placed ones', () => {
    const base = {
      heightmap: ramp(),
      worldSize: 64,
      heightScale: 4,
      placement: { seed: 3, categories: [category({ rMin: 2 })] },
    };
    const blocker = { x: 0, z: 0, r: 10 };
    const without = placeObjects(base).objects;
    const withBlocker = placeObjects({ ...base, blockers: [blocker] }).objects;
    expect(without.some((o) => Math.hypot(o.x, o.z) < 6)).toBeTrue();
    // (10 + 2) / 2 = 6 m around the blocker stays clear.
    expect(withBlocker.every((o) => Math.hypot(o.x, o.z) >= 6)).toBeTrue();
  });

  it('gives every object a unique id', () => {
    const { objects } = placeObjects({
      heightmap: ramp(),
      worldSize: 64,
      heightScale: 4,
      placement: DEFAULT_PLACEMENT_CONFIG,
    });
    expect(new Set(objects.map((o) => o.id)).size).toBe(objects.length);
  });
});

describe('placeObjects at the border', () => {
  const base = {
    heightmap: ramp(),
    worldSize: 64,
    heightScale: 4,
    placement: { seed: 3, categories: [category({ rMin: 2, assetIds: ['big'], scaleVariation: 0.3 })] },
    assetRadii: { big: 3 },
  };

  for (const shape of ['square', 'circle'] as const) {
    it(`keeps whole footprints inside a ${shape} map`, () => {
      const { objects } = placeObjects({ ...base, shape });
      expect(objects.length).toBeGreaterThan(0);
      for (const o of objects) {
        const r = 3 * o.scale;
        if (shape === 'circle') {
          expect(Math.hypot(o.x, o.z) + r).toBeLessThanOrEqual(32 + 1e-9);
        } else {
          expect(Math.max(Math.abs(o.x), Math.abs(o.z)) + r).toBeLessThanOrEqual(32 + 1e-9);
        }
      }
    });
  }
});
