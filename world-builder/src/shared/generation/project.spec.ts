import { DEFAULT_PLACEMENT_CONFIG, DEFAULT_TERRAIN_CONFIG, DEFAULT_TEXTURING_CONFIG } from './config';
import { parseProject, PROJECT_FORMAT, PROJECT_VERSION, ProjectFile } from './project';

function project(patch: Partial<ProjectFile> = {}): ProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: '2026-10-26T12:00:00.000Z',
    config: {
      terrain: { ...DEFAULT_TERRAIN_CONFIG, shape: 'circle', edgeFalloff: 0.35 },
      texturing: structuredClone(DEFAULT_TEXTURING_CONFIG),
      placement: structuredClone(DEFAULT_PLACEMENT_CONFIG),
    },
    removedGenerated: ['bush@1.00,2.00'],
    uploads: [
      { id: 'upload:1', name: 'Fern', category: 'vegetation', height: 1, file: { name: 'fern.obj', data: 'dg==' } },
    ],
    objects: [
      {
        name: 'House',
        origin: { kind: 'library', assetId: 'procedural:house' },
        transform: { position: [1, 2, 3], rotation: [0, 1.5, 0], scale: [1, 1, 1] },
        snapToGround: true,
      },
      {
        name: 'Red cube',
        origin: { kind: 'shape', shape: 'Cube', height: 2, width: 1 },
        transform: { position: [0, 5, 0], rotation: [0, 0, 0], scale: [2, 2, 2] },
        snapToGround: false,
        color: '#ff0000',
      },
    ],
    scene: { background: '#87ceeb', fog: { color: '#cccccc', density: 0.005 } },
    ...patch,
  };
}

// A saved project goes through JSON on disk.
const roundTrip = (value: unknown) => parseProject(JSON.parse(JSON.stringify(value)));

describe('parseProject', () => {
  it('reads back everything that was saved', () => {
    expect(roundTrip(project())).toEqual(project());
  });

  it('keeps settings in the same key order as the defaults', () => {
    // Placement compares settings as JSON to keep deleted objects deleted.
    const parsed = roundTrip(project({ config: { ...project().config, terrain: { ...DEFAULT_TERRAIN_CONFIG } } }));
    expect(Object.keys(parsed.config.terrain)).toEqual(Object.keys(DEFAULT_TERRAIN_CONFIG));
  });

  it('rejects files that are not projects', () => {
    expect(() => roundTrip({ hello: 1 })).toThrowError(/not a World Builder project/);
    expect(() => roundTrip({ ...project(), version: 99 })).toThrowError(/not supported/);
  });

  it('rejects out-of-range settings with a readable message', () => {
    const bad = project();
    (bad.config.terrain as any).resolution = 300;
    expect(() => roundTrip(bad)).toThrowError(/Unsupported terrain resolution: 300/);

    const steep = project();
    steep.config.placement.categories[0].maxSlope = 120;
    expect(() => roundTrip(steep)).toThrowError(/slope \(120\) is out of range/);
  });

  it('rejects damaged embedded files and unknown object kinds', () => {
    const damaged = project();
    damaged.uploads[0].file.data = 'not base64!';
    expect(() => roundTrip(damaged)).toThrowError(/damaged/);

    const unknown = project();
    (unknown.objects[0].origin as any).kind = 'script';
    expect(() => roundTrip(unknown)).toThrowError(/Unknown object origin/);
  });

  it('strips path separators from embedded file names', () => {
    const sneaky = project();
    sneaky.uploads[0].file.name = '../../evil.obj';
    expect(roundTrip(sneaky).uploads[0].file.name).toBe('.._.._evil.obj');
  });

  it('fills in settings added after the first version', () => {
    const old = project();
    delete (old.config.terrain as any).shape;
    delete (old.config.terrain as any).edgeFalloff;
    delete (old.config.terrain as any).baseThickness;
    delete (old as any).scene;
    const parsed = roundTrip(old);
    expect(parsed.config.terrain.shape).toBe('square');
    expect(parsed.config.terrain.baseThickness).toBe(6);
    expect(parsed.scene).toEqual({ background: '#202020', fog: null });
  });
});
