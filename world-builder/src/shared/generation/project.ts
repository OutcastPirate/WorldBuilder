import {
  GenerationConfig,
  PLACEMENT_CATEGORY_IDS,
  PlacementCategoryConfig,
  PlacementCategoryId,
  PlacementConfig,
  TERRAIN_RESOLUTIONS,
  TerrainConfig,
  TerrainResolution,
  TerrainShape,
} from './config';
import { parseTexturingConfig } from './texturing-presets';

// A saved world: every generation setting plus what the user did by hand.
// Imported model files are embedded (base64) so a project is one file.

export const PROJECT_FORMAT = 'world-builder-project';
export const PROJECT_VERSION = 1;

export type Vector3Tuple = [number, number, number];

export interface SavedTransform {
  position: Vector3Tuple;
  rotation: Vector3Tuple; // Euler XYZ, radians
  scale: Vector3Tuple;
}

export interface EmbeddedFile {
  name: string;
  data: string; // base64
}

export type SavedOrigin =
  | { kind: 'library'; assetId: string }
  | { kind: 'predefined'; id: string }
  | { kind: 'shape'; shape: 'Cube' | 'Sphere' | 'Cylinder' | 'Cone'; height: number; width: number }
  | { kind: 'file'; file: EmbeddedFile; material?: EmbeddedFile };

export interface SavedObject {
  name: string;
  origin: SavedOrigin;
  transform: SavedTransform;
  snapToGround: boolean;
  color?: string; // basic shapes
}

export interface SavedUpload {
  id: string;
  name: string;
  category: PlacementCategoryId;
  height: number;
  file: EmbeddedFile;
  material?: EmbeddedFile;
}

export interface SavedScene {
  background: string;
  fog: { color: string; density: number } | null;
}

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  savedAt: string;
  config: GenerationConfig;
  // Generated objects the user deleted (model and position keys).
  removedGenerated: string[];
  uploads: SavedUpload[];
  objects: SavedObject[];
  scene: SavedScene;
}

// Validates an opened project file. Throws an Error with a readable message
// when it isn't a World Builder project or a value is out of range.
export function parseProject(value: unknown): ProjectFile {
  const file = object(value, 'The file');
  if (file['format'] !== PROJECT_FORMAT) throw new Error('This is not a World Builder project file.');
  if (file['version'] !== PROJECT_VERSION) {
    throw new Error(`Project version ${String(file['version'])} is not supported by this version of World Builder.`);
  }

  const config = object(file['config'], 'Project settings');
  const texturing = parseTexturingConfig(config['texturing']);
  if (!texturing) throw new Error('The texturing settings in the project are invalid.');

  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: typeof file['savedAt'] === 'string' ? file['savedAt'] : '',
    config: {
      terrain: parseTerrain(config['terrain']),
      texturing,
      placement: parsePlacement(config['placement']),
    },
    removedGenerated: array(file['removedGenerated'] ?? [], 'Removed objects').filter(
      (k): k is string => typeof k === 'string'
    ),
    uploads: array(file['uploads'] ?? [], 'Uploaded models').map(parseUpload),
    objects: array(file['objects'] ?? [], 'Objects').map(parseObject),
    scene: parseScene(file['scene']),
  };
}

export function parseTerrain(value: unknown): TerrainConfig {
  const t = object(value, 'Terrain settings');
  const resolution = t['resolution'];
  if (!TERRAIN_RESOLUTIONS.includes(resolution as TerrainResolution)) {
    throw new Error(`Unsupported terrain resolution: ${String(resolution)}.`);
  }
  const shape = t['shape'] ?? 'square';
  if (shape !== 'square' && shape !== 'circle') throw new Error(`Unknown map shape: ${String(shape)}.`);
  // Key order matches DEFAULT_TERRAIN_CONFIG.
  return {
    seed: integer(t['seed'], 'seed'),
    resolution: resolution as TerrainResolution,
    worldSize: num(t['worldSize'], 'world size', 1, 100000),
    heightScale: num(t['heightScale'], 'height', 0.1, 100000),
    scale: num(t['scale'], 'scale', 1, 100000),
    octaves: integer(t['octaves'], 'octaves', 1, 16),
    persistence: num(t['persistence'], 'persistence', 0, 1),
    lacunarity: num(t['lacunarity'], 'lacunarity', 1, 10),
    shape: shape as TerrainShape,
    edgeFalloff: num(t['edgeFalloff'] ?? 0, 'edge falloff', 0, 1),
    baseThickness: num(t['baseThickness'] ?? 6, 'base thickness', 0, 1000),
  };
}

