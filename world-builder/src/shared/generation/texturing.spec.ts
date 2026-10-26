import { generateBuiltinTexture } from './builtin-textures';
import { BUILTIN_TEXTURE_IDS, DEFAULT_TEXTURING_CONFIG } from './config';
import { Heightmap } from './heightmap';
import { bakeAlbedo, hexToRgb, ImageDataLike, zoneWeights } from './texturing';
import { BUILT_IN_PRESETS, parseTexturingConfig } from './texturing-presets';

const thresholds: [number, number, number] = [0.2, 0.55, 0.8];

const solid = (r: number, g: number, b: number): ImageDataLike => ({
  width: 1,
  height: 1,
  data: new Uint8ClampedArray([r, g, b, 255]),
});

describe('zoneWeights', () => {
  it('sums to 1 for every height and blend width', () => {
    for (const blend of [0, 0.05, 0.2, 0.5]) {
      for (let h = 0; h <= 1; h += 0.01) {
        const sum = zoneWeights(h, thresholds, blend).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 10);
      }
    }
  });

  it('picks exactly one zone per Table 2 range when blending is off', () => {
    expect(zoneWeights(0.1, thresholds, 0)).toEqual([1, 0, 0, 0]);
    expect(zoneWeights(0.3, thresholds, 0)).toEqual([0, 1, 0, 0]);
    expect(zoneWeights(0.7, thresholds, 0)).toEqual([0, 0, 1, 0]);
    expect(zoneWeights(0.9, thresholds, 0)).toEqual([0, 0, 0, 1]);
  });

  it('blends the two neighbouring zones linearly across the band', () => {
    // Band around 0.55 with width 0.1 runs from 0.50 to 0.60.
    expect(zoneWeights(0.5, thresholds, 0.1)[1]).toBeCloseTo(1);
    const middle = zoneWeights(0.55, thresholds, 0.1);
    expect(middle[1]).toBeCloseTo(0.5);
    expect(middle[2]).toBeCloseTo(0.5);
    const quarter = zoneWeights(0.575, thresholds, 0.1);
    expect(quarter[1]).toBeCloseTo(0.25);
    expect(quarter[2]).toBeCloseTo(0.75);
  });
});

describe('hexToRgb', () => {
  it('parses #rrggbb', () => {
    expect(hexToRgb('#d8c088')).toEqual([216, 192, 136]);
  });
});

describe('bakeAlbedo', () => {
  // 2 × 2 heightmap: low row at -Z, high row at +Z.
  const map: Heightmap = { size: 2, data: new Float32Array([0, 0, 1, 1]) };
  const textures = [solid(255, 0, 0), solid(0, 255, 0), solid(0, 0, 255), solid(255, 255, 255)];

  it('colours low ground with the lowest zone and peaks with the highest', () => {
    const size = 8;
    const pixels = bakeAlbedo(map, { thresholds, blendWidth: 0 }, textures, size);
    const pixel = (row: number) => Array.from(pixels.slice(row * size * 4, row * size * 4 + 3));
    expect(pixel(0)).toEqual([255, 0, 0]);
    expect(pixel(size - 1)).toEqual([255, 255, 255]);
  });

  it('repeats a zone texture across the bake', () => {
    const checker: ImageDataLike = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 255, 200, 200, 200, 255]),
    };
    const flat: Heightmap = { size: 2, data: new Float32Array(4) };
    const pixels = bakeAlbedo(flat, { thresholds, blendWidth: 0 }, [checker, ...textures.slice(1)], 4);
    expect([pixels[0], pixels[4], pixels[8], pixels[12]]).toEqual([0, 200, 0, 200]);
  });
});

describe('generateBuiltinTexture', () => {
  it('tiles seamlessly', () => {
    for (const id of BUILTIN_TEXTURE_IDS) {
      const texture = generateBuiltinTexture(id, 64);
      // The step across the wrap-around edge should be no larger than steps
      // inside the texture (allowing for the per-pixel grain).
      let edge = 0;
      let inner = 0;
      for (let y = 0; y < 64; y++) {
        const at = (x: number) => texture.data[(y * 64 + x) * 4];
        edge += Math.abs(at(63) - at(0));
        inner += Math.abs(at(32) - at(31));
      }
      expect(edge).toBeLessThan(inner * 1.6 + 64 * 4);
    }
  });
});

describe('parseTexturingConfig', () => {
  it('accepts every built-in preset', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(parseTexturingConfig(preset.texturing)).toEqual(preset.texturing);
    }
  });

  it('rejects thresholds out of order', () => {
    expect(parseTexturingConfig({ ...DEFAULT_TEXTURING_CONFIG, thresholds: [0.5, 0.2, 0.8] })).toBeNull();
  });

  it('rejects invalid colours and unknown textures', () => {
    const zones = structuredClone(DEFAULT_TEXTURING_CONFIG.zones);
    zones[0].color = 'red';
    expect(parseTexturingConfig({ ...DEFAULT_TEXTURING_CONFIG, zones })).toBeNull();

    const badTexture = structuredClone(DEFAULT_TEXTURING_CONFIG.zones) as any[];
    badTexture[1].texture = { type: 'builtin', id: 'lava' };
    expect(parseTexturingConfig({ ...DEFAULT_TEXTURING_CONFIG, zones: badTexture })).toBeNull();
  });

  it('only accepts image textures stored as data URLs', () => {
    const zones = structuredClone(DEFAULT_TEXTURING_CONFIG.zones) as any[];
    zones[2].texture = { type: 'image', name: 'x.png', dataUrl: 'https://example.com/x.png' };
    expect(parseTexturingConfig({ ...DEFAULT_TEXTURING_CONFIG, zones })).toBeNull();
  });
});
