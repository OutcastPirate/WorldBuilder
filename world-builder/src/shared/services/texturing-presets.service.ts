import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TexturingConfig } from '../generation/config';
import { FileSaveService, SaveResult } from './file-save.service';
import {
  BUILT_IN_PRESETS,
  parseTexturingConfig,
  PRESET_FILE_FORMAT,
  TexturingPreset,
  TexturingPresetFile,
} from '../generation/texturing-presets';

const STORAGE_KEY = 'worldBuilder.texturingPresets.v1';

// Built-in presets plus the user's own, which are kept in localStorage and
// can be exported to / imported from .json files.
@Injectable({
  providedIn: 'root',
})
export class TexturingPresetsService {
  constructor(private fileSave: FileSaveService) {}

  private _presets = new BehaviorSubject<TexturingPreset[]>([
    ...BUILT_IN_PRESETS,
    ...this.loadUserPresets(),
  ]);

  presets$: Observable<TexturingPreset[]> = this._presets.asObservable();

  get presets(): TexturingPreset[] {
    return this._presets.getValue();
  }

  // Saves the texturing under `name`, replacing a user preset of the same
  // name. Throws with a readable message if storage is full.
  save(name: string, texturing: TexturingConfig): TexturingPreset {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) throw new Error('Enter a name for the preset.');
    if (BUILT_IN_PRESETS.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`"${trimmed}" is a built-in preset. Choose another name.`);
    }

    const existing = this.userPresets().find((p) => p.name === trimmed);
    const preset: TexturingPreset = {
      id: existing?.id ?? `user-${Date.now()}`,
      name: trimmed,
      builtIn: false,
      texturing: structuredClone(texturing),
    };
    const userPresets = existing
      ? this.userPresets().map((p) => (p.id === existing.id ? preset : p))
      : [...this.userPresets(), preset];
    this.storeUserPresets(userPresets);
    return preset;
  }

  delete(id: string): void {
    this.storeUserPresets(this.userPresets().filter((p) => p.id !== id));
  }

  // Saves the preset as a .json file.
  exportToFile(preset: TexturingPreset): Promise<SaveResult> {
    const file: TexturingPresetFile = {
      format: PRESET_FILE_FORMAT,
      version: 1,
      name: preset.name,
      texturing: preset.texturing,
    };
    const name = `${preset.name.replace(/[^\w\- ]+/g, '').trim() || 'preset'}.texturing.json`;
    return this.fileSave.saveFile(name, JSON.stringify(file, null, 2), [
      { name: 'Texturing preset', extensions: ['json'] },
    ]);
  }

  // Reads a preset file and saves it as a user preset.
  async importFromFile(file: File): Promise<TexturingPreset> {
    let content: unknown;
    try {
      content = JSON.parse(await file.text());
    } catch {
      throw new Error(`${file.name} is not a valid JSON file.`);
    }
    const data = content as Partial<TexturingPresetFile>;
    const texturing = data.format === PRESET_FILE_FORMAT ? parseTexturingConfig(data.texturing) : null;
    if (!texturing) {
      throw new Error(`${file.name} is not a World Builder texturing preset.`);
    }
    const name = typeof data.name === 'string' && data.name.trim() ? data.name : file.name.replace(/\..*$/, '');
    const builtInClash = BUILT_IN_PRESETS.some((p) => p.name.toLowerCase() === name.trim().toLowerCase());
    return this.save(builtInClash ? `${name} (imported)` : name, texturing);
  }

  private userPresets(): TexturingPreset[] {
    return this.presets.filter((p) => !p.builtIn);
  }

  private storeUserPresets(userPresets: TexturingPreset[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
    } catch {
      throw new Error(
        'Not enough storage to save this preset (custom images take space). Export it to a file instead.'
      );
    }
    this._presets.next([...BUILT_IN_PRESETS, ...userPresets]);
  }

  private loadUserPresets(): TexturingPreset[] {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(stored)) return [];
      return stored.flatMap((item): TexturingPreset[] => {
        const texturing = parseTexturingConfig(item?.texturing);
        return texturing && typeof item.id === 'string' && typeof item.name === 'string'
          ? [{ id: item.id, name: item.name, builtIn: false, texturing }]
          : [];
      });
    } catch {
      return [];
    }
  }
}
