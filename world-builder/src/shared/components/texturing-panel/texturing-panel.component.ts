import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import { BUILTIN_TEXTURE_LABELS } from '../../generation/builtin-textures';
import {
  BLEND_WIDTH_RANGE,
  BUILTIN_TEXTURE_IDS,
  TexturingConfig,
  TILE_SIZE_RANGE,
  ZoneMaterial,
} from '../../generation/config';
import { TexturingPreset } from '../../generation/texturing-presets';
import { GenerationConfigService } from '../../services/generation-config.service';
import { TexturingPresetsService } from '../../services/texturing-presets.service';
import { TexturingService } from '../../services/texturing.service';
import { ZoneSwatchComponent } from '../zone-swatch/zone-swatch.component';

const MIN_ZONE_GAP = 0.01;

interface Message {
  text: string;
  error: boolean;
}

@Component({
  selector: 'app-texturing-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ZoneSwatchComponent],
  templateUrl: './texturing-panel.component.html',
  styleUrl: './texturing-panel.component.scss',
})
export class TexturingPanelComponent implements OnInit, OnDestroy {
  constructor(
    private configService: GenerationConfigService,
    private presetsService: TexturingPresetsService,
    private texturingService: TexturingService
  ) {}

  @ViewChild('bar') bar?: ElementRef<HTMLElement>;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  texturing!: TexturingConfig;
  presets: TexturingPreset[] = [];
  selectedPresetId = 'builtin-temperate';
  modified = false;
  baking = false;

  savingName: string | null = null;
  confirmingDelete = false;
  message: Message | null = null;

  readonly blendRange = BLEND_WIDTH_RANGE;
  readonly tileRange = TILE_SIZE_RANGE;
  readonly builtinTextures = BUILTIN_TEXTURE_IDS.map((id) => ({
    value: `builtin:${id}`,
    label: BUILTIN_TEXTURE_LABELS[id],
  }));
  // Highest zone first, as in Figure 4 of the article.
  readonly zoneOrder = [3, 2, 1, 0];

  private draggedThreshold: number | null = null;
  private uploadZone = 0;
  private subscription!: Subscription;