export function parsePlacement(value: unknown): PlacementConfig {
  const p = object(value, 'Placement settings');
  const categories = array(p['categories'], 'Placement categories').map((c): PlacementCategoryConfig => {
    const category = object(c, 'Placement category');
    const id = category['id'];
    if (!PLACEMENT_CATEGORY_IDS.includes(id as PlacementCategoryId)) {
      throw new Error(`Unknown placement category: ${String(id)}.`);
    }
    const range = array(category['heightRange'], 'height range');
    if (range.length !== 2) throw new Error('A height range needs two values.');
    return {
      id: id as PlacementCategoryId,
      name: text(category['name'], 'category name'),
      enabled: Boolean(category['enabled']),
      assetIds: array(category['assetIds'], 'models').filter((a): a is string => typeof a === 'string'),
      rMin: num(category['rMin'], 'minimum distance', 0.01, 10000),
      heightRange: [num(range[0], 'height range', 0, 1), num(range[1], 'height range', 0, 1)],
      maxSlope: num(category['maxSlope'], 'slope', 0, 90),
      density: num(category['density'], 'density', 0, 1),
      scaleVariation: num(category['scaleVariation'], 'size variation', 0, 1),
    };
  });
  return { seed: integer(p['seed'], 'placement seed'), categories };
}

function parseUpload(value: unknown): SavedUpload {
  const u = object(value, 'Uploaded model');
  const category = u['category'];
  if (!PLACEMENT_CATEGORY_IDS.includes(category as PlacementCategoryId)) {
    throw new Error(`Unknown category for an uploaded model: ${String(category)}.`);
  }
  return {
    id: text(u['id'], 'model id'),
    name: text(u['name'], 'model name'),
    category: category as PlacementCategoryId,
    height: num(u['height'], 'model height', 0.01, 10000),
    file: parseEmbedded(u['file']),
    ...(u['material'] === undefined ? {} : { material: parseEmbedded(u['material']) }),
  };
}

function parseObject(value: unknown): SavedObject {
  const o = object(value, 'Object');
  const origin = object(o['origin'], 'Object origin');
  let parsedOrigin: SavedOrigin;
  switch (origin['kind']) {
    case 'library':
      parsedOrigin = { kind: 'library', assetId: text(origin['assetId'], 'model id') };
      break;
    case 'predefined':
      parsedOrigin = { kind: 'predefined', id: text(origin['id'], 'model id') };
      break;
    case 'shape': {
      const shape = origin['shape'];
      if (shape !== 'Cube' && shape !== 'Sphere' && shape !== 'Cylinder' && shape !== 'Cone') {
        throw new Error(`Unknown shape: ${String(shape)}.`);
      }
      parsedOrigin = {
        kind: 'shape',
        shape,
        height: num(origin['height'], 'shape height', 0.001, 10000),
        width: num(origin['width'], 'shape width', 0.001, 10000),
      };
      break;
    }
    case 'file':
      parsedOrigin = {
        kind: 'file',
        file: parseEmbedded(origin['file']),
        ...(origin['material'] === undefined ? {} : { material: parseEmbedded(origin['material']) }),
      };
      break;
    default:
      throw new Error(`Unknown object origin: ${String(origin['kind'])}.`);
  }
  const transform = object(o['transform'], 'Object transform');
  return {
    name: text(o['name'], 'object name').slice(0, 100),
    origin: parsedOrigin,
    transform: {
      position: vector(transform['position'], 'position'),
      rotation: vector(transform['rotation'], 'rotation'),
      scale: vector(transform['scale'], 'scale'),
    },
    snapToGround: o['snapToGround'] !== false,
    ...(color(o['color']) ? { color: color(o['color'])! } : {}),
  };
}

function parseScene(value: unknown): SavedScene {
  if (value === undefined) return { background: '#202020', fog: null };
  const s = object(value, 'Scene settings');
  const fog = s['fog'] === null || s['fog'] === undefined ? null : object(s['fog'], 'Fog');
  return {
    background: color(s['background']) ?? '#202020',
    fog: fog ? { color: color(fog['color']) ?? '#cccccc', density: num(fog['density'], 'fog density', 0, 10) } : null,
  };
}

function parseEmbedded(value: unknown): EmbeddedFile {
  const f = object(value, 'Embedded file');
  const data = text(f['data'], 'file data');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error('An embedded file is damaged.');
  return { name: text(f['name'], 'file name').replace(/[\\/]/g, '_'), data };
}

// ---- small validators ----

function object(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} is missing or invalid.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is missing or invalid.`);
  return value;
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`The ${what} is missing.`);
  return value;
}

function num(value: unknown, what: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`The ${what} (${String(value)}) is out of range.`);
  }
  return value;
}

function integer(value: unknown, what: string, min = -Infinity, max = Infinity): number {
  const n = num(value, what, min, max);
  if (!Number.isInteger(n)) throw new Error(`The ${what} must be a whole number.`);
  return n;
}

function vector(value: unknown, what: string): Vector3Tuple {
  const v = array(value, what);
  if (v.length !== 3) throw new Error(`The ${what} needs three values.`);
  return [num(v[0], what), num(v[1], what), num(v[2], what)];
}

function color(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}
