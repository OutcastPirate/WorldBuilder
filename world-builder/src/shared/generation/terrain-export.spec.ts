import { DEFAULT_TERRAIN_CONFIG, DEFAULT_TEXTURING_CONFIG } from './config';
import { Heightmap } from './heightmap';
import { browserDeflate, crc32, encodePng } from './png';
import { encodeRaw16, encodeSplatmap, terrainDataJson, toTerrainLocal } from './terrain-export';

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe('encodePng', () => {
  it('writes a valid RGBA PNG that keeps colour where alpha is 0', async () => {
    // 2 × 1 pixels: the first is fully transparent but has colour.
    const rgba = new Uint8Array([200, 100, 50, 0, 1, 2, 3, 255]);
    const png = await encodePng(2, 1, rgba, browserDeflate);
    const view = new DataView(png.buffer);

    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // Walk the chunks, checking each CRC, and collect the image data.
    let offset = 8;
    const types: string[] = [];
    let idat = new Uint8Array(0);
    while (offset < png.length) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(...png.slice(offset + 4, offset + 8));
      const body = png.slice(offset + 4, offset + 8 + length);
      expect(view.getUint32(offset + 8 + length)).withContext(type).toBe(crc32(body));
      if (type === 'IHDR') {
        expect(view.getUint32(offset + 8)).toBe(2); // width
        expect(view.getUint32(offset + 12)).toBe(1); // height
        expect(png[offset + 16]).toBe(8); // bit depth
        expect(png[offset + 17]).toBe(6); // RGBA
      }
      if (type === 'IDAT') idat = png.slice(offset + 8, offset + 8 + length);
      types.push(type);
      offset += 12 + length;
    }
    expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect(Array.from(await inflate(idat))).toEqual([0, ...rgba]);
  });
});

describe('terrain data export', () => {
  const map: Heightmap = { size: 2, data: new Float32Array([0, 0.5, 1, 0.25]) };

  it('writes 16-bit little-endian heights row by row', () => {
    const raw = encodeRaw16(map);
    const view = new DataView(raw.buffer);
    expect(raw.length).toBe(8);
    expect([0, 1, 2, 3].map((i) => view.getUint16(i * 2, true))).toEqual([0, 32768, 65535, 16384]);
  });

  it('writes splatmap weights that add up to 255 per pixel', () => {
    const texturing = { ...DEFAULT_TEXTURING_CONFIG, blendWidth: 0.1 };
    const steps = 101;
    const ramp: Heightmap = { size: steps, data: new Float32Array(steps * steps).map((_, i) => (i % steps) / (steps - 1)) };
    const pixels = encodeSplatmap(ramp, texturing);
    for (let i = 0; i < pixels.length; i += 4) {
      expect(pixels[i] + pixels[i + 1] + pixels[i + 2] + pixels[i + 3]).toBe(255);
    }
    // Lowest point is all sand (red), highest all snow (alpha).
    expect(Array.from(pixels.slice(0, 4))).toEqual([255, 0, 0, 0]);
    expect(Array.from(pixels.slice((steps - 1) * 4, steps * 4))).toEqual([0, 0, 0, 255]);
  });

  it('describes terrain and objects in terrain-local coordinates', () => {
    const position = toTerrainLocal(128, -64, 3.5, 10);
    expect(position).toEqual([0, 3.5, 74]);
    const json = JSON.parse(
      terrainDataJson(DEFAULT_TERRAIN_CONFIG, DEFAULT_TEXTURING_CONFIG, [
        { name: 'Bush', source: 'generated', position, rotationY: 90, scale: 1 },
      ])
    );
    expect(json.terrain).toEqual(jasmine.objectContaining({ resolution: 257, size: 128, height: 24 }));
    expect(json.layers.map((l: { channel: string }) => l.channel)).toEqual(['r', 'g', 'b', 'a']);
    expect(json.objects[0].position).toEqual([0, 3.5, 74]);
  });
});
