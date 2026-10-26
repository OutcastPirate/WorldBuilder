// Generation parameters. This folder is plain TypeScript (no Angular, no
// Three.js) so it can be unit tested and run inside a Web Worker.

export const TERRAIN_RESOLUTIONS = [129, 257, 513] as const;
// Vertices per side. 2^n + 1 matches the RAW heightmap sizes Unity imports.
export type TerrainResolution = (typeof TERRAIN_RESOLUTIONS)[number];

// Parameters of the article's equation (1).
export interface NoiseParams {
  scale: number; // s, in terrain vertices
  octaves: number; // K
  persistence: number; // p
  lacunarity: number; // λ
}

// Outline of the map: a square, or a circle (an island) inscribed in it.
export type TerrainShape = 'square' | 'circle';

export interface TerrainConfig extends NoiseParams {
  seed: number;
  resolution: TerrainResolution;
  worldSize: number; // metres per side (circle diameter)
  heightScale: number; // metres at normalised height 1
  shape: TerrainShape;
  // 0–1: share of the radius over which the terrain slopes down to height 0
  // at the border (0 = no falloff, cliffs at the edge).
  edgeFalloff: number;
  baseThickness: number; // metres of ground shown below height 0 at the sides
}

export const BUILTIN_TEXTURE_IDS = ['sand', 'grass', 'dirt', 'rock', 'snow'] as const;
export type BuiltinTextureId = (typeof BUILTIN_TEXTURE_IDS)[number];

// Procedural texture generated at runtime, or an image the user uploaded
// (stored as a downscaled data URL so presets are self-contained).
export type ZoneTexture =
  | { type: 'builtin'; id: BuiltinTextureId }
  | { type: 'image'; name: string; dataUrl: string };

export interface ZoneMaterial {
  name: string;
  color: string; // #rrggbb; multiplies the texture
  texture: ZoneTexture | null;
  tileSize: number; // metres covered by one texture repeat
}

export interface TexturingConfig {
  // Normalised heights between zones 0|1, 1|2 and 2|3 (Table 2).
  thresholds: [number, number, number];
  // Width of the linear blend band centred on each threshold (0 = hard edge).
  blendWidth: number;
  // Zones from lowest to highest.
  zones: [ZoneMaterial, ZoneMaterial, ZoneMaterial, ZoneMaterial];
}

export const PLACEMENT_CATEGORY_IDS = ['buildings', 'rocks', 'vegetation'] as const;
export type PlacementCategoryId = (typeof PLACEMENT_CATEGORY_IDS)[number];

// One category of environment objects (section 3.3).
export interface PlacementCategoryConfig {
  id: PlacementCategoryId;
  name: string;
  enabled: boolean;
  assetIds: string[]; // models picked at random for each point
  rMin: number; // minimum distance between objects, metres
  heightRange: [number, number]; // allowed normalised terrain height
  maxSlope: number; // degrees; steeper ground is skipped
  density: number; // 0–1, share of valid points that get an object
  scaleVariation: number; // 0–0.5, random size change of ± this share
}

export interface PlacementConfig {
  seed: number;
  // Placed in this order; each category keeps its distance from the earlier ones.
  categories: PlacementCategoryConfig[];
}

export interface GenerationConfig {
  terrain: TerrainConfig;
  texturing: TexturingConfig;
  placement: PlacementConfig;
}

export interface ParamRange {
  min: number;
  max: number;
  step: number;
}

// Typical ranges from Table 1 of the article.
export const NOISE_PARAM_RANGES: Record<keyof NoiseParams, ParamRange> = {
  scale: { min: 50, max: 500, step: 1 },
  octaves: { min: 1, max: 8, step: 1 },
  persistence: { min: 0.2, max: 0.8, step: 0.01 },
  lacunarity: { min: 1.5, max: 3.0, step: 0.05 },
};

export const WORLD_SIZE_RANGE: ParamRange = { min: 32, max: 1024, step: 1 };
export const HEIGHT_SCALE_RANGE: ParamRange = { min: 1, max: 200, step: 1 };
export const EDGE_FALLOFF_RANGE: ParamRange = { min: 0, max: 1, step: 0.01 };
export const BASE_THICKNESS_RANGE: ParamRange = { min: 0.5, max: 50, step: 0.5 };
// Falloff applied when switching to an island while falloff is off.
export const DEFAULT_ISLAND_FALLOFF = 0.35;

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  seed: 1234,
  resolution: 257,
  worldSize: 128,
  heightScale: 24,
  scale: 160,
  octaves: 5,
  persistence: 0.5,
  lacunarity: 2.0,
  shape: 'square',
  edgeFalloff: 0,
  baseThickness: 6,
};

export const BLEND_WIDTH_RANGE: ParamRange = { min: 0, max: 0.2, step: 0.005 };
export const TILE_SIZE_RANGE: ParamRange = { min: 0.5, max: 50, step: 0.5 };

// Table 2 of the article: sand, grass, earth/rock, snow/rock.
export const DEFAULT_TEXTURING_CONFIG: TexturingConfig = {
  thresholds: [0.2, 0.55, 0.8],
  blendWidth: 0.05,
  zones: [
    { name: 'Sand', color: '#d8c088', texture: { type: 'builtin', id: 'sand' }, tileSize: 3 },
    { name: 'Grass', color: '#7fa65a', texture: { type: 'builtin', id: 'grass' }, tileSize: 4 },
    { name: 'Earth / rock', color: '#9c7a5a', texture: { type: 'builtin', id: 'rock' }, tileSize: 6 },
    { name: 'Snow', color: '#eef2f3', texture: { type: 'builtin', id: 'snow' }, tileSize: 8 },
  ],
};

export const R_MIN_RANGE: ParamRange = { min: 0.5, max: 40, step: 0.5 };
export const MAX_SLOPE_RANGE: ParamRange = { min: 0, max: 90, step: 1 };

export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
  seed: 1,
  categories: [
    {
      id: 'buildings',
      name: 'Buildings',
      enabled: true,
      assetIds: ['procedural:house', 'procedural:hut', 'pillar'],
      rMin: 18,
      heightRange: [0.2, 0.55],
      maxSlope: 15,
      density: 0.3,
      scaleVariation: 0.1,
    },
    {
      id: 'rocks',
      name: 'Rocks',
      enabled: true,
      assetIds: ['procedural:rock', 'procedural:boulder', 'untitled'],
      rMin: 5,
      heightRange: [0.45, 1],
      maxSlope: 60,
      density: 0.5,
      scaleVariation: 0.4,
    },
    {
      // Not on sand or snow, as in the article's example.
      id: 'vegetation',
      name: 'Vegetation',
      enabled: true,
      assetIds: ['lowpoly-tree', 'dead-tree', 'bush'],
      rMin: 3,
      heightRange: [0.2, 0.8],
      maxSlope: 35,
      density: 1,
      scaleVariation: 0.25,
    },
  ],
};
