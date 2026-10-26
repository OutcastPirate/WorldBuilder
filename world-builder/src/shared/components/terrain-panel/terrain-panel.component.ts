import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import {
  BASE_THICKNESS_RANGE,
  DEFAULT_ISLAND_FALLOFF,
  EDGE_FALLOFF_RANGE,
  GenerationConfig,
  HEIGHT_SCALE_RANGE,
  TerrainShape,
  NOISE_PARAM_RANGES,
  NoiseParams,
  TERRAIN_RESOLUTIONS,
  TerrainConfig,
  WORLD_SIZE_RANGE,
} from '../../generation/config';
import { randomSeed } from '../../generation/rng';
import { GenerationConfigService } from '../../services/generation-config.service';
import { TerrainMeshService } from '../../services/terrain-mesh.service';
import { HeightmapPreviewComponent } from '../heightmap-preview/heightmap-preview.component';

interface NoiseSlider {
  key: keyof NoiseParams;
  label: string;
  symbol: string;
  hint: string;
}

@Component({
  selector: 'app-terrain-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, HeightmapPreviewComponent],
  templateUrl: './terrain-panel.component.html',
  styleUrl: './terrain-panel.component.scss',
})
export class TerrainPanelComponent implements OnInit, OnDestroy {
  constructor(
    private configService: GenerationConfigService,
    private terrainMesh: TerrainMeshService
  ) {}

  config!: GenerationConfig;
  generating = false;
  // True when the sliders differ from the terrain currently shown.
  hasPendingChanges = false;

  readonly resolutions = TERRAIN_RESOLUTIONS;
  readonly ranges = NOISE_PARAM_RANGES;
  readonly worldSizeRange = WORLD_SIZE_RANGE;
  readonly heightScaleRange = HEIGHT_SCALE_RANGE;
  readonly falloffRange = EDGE_FALLOFF_RANGE;
  readonly thicknessRange = BASE_THICKNESS_RANGE;

  // Effects as described in Table 1 of the article.
  readonly noiseSliders: NoiseSlider[] = [
    { key: 'scale', label: 'Scale', symbol: 's', hint: 'small: dense hills · large: wide, gentle landscapes' },
    { key: 'octaves', label: 'Octaves', symbol: 'K', hint: 'few: smooth · many: rocks and fine detail' },
    { key: 'persistence', label: 'Persistence', symbol: 'p', hint: 'low: smooth · high: rough' },
    { key: 'lacunarity', label: 'Lacunarity', symbol: 'λ', hint: 'low: uniform · high: strong large/small contrast' },
  ];

  private subscription!: Subscription;

  ngOnInit(): void {
    this.subscription = combineLatest([
      this.configService.config$,
      this.terrainMesh.builtConfig$,
      this.terrainMesh.generating$,
    ]).subscribe(([config, built, generating]) => {
      this.config = config;
      this.generating = generating;
      this.hasPendingChanges =
        !!built && JSON.stringify(built) !== JSON.stringify(config.terrain);
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  update<K extends keyof TerrainConfig>(key: K, value: TerrainConfig[K] | null): void {
    // Number inputs report null while the field is empty or invalid.
    if (value === null || (typeof value === 'number' && Number.isNaN(value))) {
      return;
    }
    this.configService.updateTerrain({ [key]: value } as Partial<TerrainConfig>);
  }

  // An island with cliffs all round rarely looks right, so switching to the
  // circle turns on a gentle falloff when there is none.
  setShape(shape: TerrainShape): void {
    const patch: Partial<TerrainConfig> = { shape };
    if (shape === 'circle' && this.config.terrain.edgeFalloff === 0) {
      patch.edgeFalloff = DEFAULT_ISLAND_FALLOFF;
    }
    this.configService.updateTerrain(patch);
  }

  randomizeSeed(): void {
    this.update('seed', randomSeed());
  }

  resetNoise(): void {
    this.configService.resetNoise();
  }

  generate(): void {
    this.terrainMesh.generate(this.config.terrain);
  }

  metresPerVertex(): string {
    const { worldSize, resolution } = this.config.terrain;
    return (worldSize / (resolution - 1)).toFixed(2);
  }
}
