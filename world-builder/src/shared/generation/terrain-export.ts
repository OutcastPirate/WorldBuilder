import { PlacementCategoryId, TerrainConfig, TexturingConfig } from './config';
import { Heightmap } from './heightmap';
import { zoneWeights } from './texturing';

// Data for building the world as a native Unity Terrain: a 16-bit RAW
// heightmap, a splatmap with one channel per texture zone, and the objects'
// positions. Coordinates are terrain-local: (0, 0) is the corner at the
// heightmap's first row and column (world -X, -Z), x runs along columns and
// z along rows, matching the order of the RAW samples.

// Heightmap as unsigned 16-bit little-endian samples, row by row ("Windows"
// byte order in Unity's Import Raw dialog). 0 = height 0, 65535 = full height.
export function encodeRaw16(map: Heightmap): Uint8Array {
  const bytes = new Uint8Array(map.data.length * 2);
  const view = new DataView(bytes.buffer);
  map.data.forEach((h, i) => {
    view.setUint16(i * 2, Math.round(Math.min(Math.max(h, 0), 1) * 65535), true);
  });
  return bytes;
}

// Splatmap pixels (RGBA, map.size × map.size): red = zone 0 (sand),
// green = zone 1 (grass), blue = zone 2 (earth/rock), alpha = zone 3 (snow).
// The four weights of every pixel add up to 255. Row 0 is heightmap row 0.
export function encodeSplatmap(map: Heightmap, texturing: TexturingConfig): Uint8Array {
  const pixels = new Uint8Array(map.data.length * 4);
  map.data.forEach((h, i) => {
    const weights = zoneWeights(h, texturing.thresholds, texturing.blendWidth);
    // Round, then give any rounding remainder to the largest weight.
    const bytes = weights.map((w) => Math.round(w * 255));
    const largest = weights.indexOf(Math.max(...weights));
    bytes[largest] += 255 - bytes.reduce((a, b) => a + b, 0);
    pixels.set(bytes, i * 4);
  });
  return pixels;
}

export interface ExportedObject {
  name: string;
  assetId?: string;
  category?: PlacementCategoryId;
  source: 'generated' | 'hand-placed';
  position: [number, number, number]; // terrain-local metres
  rotationY: number; // degrees
  scale: number;
}

export interface TerrainDataFile {
  format: 'world-builder-terrain';
  version: 1;
  terrain: {
    shape: TerrainConfig['shape'];
    resolution: number;
    size: number;
    height: number;
    seed: number;
  };
  layers: { name: string; color: string; channel: 'r' | 'g' | 'b' | 'a' }[];
  objects: ExportedObject[];
}

export function terrainDataJson(
  terrain: TerrainConfig,
  texturing: TexturingConfig,
  objects: ExportedObject[]
): string {
  const channels = ['r', 'g', 'b', 'a'] as const;
  const file: TerrainDataFile = {
    format: 'world-builder-terrain',
    version: 1,
    terrain: {
      shape: terrain.shape,
      resolution: terrain.resolution,
      size: terrain.worldSize,
      height: terrain.heightScale,
      seed: terrain.seed,
    },
    layers: texturing.zones.map((zone, i) => ({ name: zone.name, color: zone.color, channel: channels[i] })),
    objects,
  };
  return JSON.stringify(file, null, 2);
}

// Converts a world position (terrain centred on the origin) to
// terrain-local coordinates.
export function toTerrainLocal(
  worldSize: number,
  x: number,
  y: number,
  z: number
): [number, number, number] {
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return [round(x + worldSize / 2), round(y), round(z + worldSize / 2)];
}

// Step-by-step import instructions with this terrain's numbers filled in.
export function unityReadme(terrain: TerrainConfig, texturing: TexturingConfig): string {
  const zones = texturing.zones.map((z, i) => `  ${'RGBA'[i]}: ${z.name} (${z.color})`).join('\n');
  return `World Builder – Unity terrain data
==================================

Files
  heightmap.raw   ${terrain.resolution} x ${terrain.resolution} samples, 16-bit unsigned, little-endian
  splatmap.png    ${terrain.resolution} x ${terrain.resolution} RGBA, one texture layer per channel:
${zones}
  objects.json    positions of all objects (terrain-local metres, rotation in degrees)

Terrain
  Size:   ${terrain.worldSize} x ${terrain.worldSize} m
  Height: ${terrain.heightScale} m
  Shape:  ${terrain.shape === 'circle' ? 'island (circle) - heights outside the circle are not used' : 'square'}

1. Heightmap
   GameObject > 3D Object > Terrain. In the Terrain's settings (gear icon):
   - Mesh Resolution: Terrain Width ${terrain.worldSize}, Terrain Length ${terrain.worldSize}, Terrain Height ${terrain.heightScale}
   - Texture Resolutions: Heightmap Resolution ${terrain.resolution}
   - Import Raw...: choose heightmap.raw, Depth: Bit 16, Resolution ${terrain.resolution},
     Byte Order: Windows, Terrain Size ${terrain.worldSize} x ${terrain.heightScale} x ${terrain.worldSize}.
   If the terrain appears mirrored compared with World Builder, import again with Flip Vertically.

2. Texture layers
   Create four Terrain Layers in the order R, G, B, A above, then import splatmap.png
   as the terrain's alphamap (for example with the Terrain Tools package:
   Window > Terrain > Terrain Toolbox > Import Splatmaps).

3. Objects
   objects.json lists every object with its model name, position, rotation and scale.
   Positions are relative to the terrain's corner, so add the Terrain object's
   position when placing prefabs.

Simpler alternative: export a GLB from World Builder and import it with Unity's
glTFast package; it contains the terrain, its texture and all objects.
`;
}
