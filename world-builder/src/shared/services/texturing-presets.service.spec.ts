import { TestBed } from '@angular/core/testing';
import { DEFAULT_TEXTURING_CONFIG } from '../generation/config';
import { PRESET_FILE_FORMAT } from '../generation/texturing-presets';
import { TexturingPresetsService } from './texturing-presets.service';

const STORAGE_KEY = 'worldBuilder.texturingPresets.v1';

describe('TexturingPresetsService', () => {
  let saved: string | null;

  beforeEach(() => {
    saved = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    if (saved === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, saved);
  });

  it('starts with the built-in presets', () => {
    const service = TestBed.inject(TexturingPresetsService);
    expect(service.presets.length).toBe(3);
    expect(service.presets.every((p) => p.builtIn)).toBeTrue();
  });

  it('saves a preset and loads it again in a new session', () => {
    const service = TestBed.inject(TexturingPresetsService);
    const texturing = structuredClone(DEFAULT_TEXTURING_CONFIG);
    texturing.zones[1].color = '#123456';
    service.save('My island', texturing);

    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(TexturingPresetsService);
    const preset = reloaded.presets.find((p) => p.name === 'My island');
    expect(preset?.texturing.zones[1].color).toBe('#123456');
  });

  it('overwrites a user preset with the same name', () => {
    const service = TestBed.inject(TexturingPresetsService);
    service.save('Island', DEFAULT_TEXTURING_CONFIG);
    service.save('Island', { ...DEFAULT_TEXTURING_CONFIG, blendWidth: 0.1 });
    const matches = service.presets.filter((p) => p.name === 'Island');
    expect(matches.length).toBe(1);
    expect(matches[0].texturing.blendWidth).toBe(0.1);
  });

  it('refuses to overwrite a built-in preset', () => {
    const service = TestBed.inject(TexturingPresetsService);
    expect(() => service.save('Alpine', DEFAULT_TEXTURING_CONFIG)).toThrowError(/built-in/);
  });

  it('deletes user presets', () => {
    const service = TestBed.inject(TexturingPresetsService);
    const preset = service.save('Temporary', DEFAULT_TEXTURING_CONFIG);
    service.delete(preset.id);
    expect(service.presets.some((p) => p.id === preset.id)).toBeFalse();
  });

  it('imports a preset file', async () => {
    const service = TestBed.inject(TexturingPresetsService);
    const content = JSON.stringify({
      format: PRESET_FILE_FORMAT,
      version: 1,
      name: 'Shared',
      texturing: DEFAULT_TEXTURING_CONFIG,
    });
    const preset = await service.importFromFile(new File([content], 'shared.json'));
    expect(preset.name).toBe('Shared');
    expect(service.presets.some((p) => p.id === preset.id)).toBeTrue();
  });

  it('rejects files that are not presets', async () => {
    const service = TestBed.inject(TexturingPresetsService);
    await expectAsync(
      service.importFromFile(new File(['{"hello": 1}'], 'other.json'))
    ).toBeRejectedWithError(/not a World Builder texturing preset/);
  });
});
