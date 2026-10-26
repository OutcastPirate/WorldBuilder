// npm run benchmark [-- --quick]
// Bundles scripts/benchmark/bench.ts (and the generation code it imports)
// with esbuild, then runs it in Node.js.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'world-builder-benchmark-'));
const outFile = join(outDir, 'bench.mjs');

try {
  await build({
    entryPoints: [join(root, 'benchmark', 'bench.ts')],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    logLevel: 'warning',
  });
  await import(pathToFileURL(outFile).href);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
