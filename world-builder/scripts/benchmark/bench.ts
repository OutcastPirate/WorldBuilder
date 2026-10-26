// Times the generation steps (no browser, no rendering). Bundled and run by
// scripts/benchmark.mjs; results are printed as Markdown tables.
import * as os from 'node:os';
import { generateBuiltinTexture } from '../../src/shared/generation/builtin-textures';
import {
  BUILTIN_TEXTURE_IDS,
  DEFAULT_PLACEMENT_CONFIG,
  DEFAULT_TERRAIN_CONFIG,
  DEFAULT_TEXTURING_CONFIG,
  TerrainConfig,
  TerrainResolution,
} from '../../src/shared/generation/config';
import { generateHeightmap } from '../../src/shared/generation/heightmap';
import { placeObjects } from '../../src/shared/generation/placement';
import { poissonDiskSampling } from '../../src/shared/generation/poisson-disk';
import { mulberry32 } from '../../src/shared/generation/rng';
import { bakeAlbedo } from '../../src/shared/generation/texturing';

const quick = process.argv.includes('--quick');
const RUNS = quick ? 3 : 7;

// Median wall-clock time of `RUNS` runs (after one warm-up run).
function time<T>(fn: () => T): { ms: number; result: T } {
  let result = fn();
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    result = fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { ms: times[Math.floor(times.length / 2)], result };
}

const fmt = (ms: number) => (ms < 10 ? ms.toFixed(2) : ms < 100 ? ms.toFixed(1) : Math.round(ms).toString());
const table = (header: string[], rows: (string | number)[][]) =>
  [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

const cpu = os.cpus()[0];
console.log('## Environment\n');
console.log(table(
  ['Item', 'Value'],
  [
    ['CPU', `${cpu.model.trim()} (${os.cpus().length} logical cores)`],
    ['Memory', `${Math.round(os.totalmem() / 1024 ** 3)} GB`],
    ['OS', `${os.type()} ${os.release()}`],
    ['Node.js', process.version],
    ['Runs per measurement', `${RUNS} (median, after one warm-up)`],
  ]
));

// 1. Heightmap generation (Simplex Noise fBm, equation 1).
const resolutions: TerrainResolution[] = [129, 257, 513];
const octaves = [1, 4, 8];
console.log('\n## Heightmap generation (ms)\n');
console.log(table(
  ['Resolution', ...octaves.map((k) => `K = ${k}`)],
  resolutions.map((resolution) => [
    `${resolution} × ${resolution}`,
    ...octaves.map((k) => fmt(time(() => generateHeightmap({ ...DEFAULT_TERRAIN_CONFIG, resolution, octaves: k })).ms)),
  ])
));

// 2. Texture bake (height-based texturing with linear blending).
const heightmap257 = generateHeightmap({ ...DEFAULT_TERRAIN_CONFIG, resolution: 257 });
const textures = BUILTIN_TEXTURE_IDS.slice(0, 4).map((id) => generateBuiltinTexture(id, 64));
console.log('\n## Texture bake (ms)\n');
console.log(table(
  ['Texture size', 'Pixels', 'Time'],
  [1024, 2048].map((size) => [
    `${size} × ${size}`,
    (size * size).toLocaleString('en'),
    fmt(time(() => bakeAlbedo(heightmap257, DEFAULT_TEXTURING_CONFIG, textures, size)).ms),
  ])
));

// 3. Poisson Disk Sampling on a 128 m × 128 m terrain.
console.log('\n## Poisson Disk Sampling, 128 m × 128 m (k = 30)\n');
console.log(table(
  ['r_min', 'Points', 'Time (ms)', 'µs per point'],
  [1, 2, 3, 5, 10].map((rMin) => {
    const { ms, result } = time(() => poissonDiskSampling(128, 128, rMin, mulberry32(7)));
    return [`${rMin} m`, result.length.toLocaleString('en'), fmt(ms), ((ms * 1000) / result.length).toFixed(1)];
  })
));

// 4. Full object placement with the default categories.
console.log('\n## Object placement, default categories (ms)\n');
const placementRows = resolutions.map((resolution) => {
  const terrain: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG, resolution };
  const heightmap = generateHeightmap(terrain);
  const assetRadii = Object.fromEntries(
    DEFAULT_PLACEMENT_CONFIG.categories.flatMap((c) => c.assetIds.map((id) => [id, 1.5]))
  );
  const { ms, result } = time(() =>
    placeObjects({
      heightmap,
      worldSize: terrain.worldSize,
      heightScale: terrain.heightScale,
      placement: DEFAULT_PLACEMENT_CONFIG,
      assetRadii,
    })
  );
  return [`${resolution} × ${resolution}`, result.objects.length.toLocaleString('en'), fmt(ms)];
});
console.log(table(['Resolution', 'Objects', 'Time'], placementRows));
