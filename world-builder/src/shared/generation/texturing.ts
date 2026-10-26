import { TexturingConfig } from './config';
import { Heightmap, sampleHeightmap } from './heightmap';

// Minimal ImageData shape, so baking also runs in a worker and in tests.
export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

export type ZoneWeights = [number, number, number, number];

// Weights of the four zones at normalised height h (section 3.2).
// Around each threshold T the two neighbouring zones blend linearly across
// a band of width w: t = clamp((h - (T - w/2)) / w, 0, 1) gives the upper
// zone weight t and the lower zone weight 1 - t. The weights always sum to 1.
export function zoneWeights(
  h: number,
  thresholds: readonly [number, number, number],
  blendWidth: number
): ZoneWeights {
  const t = thresholds.map((threshold) => {
    if (blendWidth <= 0) return h >= threshold ? 1 : 0;
    const value = (h - (threshold - blendWidth / 2)) / blendWidth;
    return Math.min(Math.max(value, 0), 1);
  });
  return [
    1 - t[0],
    t[0] * (1 - t[1]),
    t[0] * t[1] * (1 - t[2]),
    t[0] * t[1] * t[2],
  ];
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Bakes the terrain's colour texture: each pixel mixes the zone textures by
// zoneWeights. `zoneTextures` are already tinted and scaled so one repeat
// spans `tileSize` metres in baked pixels; they wrap around.
// Output row r corresponds to heightmap row r (+Z), column c to +X.
export function bakeAlbedo(
  map: Heightmap,
  texturing: Pick<TexturingConfig, 'thresholds' | 'blendWidth'>,
  zoneTextures: ImageDataLike[],
  size: number
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let row = 0; row < size; row++) {
    const v = (row + 0.5) / size;
    for (let col = 0; col < size; col++) {
      const u = (col + 0.5) / size;
      const h = sampleHeightmap(map, u, v);
      const weights = zoneWeights(h, texturing.thresholds, texturing.blendWidth);

      let r = 0;
      let g = 0;
      let b = 0;
      for (let zone = 0; zone < 4; zone++) {
        const weight = weights[zone];
        if (weight === 0) continue;
        const texture = zoneTextures[zone];
        const i =
          ((row % texture.height) * texture.width + (col % texture.width)) * 4;
        r += weight * texture.data[i];
        g += weight * texture.data[i + 1];
        b += weight * texture.data[i + 2];
      }

      const o = (row * size + col) * 4;
      pixels[o] = r;
      pixels[o + 1] = g;
      pixels[o + 2] = b;
      pixels[o + 3] = 255;
    }
  }
  return pixels;
}
