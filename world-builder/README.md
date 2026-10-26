# World Builder

A desktop 3D scene editor built with Angular 17, Three.js and Electron.
Add basic shapes or 3D models (OBJ/MTL, GLTF/GLB) to a terrain, then move,
rotate, scale, recolour and snap them to the ground. You can also change the
scene background and fog.

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

- **3D view (left)**
  - Left-drag to orbit, right-drag to pan, scroll to zoom.
  - *Stop rotation* / *Rotate* switches the camera's auto-rotation off and on.
  - *Reset Rotation* puts the camera back where it started.
- **Scene Menu**: background colour, add or remove fog, fog density and colour.
- **Objects Menu → Add Object**
  - *Basic*: cube, sphere, cylinder or cone with a height, width and colour.
    Height is along the vertical (Y) axis.
  - *Predefined*: models listed in `src/assets/predefined/manifest.json`.
  - *Custom*: a `.obj` file (optionally with its `.mtl`), a `.glb`, or a
    `.gltf` with its data embedded. Textures and `.bin` files that a model
    refers to cannot be picked together with it. To use such a model, add it
    to the predefined library instead.
- **Each object**:
  - Edit its name and colour (basic shapes).
  - *Show details* lets you edit position, scale (optionally keeping the
    ratio) and rotation (radians).
  - *Snap down* drops the object onto the surface below it.
  - *Delete object* removes it.

## Adding predefined models

1. Copy the model files (with their `.mtl` and textures) into `src/assets/predefined/`.
2. Add an entry to `src/assets/predefined/manifest.json`. Paths are relative to that folder:
   ```json
   { "name": "My model", "file": "myModel/model.obj", "material": "myModel/model.mtl" }
   ```
   `material` is optional and only used for OBJ. Supported formats: `obj`, `gltf`, `glb`, `fbx`.

Everything in `src/assets/` is copied into the build, so keep source files
(`.blend`, renders, unused exports) in `asset-sources/` instead.

## Other commands

```bash
npm run build                                   # production build -> dist/world-builder/browser
npm run watch                                   # development build, rebuilds on change
npx ng test --watch=false --browsers=ChromeHeadless   # unit tests (needs Chrome)
```

## Project layout

```
app.js                       Electron main process (dev: localhost:4200, prod: app:// protocol over dist/)
scripts/start-electron.js    Electron launcher used by the npm scripts
asset-sources/               Blender/FBX source files and renders (not bundled)
src/app/                     Root component, routes, app config
src/shared/views/            Main layout (3D view + side menu)
src/shared/components/       Terrain window, options/scene/objects menus, add-object dialog
src/shared/services/         Scene (renderer, camera, controls), objects, loaders, shapes, raycasting
src/assets/predefined/       Predefined model library + manifest.json
```
