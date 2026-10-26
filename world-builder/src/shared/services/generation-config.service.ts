import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  DEFAULT_PLACEMENT_CONFIG,
  DEFAULT_TERRAIN_CONFIG,
  DEFAULT_TEXTURING_CONFIG,
  GenerationConfig,
  PlacementCategoryConfig,
  PlacementCategoryId,
  PlacementConfig,
  TerrainConfig,
  TexturingConfig,
} from '../generation/config';

// Single source of truth for every generation parameter. Panels write to it,
// the preview and the generators read from it.
@Injectable({
  providedIn: 'root',
})
export class GenerationConfigService {
  private _config = new BehaviorSubject<GenerationConfig>({
    terrain: { ...DEFAULT_TERRAIN_CONFIG },
    texturing: structuredClone(DEFAULT_TEXTURING_CONFIG),
    placement: structuredClone(DEFAULT_PLACEMENT_CONFIG),
  });

  config$: Observable<GenerationConfig> = this._config.asObservable();

  get config(): GenerationConfig {
    return this._config.getValue();
  }

  updateTerrain(patch: Partial<TerrainConfig>): void {
    const current = this.config;
    this._config.next({
      ...current,
      terrain: { ...current.terrain, ...patch },
    });
  }

  updateTexturing(patch: Partial<TexturingConfig>): void {
    const current = this.config;
    this._config.next({
      ...current,
      texturing: structuredClone({ ...current.texturing, ...patch }),
    });
  }

  updatePlacement(patch: Partial<PlacementConfig>): void {
    const current = this.config;
    this._config.next({
      ...current,
      placement: structuredClone({ ...current.placement, ...patch }),
    });
  }

  updateCategory(id: PlacementCategoryId, patch: Partial<PlacementCategoryConfig>): void {
    this.updatePlacement({
      categories: this.config.placement.categories.map((category) =>
        category.id === id ? { ...category, ...patch } : category
      ),
    });
  }

  // Restores Table 1 defaults but keeps the current seed and grid settings.
  resetNoise(): void {
    const { scale, octaves, persistence, lacunarity } = DEFAULT_TERRAIN_CONFIG;
    this.updateTerrain({ scale, octaves, persistence, lacunarity });
  }
}