  ngOnInit(): void {
    this.subscription = combineLatest([
      this.configService.config$,
      this.presetsService.presets$,
      this.texturingService.baking$,
    ]).subscribe(([config, presets, baking]) => {
      this.texturing = config.texturing;
      this.presets = presets;
      this.baking = baking;
      this.updateModified();
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get selectedPreset(): TexturingPreset | undefined {
    return this.presets.find((p) => p.id === this.selectedPresetId);
  }

  // ---- Presets ----

  applyPreset(id: string): void {
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return;
    this.selectedPresetId = id;
    this.confirmingDelete = false;
    this.message = null;
    this.configService.updateTexturing(preset.texturing);
  }

  startSave(): void {
    const current = this.selectedPreset;
    this.savingName = current && !current.builtIn ? current.name : '';
    this.confirmingDelete = false;
    this.message = null;
  }

  confirmSave(): void {
    if (this.savingName === null) return;
    try {
      const preset = this.presetsService.save(this.savingName, this.texturing);
      this.selectedPresetId = preset.id;
      this.savingName = null;
      this.updateModified();
      this.message = { text: `Saved "${preset.name}".`, error: false };
    } catch (error) {
      this.message = { text: (error as Error).message, error: true };
    }
  }

  deletePreset(): void {
    const preset = this.selectedPreset;
    if (!preset || preset.builtIn) return;
    this.presetsService.delete(preset.id);
    this.selectedPresetId = '';
    this.confirmingDelete = false;
    this.updateModified();
    this.message = { text: `Deleted "${preset.name}". The current settings are kept.`, error: false };
  }

  async exportPreset(): Promise<void> {
    const base = this.selectedPreset?.name ?? 'Custom texturing';
    try {
      const result = await this.presetsService.exportToFile({
        id: '',
        name: this.modified ? `${base} (modified)` : base,
        builtIn: false,
        texturing: this.texturing,
      });
      if (result.kind === 'saved') this.message = { text: `Saved to ${result.path}`, error: false };
    } catch (error) {
      this.message = { text: `Export failed: ${(error as Error).message}`, error: true };
    }
  }

  async importPreset(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const preset = await this.presetsService.importFromFile(file);
      this.applyPreset(preset.id);
      this.message = { text: `Imported "${preset.name}".`, error: false };
    } catch (error) {
      this.message = { text: (error as Error).message, error: true };
    }
  }

  // ---- Height zones ----

  setThreshold(index: number, value: number): void {
    const thresholds = [...this.texturing.thresholds] as TexturingConfig['thresholds'];
    const min = index === 0 ? MIN_ZONE_GAP : thresholds[index - 1] + MIN_ZONE_GAP;
    const max = index === 2 ? 1 - MIN_ZONE_GAP : thresholds[index + 1] - MIN_ZONE_GAP;
    thresholds[index] = Math.round(Math.min(Math.max(value, min), max) * 100) / 100;
    this.configService.updateTexturing({ thresholds });
  }

  setBlendWidth(value: number | null): void {
    if (value === null) return;
    this.configService.updateTexturing({ blendWidth: value });
  }

  startDrag(index: number, event: PointerEvent): void {
    this.draggedThreshold = index;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  drag(index: number, event: PointerEvent): void {
    if (this.draggedThreshold !== index || !this.bar) return;
    const rect = this.bar.nativeElement.getBoundingClientRect();
    this.setThreshold(index, 1 - (event.clientY - rect.top) / rect.height);
  }

  endDrag(): void {
    this.draggedThreshold = null;
  }

  nudge(index: number, event: KeyboardEvent): void {
    const steps: Record<string, number> = { ArrowUp: 0.01, ArrowDown: -0.01, PageUp: 0.05, PageDown: -0.05 };
    if (!(event.key in steps)) return;
    event.preventDefault();
    this.setThreshold(index, this.texturing.thresholds[index] + steps[event.key]);
  }

  // Keeps each handle element alive while its value changes, so a drag
  // doesn't lose its pointer capture.
  trackByIndex(index: number): number {
    return index;
  }

  // Vertical gradient of the zone colours, with the blend bands, for the bar.
  barGradient(): string {
    const { thresholds, blendWidth, zones } = this.texturing;
    const pct = (value: number) => `${(Math.min(Math.max(value, 0), 1) * 100).toFixed(1)}%`;
    const stops = [`${zones[0].color} 0%`];
    thresholds.forEach((t, i) => {
      stops.push(`${zones[i].color} ${pct(t - blendWidth / 2)}`);
      stops.push(`${zones[i + 1].color} ${pct(t + blendWidth / 2)}`);
    });
    stops.push(`${zones[3].color} 100%`);
    return `linear-gradient(to top, ${stops.join(', ')})`;
  }

  // Vertical centre (in %) of each zone's band, for its label.
  zoneCenter(index: number): number {
    const t = this.texturing.thresholds;
    const low = index === 0 ? 0 : t[index - 1];
    const high = index === 3 ? 1 : t[index];
    return ((low + high) / 2) * 100;
  }

  // ---- Zone materials ----

  updateZone(index: number, patch: Partial<ZoneMaterial>): void {
    const zones = this.texturing.zones.map((zone, i) =>
      i === index ? { ...zone, ...patch } : zone
    ) as TexturingConfig['zones'];
    this.configService.updateTexturing({ zones });
  }

  textureValue(zone: ZoneMaterial): string {
    if (!zone.texture) return 'none';
    return zone.texture.type === 'builtin' ? `builtin:${zone.texture.id}` : 'image';
  }

  setTexture(index: number, value: string): void {
    if (value === 'image') return; // keeps the current custom image
    if (value === 'none') {
      this.updateZone(index, { texture: null });
      return;
    }
    const id = BUILTIN_TEXTURE_IDS.find((b) => `builtin:${b}` === value);
    if (id) this.updateZone(index, { texture: { type: 'builtin', id } });
  }

  setTileSize(index: number, value: number | null): void {
    if (value === null || value <= 0) return;
    this.updateZone(index, { tileSize: value });
  }

  chooseImage(index: number): void {
    this.uploadZone = index;
    this.imageInput.nativeElement.click();
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const texture = await this.texturingService.importImage(file);
      this.updateZone(this.uploadZone, { texture });
      this.message = null;
    } catch (error) {
      this.message = { text: `${file.name}: ${(error as Error).message}`, error: true };
    }
  }

  private updateModified(): void {
    const preset = this.selectedPreset;
    this.modified =
      !preset || JSON.stringify(preset.texturing) !== JSON.stringify(this.texturing);
  }
}
