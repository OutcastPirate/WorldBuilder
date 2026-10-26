import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TerrainConfig, TexturingConfig } from '../../generation/config';
import { Heightmap } from '../../generation/heightmap';
import { hexToRgb, zoneWeights } from '../../generation/texturing';
import { GenerationWorkerService } from '../../services/generation-worker.service';

const PREVIEW_SIZE = 128;
const REDRAW_DELAY_MS = 50;

// Live top-down thumbnail of the heightmap, coloured by texturing zone (with
// the same blending as the 3D terrain) and hill-shaded so the relief is
// readable. Row 0 (top) is the terrain's far, -Z edge.
@Component({
  selector: 'app-heightmap-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './heightmap-preview.component.html',
  styleUrl: './heightmap-preview.component.scss',
})
export class HeightmapPreviewComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) config!: TerrainConfig;
  @Input({ required: true }) texturing!: TexturingConfig;

  @ViewChild('canvas', { static: true })
  canvas!: ElementRef<HTMLCanvasElement>;

  readonly size = PREVIEW_SIZE;
  private redrawTimer?: ReturnType<typeof setTimeout>;

  constructor(private workerService: GenerationWorkerService) {}

  ngOnChanges(): void {
    // Sliders fire many events per second; draw once they pause briefly.
    clearTimeout(this.redrawTimer);
    this.redrawTimer = setTimeout(() => this.draw(), REDRAW_DELAY_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.redrawTimer);
  }

  private draw(): void {
    const context = this.canvas.nativeElement.getContext('2d');
    if (!context) return;

    const map = this.workerService.previewHeightmap(this.config, PREVIEW_SIZE);
    const colors = this.texturing.zones.map((zone) => hexToRgb(zone.color));
    const image = context.createImageData(PREVIEW_SIZE, PREVIEW_SIZE);
    // Height difference between neighbouring preview pixels, in the same
    // units as the horizontal spacing, for slope shading.
    const relief =
      (this.config.heightScale / this.config.worldSize) * (PREVIEW_SIZE - 1);

    for (let row = 0; row < PREVIEW_SIZE; row++) {
      for (let col = 0; col < PREVIEW_SIZE; col++) {
        const h = map.data[row * PREVIEW_SIZE + col];
        const weights = zoneWeights(h, this.texturing.thresholds, this.texturing.blendWidth);
        const shade = this.shade(map, row, col, relief);
        const i = (row * PREVIEW_SIZE + col) * 4;
        for (let channel = 0; channel < 3; channel++) {
          let value = 0;
          for (let zone = 0; zone < 4; zone++) {
            value += weights[zone] * colors[zone][channel];
          }
          image.data[i + channel] = value * shade;
        }
        // Outside an island's circle stays transparent.
        const p = (col / (PREVIEW_SIZE - 1)) * 2 - 1;
        const q = (row / (PREVIEW_SIZE - 1)) * 2 - 1;
        image.data[i + 3] = this.config.shape === 'circle' && p * p + q * q > 1 ? 0 : 255;
      }
    }
    context.putImageData(image, 0, 0);
  }

  // Lambert shading: surface normal from the height gradient, light from the
  // north-west and above. Returns a brightness factor around 1.
  private shade(map: Heightmap, row: number, col: number, relief: number): number {
    const last = map.size - 1;
    const at = (r: number, c: number) =>
      map.data[
        Math.min(Math.max(r, 0), last) * map.size + Math.min(Math.max(c, 0), last)
      ];
    const dx = ((at(row, col + 1) - at(row, col - 1)) / 2) * relief;
    const dz = ((at(row + 1, col) - at(row - 1, col)) / 2) * relief;

    // normal = (-dx, 1, -dz) / |n|, light = (-1, 1.5, -1) / |l|
    const normalLength = Math.sqrt(dx * dx + 1 + dz * dz);
    const lightLength = Math.sqrt(1 + 2.25 + 1);
    const lambert = (dx + 1.5 + dz) / (normalLength * lightLength);
    return 0.45 + 0.7 * Math.max(lambert, 0);
  }
}
