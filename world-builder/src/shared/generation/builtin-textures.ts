import { createNoise4D, NoiseFunction4D } from 'simplex-noise';
import { BuiltinTextureId } from './config';
import { mulberry32 } from './rng';
import { ImageDataLike } from './texturing';

export const BUILTIN_TEXTURE_LABELS: Record<BuiltinTextureId, string> = {
  sand: 'Sand grain',
  grass: 'Grass',
  dirt: 'Dirt',
  rock: 'Rock',
  snow: 'Snow',
};

const SEEDS: Record<BuiltinTextureId, number> = {
  sand: 11,
  grass: 23,
  dirt: 37,
  rock: 41,
  snow: 53,
};

// Generates a seamless grayscale detail texture (brightness around 0.9) that
// is multiplied by the zone colour. No image files are needed, so the
// built-in presets carry no licensing questions.
export function generateBuiltinTexture(
  id: BuiltinTextureId,
  size = 256
): ImageDataLike {
  const random = mulberry32(SEEDS[id]);
  const noise = createNoise4D(random);
  const data = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const value = Math.min(Math.max(brightness(id, noise, u, v, random()), 0), 1);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value * 255;
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

// Noise that repeats exactly once per texture: the 2D texture coordinates
// are mapped onto two circles in 4D. `features` = blobs per texture side.
function tileable(noise: NoiseFunction4D, u: number, v: number, features: number): number {
  const radius = features / (2 * Math.PI);
  const a = 2 * Math.PI * u;
  const b = 2 * Math.PI * v;
  return noise(
    Math.cos(a) * radius,
    Math.sin(a) * radius,
    Math.cos(b) * radius,
    Math.sin(b) * radius
  );
}

function brightness(
  id: BuiltinTextureId,
  noise: NoiseFunction4D,
  u: number,
  v: number,
  grain: number
): number {
  switch (id) {
    case 'sand':
      return 0.9 + 0.04 * tileable(noise, u, v, 3) + 0.03 * tileable(noise, u, v, 12) + 0.08 * (grain - 0.5);
    case 'grass':
      return (
        0.86 +
        0.08 * tileable(noise, u, v, 4) +
        0.06 * tileable(noise, u, v, 16) +
        0.07 * tileable(noise, u, v, 48) +
        0.06 * (grain - 0.5)
      );
    case 'dirt':
      return (
        0.84 +
        0.08 * tileable(noise, u, v, 5) +
        0.05 * tileable(noise, u, v, 20) +
        (grain > 0.97 ? 0.12 : 0) +
        0.06 * (grain - 0.5)
      );
    case 'rock': {
      // Ridged noise gives crack-like lines.
      const ridges = 1 - Math.abs(tileable(noise, u, v, 4));
      const detail = 1 - Math.abs(tileable(noise, u, v, 12));
      return 0.6 + 0.22 * ridges + 0.12 * detail + 0.05 * (grain - 0.5);
    }
    case 'snow':
      return 0.95 + 0.03 * tileable(noise, u, v, 3) + 0.02 * (grain - 0.5);
  }
}
