# World Builder

A desktop tool for generating 3D environments for game engines, built with
Angular 17, Three.js and Electron. It generates terrain with Simplex Noise,
textures it automatically by height, places trees, rocks and buildings with
Poisson Disk Sampling, lets you edit the result in the 3D view, and exports
it for Unity.

## Requirements

- **Node.js 18.19+ or 20+** (tested with Node 22) and npm
- Windows, macOS or Linux (Electron 36)

## Installation

```bash
cd world-builder
npm install
```

## Launching the app

| Goal | Command | What it does |
|---|---|---|
| Desktop app, development | `npm run electron:dev` | Starts `ng serve`, waits for `http://localhost:4200`, then opens Electron (with DevTools) on the dev server. Code changes reload live. Closing either one stops both. |
| Desktop app, production build | `npm run electron:start` | Runs `ng build`, then opens Electron on the built files in `dist/world-builder/browser`. |
| Re-open the last build | `npm run electron` | Opens Electron without rebuilding (run `npm run build` first). |
| Browser only | `npm start` | Runs the Angular dev server; open http://localhost:4200. |

> **Note:** the scripts start Electron through `scripts/start-electron.js`, which
> removes the `ELECTRON_RUN_AS_NODE` variable. VS Code sets it for some child
> processes. With it set, running `electron .` directly fails with
> `Cannot read properties of undefined (reading 'registerSchemesAsPrivileged')`.
> Use the npm scripts above instead.

## Using the app

The side menu follows the workflow: **Terrain → Textures → Objects → Scene → Export**.

- **Projects:** *New*, *Open…* and *Save…* under the title (Ctrl+O, Ctrl+S).
  A project (`.worldbuilder.json`) holds every setting, the hand-placed
  objects, deleted generated objects, uploaded models (embedded) and the
  scene settings.

- **3D view (left):** left-drag to orbit, right-drag to pan, scroll to zoom.
  *Stop rotation* / *Rotate* switch the camera's auto-rotation; *Reset Rotation*
  returns the camera to its starting position.
- **Terrain:** map shape (square or island) and edge falloff, the Simplex Noise
  parameters (scale *s*, octaves *K*, persistence *p*, lacunarity *λ*), seed,
  grid resolution (129 / 257 / 513 vertices), world size, maximum height and
  base thickness. The thumbnail updates live; **Generate terrain** rebuilds the
  3D terrain.
- **Textures:** height zones (drag the boundaries or use the arrow keys), blend
  width, and each zone's name, colour, texture (built-in or your own image) and
  tile size. Changes apply to the terrain right away. Save settings as presets,
  or export and import them as `.texturing.json` files.
- **Objects → Generated:** automatic placement per category (buildings, rocks,
  vegetation): minimum distance *r*<sub>min</sub>, terrain height range, steepest
  slope, density, size variation and models. **Place** next to a model adds it
  by clicking the terrain (Esc to stop).
- **Objects → Hand-placed:** objects added by hand, and **Add Object** for basic
  shapes, library models or your own OBJ / glTF / GLB files.
- **Editing in the 3D view:** click an object to select it.
  - **Delete** removes it; **Esc** clears the selection.
  - Hand-placed objects: **W** move, **E** rotate, **G** toggles *Stick to ground*
    (when off, the gizmo also moves the object up and down).
  - Generated objects: *Make editable* turns one into a hand-placed object.
  - Generated objects keep clear of hand-placed ones, and hand-placed objects
    survive regenerating the terrain or the placement.
- **Scene:** background colour, fog, and a performance overlay (frame rate,
  draw calls, triangles).
- **Export:** see below.

## Exporting for Unity

Choose what to include (terrain sides, generated objects, hand-placed objects),
then one of three formats. The desktop app asks where to save; in a browser the
files are downloaded.

| Format | Contents | In Unity |
|---|---|---|
| **GLB** (recommended) | Terrain with its texture and sides, all objects, in one file. Optional GPU instancing (`EXT_mesh_gpu_instancing`). | Install glTFast: *Window › Package Manager › + › Add package by name* › `com.unity.cloud.gltfast`, then drag the `.glb` into *Assets*. |
| **OBJ + MTL** | A folder with `world.obj`, `world.mtl` and the terrain texture. Large with many objects (no instancing). | Drag the folder into *Assets*; no packages needed. |
| **Unity Terrain data** | `heightmap.raw` (16-bit), `splatmap.png` (one zone per RGBA channel), `objects.json` and `README.txt`. | Build a native Terrain: follow the generated `README.txt`, which contains this terrain's import settings. |

Units are metres with Y up, as in Unity.

## Adding predefined models

1. Copy the model files (with their `.mtl` and textures) into `src/assets/predefined/`.
2. Add an entry to `src/assets/predefined/manifest.json`. Paths are relative to that folder:
   ```json
   {
     "id": "my-tree",
     "name": "My tree",
     "file": "myTree/tree.obj",
     "material": "myTree/tree.mtl",
     "category": "vegetation",
     "height": 6
   }
   ```
   - `material` is optional and only used for OBJ. Supported formats: `obj`, `gltf`, `glb`, `fbx`.
   - `category` (`buildings`, `rocks` or `vegetation`) makes the model available
     for automatic placement; `height` is the size in metres it is scaled to.
   - Optional: `color` replaces the model's materials, `warning` is shown next
     to it in the placement panel.

Everything in `src/assets/` is copied into the build, so keep source files
(`.blend`, renders, unused exports) in `asset-sources/` instead.

## Hosting the browser version

`npm run build` produces a static site in `dist/world-builder/browser`. Upload
it to any static web host; no server configuration is needed (the app uses
`#/` URLs). In a browser, saving and exporting download the files instead of
opening a save dialog.

## Other commands

```bash
npm run build                                   # production build -> dist/world-builder/browser
npm run watch                                   # development build, rebuilds on change
npm run benchmark                               # times the generation steps (see docs/performance.md)
npx ng test --watch=false --browsers=ChromeHeadless   # unit tests (needs Chrome)
```

## Project layout

```
app.js                       Electron main process: window, app:// protocol, save dialogs
preload.js                   Exposes file saving to the page (window.worldBuilderDesktop)
scripts/start-electron.js    Electron launcher used by the npm scripts
scripts/benchmark.mjs        Benchmark of the generation steps
docs/                        Performance measurements and figures
asset-sources/               Blender/FBX source files and renders (not bundled)
src/app/                     Root component, routes, app config
src/shared/generation/       Pure TypeScript: noise, heightmap, texturing, Poisson Disk
                             Sampling, placement, export encoders, Web Worker
src/shared/services/         Scene, terrain mesh, texturing, placement, selection,
                             objects, asset library, export, file saving
src/shared/components/       Side-menu panels, 3D view, selection bar, dialogs
src/assets/predefined/       Model library + manifest.json
```
