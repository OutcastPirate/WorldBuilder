import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import {
  MAX_SLOPE_RANGE,
  PlacementCategoryConfig,
  PlacementCategoryId,
  PlacementConfig,
  R_MIN_RANGE,
  TexturingConfig,
} from '../../generation/config';
import { MAX_OBJECTS_PER_CATEGORY } from '../../generation/placement';
import { randomSeed } from '../../generation/rng';
import { AssetLibraryService, LibraryAsset } from '../../services/asset-library.service';
import { GenerationConfigService } from '../../services/generation-config.service';
import {
  PlacementLayerService,
  PlacementStatus,
  PlacementSummary,
} from '../../services/placement-layer.service';
import { SelectionService } from '../../services/selection.service';

const MIN_RANGE_GAP = 0.01;

@Component({
  selector: 'app-placement-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './placement-panel.component.html',
  styleUrl: './placement-panel.component.scss',
})
export class PlacementPanelComponent implements OnInit, OnDestroy {
  constructor(
    private configService: GenerationConfigService,
    private placementLayer: PlacementLayerService,
    private library: AssetLibraryService,
    private selection: SelectionService
  ) {}

  placement!: PlacementConfig;
  texturing!: TexturingConfig;
  assets: LibraryAsset[] = [];
  status: PlacementStatus = 'idle';
  summary!: PlacementSummary;
  placingAssetId: string | null = null;

  readonly rMinRange = R_MIN_RANGE;
  readonly slopeRange = MAX_SLOPE_RANGE;
  readonly maxObjects = MAX_OBJECTS_PER_CATEGORY;

  private importCategory: PlacementCategoryId = 'vegetation';
  private subscription!: Subscription;

  ngOnInit(): void {
    this.library.load();
    this.subscription = combineLatest([
      this.configService.config$,
      this.library.assets$,
      this.placementLayer.status$,
      this.placementLayer.summary$,
      this.selection.placingAssetId$,
    ]).subscribe(([config, assets, status, summary, placingAssetId]) => {
      this.placingAssetId = placingAssetId;
      this.placement = config.placement;
      this.texturing = config.texturing;
      this.assets = assets;
      this.status = status;
      this.summary = summary;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get totalCount(): number {
    return Object.values(this.summary.counts).reduce((sum, n) => sum + (n ?? 0), 0);
  }

  trackById(_: number, category: PlacementCategoryConfig): string {
    return category.id;
  }

  assetsFor(category: PlacementCategoryConfig): LibraryAsset[] {
    return this.assets.filter((asset) => asset.category === category.id);
  }

  update(id: PlacementCategoryId, patch: Partial<PlacementCategoryConfig>): void {
    this.configService.updateCategory(id, patch);
  }

  updateNumber(id: PlacementCategoryId, key: 'rMin' | 'maxSlope', value: number | null): void {
    if (value === null || Number.isNaN(value) || (key === 'rMin' && value <= 0)) return;
    this.update(id, { [key]: value });
  }

  setPercent(id: PlacementCategoryId, key: 'density' | 'scaleVariation', percent: number): void {
    this.update(id, { [key]: percent / 100 });
  }

  setHeightRange(category: PlacementCategoryConfig, end: 0 | 1, value: number): void {
    const range: [number, number] = [...category.heightRange];
    range[end] =
      end === 0
        ? Math.min(value, range[1] - MIN_RANGE_GAP)
        : Math.max(value, range[0] + MIN_RANGE_GAP);
    this.update(category.id, { heightRange: range });
  }

  toggleAsset(category: PlacementCategoryConfig, assetId: string, checked: boolean): void {
    const assetIds = checked
      ? [...category.assetIds, assetId]
      : category.assetIds.filter((id) => id !== assetId);
    this.update(category.id, { assetIds });
  }

  // Place mode: each click on the terrain adds this model by hand.
  togglePlacing(assetId: string): void {
    if (this.placingAssetId === assetId) this.selection.stopPlacing();
    else this.selection.startPlacing(assetId);
  }

  setSeed(value: number | null): void {
    if (value === null || Number.isNaN(value)) return;
    this.configService.updatePlacement({ seed: value });
  }

  randomizeSeed(): void {
    this.configService.updatePlacement({ seed: randomSeed() });
  }

  chooseModel(category: PlacementCategoryId, input: HTMLInputElement): void {
    this.importCategory = category;
    input.click();
  }

  onModelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const model = files.find((f) => /\.(obj|gltf|glb)$/i.test(f.name));
    if (!model) return;
    const material = files.find((f) => /\.mtl$/i.test(f.name));
    const asset = this.library.addUpload(model, this.importCategory, material);
    const category = this.placement.categories.find((c) => c.id === this.importCategory)!;
    this.toggleAsset(category, asset.id, true);
  }

  // Zone colours with hard edges at the texturing thresholds, so the height
  // range can be read against the terrain zones.
  zoneGradient(): string {
    const { thresholds, zones } = this.texturing;
    const stops: string[] = [];
    let start = 0;
    zones.forEach((zone, i) => {
      const end = i < 3 ? thresholds[i] * 100 : 100;
      stops.push(`${zone.color} ${start}%`, `${zone.color} ${end}%`);
      start = end;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }

  statusText(): string {
    switch (this.status) {
      case 'placing':
        return 'Placing objects…';
      case 'loading':
        return 'Loading models…';
      default: {
        const triangles = this.summary.triangles;
        const formatted =
          triangles >= 1e6 ? `${(triangles / 1e6).toFixed(1)} M` : `${Math.round(triangles / 1000)} k`;
        return `${this.totalCount.toLocaleString('en')} objects · ${formatted} triangles`;
      }
    }
  }
}
