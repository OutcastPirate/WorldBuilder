import {
  BUILTIN_TEXTURE_IDS,
  BuiltinTextureId,
  DEFAULT_TEXTURING_CONFIG,
  TexturingConfig,
  ZoneMaterial,
  ZoneTexture,
} from './config';

export interface TexturingPreset {
  id: string;
  name: string;
  builtIn: boolean;
  texturing: TexturingConfig;
}

// Shape of an exported preset file.
export const PRESET_FILE_FORMAT = 'world-builder-texturing-preset';
export interface TexturingPresetFile {
  format: typeof PRESET_FILE_FORMAT;
  version: 1;
  name: string;
  texturing: TexturingConfig;
}

const zone = (
  name: string,
  color: string,
  texture: ZoneMaterial['texture'],
  tileSize: number
): ZoneMaterial => ({ name, color, texture, tileSize });

export const BUILT_IN_PRESETS: TexturingPreset[] = [
  {
    id: 'builtin-temperate',
    name: 'Temperate (Table 2)',
    builtIn: true,
    texturing: DEFAULT_TEXTURING_CONFIG,
  },
  {
    id: 'builtin-alpine',
    name: 'Alpine',
    builtIn: true,
    texturing: {
      thresholds: [0.1, 0.42, 0.65],
      blendWidth: 0.06,
      zones: [
        zone('Gravel', '#9d9682', { type: 'builtin', id: 'dirt' }, 2),
        zone('Meadow', '#6f8f4e', { type: 'builtin', id: 'grass' }, 4),
        zone('Rock', '#7d756c', { type: 'builtin', id: 'rock' }, 8),
        zone('Snow', '#f2f5f7', { type: 'builtin', id: 'snow' }, 10),
      ],
    },
  },
  {
    id: 'builtin-desert',
    name: 'Desert',
    builtIn: true,
    texturing: {
      thresholds: [0.35, 0.62, 0.85],
      blendWidth: 0.08,
      zones: [
        zone('Sand', '#e3c48a', { type: 'builtin', id: 'sand' }, 3),
        zone('Dunes', '#d2a86a', { type: 'builtin', id: 'sand' }, 5),
        zone('Sandstone', '#b5774c', { type: 'builtin', id: 'rock' }, 8),
        zone('Dark rock', '#8a6a55', { type: 'builtin', id: 'rock' }, 10),
      ],
    },
  },
];

// Validates untrusted JSON (an imported file or stored data) and returns a
// clean TexturingConfig, or null when it doesn't have the expected shape.
export function parseTexturingConfig(value: unknown): TexturingConfig | null {
  if (!isObject(value)) return null;
  const { thresholds, blendWidth, zones } = value;
  if (
    !Array.isArray(thresholds) ||
    thresholds.length !== 3 ||
    !thresholds.every((t, i) => isUnit(t) && (i === 0 || t >= thresholds[i - 1]))
  ) {
    return null;
  }
  if (typeof blendWidth !== 'number' || blendWidth < 0 || blendWidth > 1) return null;
  if (!Array.isArray(zones) || zones.length !== 4) return null;

  const parsedZones = zones.map(parseZone);
  if (parsedZones.some((z) => z === null)) return null;

  return {
    thresholds: [thresholds[0], thresholds[1], thresholds[2]],
    blendWidth,
    zones: parsedZones as TexturingConfig['zones'],
  };
}

function parseZone(value: unknown): ZoneMaterial | null {
  if (!isObject(value)) return null;
  const { name, color, texture, tileSize } = value;
  if (typeof name !== 'string' || !/^#[0-9a-f]{6}$/i.test(String(color))) return null;
  if (typeof tileSize !== 'number' || tileSize <= 0) return null;
  const parsedTexture = parseTexture(texture);
  if (parsedTexture === undefined) return null;
  return { name: name.slice(0, 40), color: String(color), texture: parsedTexture, tileSize };
}

// null = no texture, undefined = invalid.
function parseTexture(value: unknown): ZoneTexture | null | undefined {
  if (value === null) return null;
  if (!isObject(value)) return undefined;
  if (value['type'] === 'builtin') {
    const id = value['id'];
    return isBuiltinTextureId(id) ? { type: 'builtin', id } : undefined;
  }
  if (
    value['type'] === 'image' &&
    typeof value['name'] === 'string' &&
    typeof value['dataUrl'] === 'string' &&
    /^data:image\/(png|jpeg|webp);base64,/.test(value['dataUrl'])
  ) {
    return { type: 'image', name: value['name'], dataUrl: value['dataUrl'] };
  }
  return undefined;
}

function isBuiltinTextureId(value: unknown): value is BuiltinTextureId {
  return BUILTIN_TEXTURE_IDS.some((id) => id === value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnit(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
