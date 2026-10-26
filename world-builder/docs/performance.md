# Performance measurements

Measured on 2026-10-26. Re-run on other hardware with `npm run benchmark`
(generation steps) and the **Scene → Performance** overlay (rendering).

## Test machine

| Item | Value |
|---|---|
| CPU | AMD Ryzen 5 5600H (6 cores / 12 threads) |
| GPU | AMD Radeon integrated graphics (Direct3D 11 through ANGLE) |
| Memory | 16 GB |
| Display | 144 Hz (the frame rate cannot exceed this) |
| OS | Windows 10 (10.0.19045) |
| Runtime | Electron 36 (Chromium); benchmark in Node.js 22 |

## Generation steps (`npm run benchmark`)

Median of 7 runs after one warm-up run. Generation runs in a Web Worker in
the app, so these times never block the interface.

### Heightmap (Simplex Noise fBm, equation 1), ms

| Resolution | K = 1 | K = 4 | K = 8 |
|---|---|---|---|
| 129 × 129 | 1.24 | 2.19 | 4.37 |
| 257 × 257 | 2.51 | 8.07 | 18.2 |
| 513 × 513 | 10.3 | 33.1 | 69.2 |

Time grows linearly with the number of vertices and with the number of octaves K.

### Texture bake (height zones with linear blending), ms

| Texture size | Pixels | Time |
|---|---|---|
| 1024 × 1024 | 1,048,576 | 92.4 |
| 2048 × 2048 | 4,194,304 | 367 |

### Poisson Disk Sampling, 128 m × 128 m, k = 30

| r<sub>min</sub> | Points | Time (ms) | µs per point |
|---|---|---|---|
| 1 m | 10,447 | 53.4 | 5.1 |
| 2 m | 2,656 | 13.1 | 4.9 |
| 3 m | 1,176 | 5.39 | 4.6 |
| 5 m | 433 | 1.95 | 4.5 |
| 10 m | 117 | 0.51 | 4.4 |

The cost per point stays almost constant across two orders of magnitude,
which matches the O(n) running time of Bridson's algorithm (section 3.3).

### Object placement, default categories, ms

| Resolution | Objects | Time |
|---|---|---|
| 129 × 129 | 692 | 9.53 |
| 257 × 257 | 544 | 8.76 |
| 513 × 513 | 295 | 8.32 |

(Object counts differ because the terrain shape, and so the height and slope
filters, change with the resolution.)

## Rendering (Scene → Performance overlay)

Default terrain (257 × 257, 128 m) with automatic texturing.

| Scene | Objects | Triangles | GPU | Frame rate |
|---|---|---|---|---|
| Default placement | 549 | 181 k | Radeon integrated | 144 fps (display limit) |
| Dense forest (vegetation r<sub>min</sub> = 1 m) | 4,411 | 1.6 M | Radeon integrated | 79 fps |
| Default placement | 549 | 181 k | none – software rendering (Microsoft WARP, Chrome with GPU disabled) | 11 fps |

Placed objects are drawn with one InstancedMesh per model part, so the
dense scene still needs only a few dozen draw calls.

## How to reproduce

```bash
npm run benchmark            # generation steps, prints the tables above
npm run benchmark -- --quick # 3 runs per measurement instead of 7
```

For rendering, open **Scene → Performance**, tick *Show frame rate, draw
calls and triangles*, stop the camera rotation, and read the overlay after a
few seconds. The software-rendering row was measured by serving the browser
build (`npm run build`) from a static server and opening it in Chrome started
with `--disable-gpu`.

## Figures

`docs/figures/` contains screenshots from the app:

| File | Shows |
|---|---|
| `fig-terrain-mountains.png` | Small scale, many octaves, high persistence (s = 90, K = 8, p = 0.65): a mountain massif |
| `fig-terrain-plains.png` | Large scale, few octaves, low persistence (s = 450, K = 2, p = 0.3): gentle plains |
| `fig-texturing.png` | Default terrain with the four height zones of Table 2 |
| `fig-placement.png` | Default object placement (buildings, rocks, vegetation) |
| `fig-island.png` | Island map with edge falloff and terrain sides |
| `fig-interface.png` | The whole interface |
