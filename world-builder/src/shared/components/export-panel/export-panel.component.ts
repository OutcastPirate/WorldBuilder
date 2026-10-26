import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import { ExportOptions, ExportOutcome, ExportService } from '../../services/export.service';
import { ObjectsService } from '../../services/objects.service';
import { PlacementLayerService } from '../../services/placement-layer.service';

type Format = 'glb' | 'obj' | 'terrain';

interface Status {
  text: string;
  error: boolean;
}

@Component({
  selector: 'app-export-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-panel.component.html',
  styleUrl: './export-panel.component.scss',
})
export class ExportPanelComponent implements OnInit, OnDestroy {
  constructor(
    private exportService: ExportService,
    private placementLayer: PlacementLayerService,
    private objectsService: ObjectsService
  ) {}

  options: ExportOptions = {
    terrainSides: true,
    generatedObjects: true,
    handPlacedObjects: true,
    gpuInstancing: false,
  };
  generatedCount = 0;
  handPlacedCount = 0;
  exporting: Format | null = null;
  status: Status | null = null;

  private subscription!: Subscription;

  ngOnInit(): void {
    this.subscription = combineLatest([
      this.placementLayer.summary$,
      this.objectsService.objects$,
    ]).subscribe(([summary, objects]) => {
      this.generatedCount = Object.values(summary.counts).reduce((sum, n) => sum + (n ?? 0), 0);
      this.handPlacedCount = objects.length;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get ready(): boolean {
    return this.exportService.canExport();
  }

  async run(format: Format): Promise<void> {
    this.exporting = format;
    this.status = { text: 'Exporting…', error: false };
    try {
      const outcome =
        format === 'glb'
          ? await this.exportService.exportGlb(this.options)
          : format === 'obj'
            ? await this.exportService.exportObj(this.options)
            : await this.exportService.exportTerrainData(this.options);
      this.status = { text: describe(outcome), error: false };
    } catch (error) {
      console.error('Export failed:', error);
      this.status = { text: `Export failed: ${(error as Error).message ?? error}`, error: true };
    } finally {
      this.exporting = null;
    }
  }
}

function describe(outcome: ExportOutcome): string {
  const size = formatBytes(outcome.bytes);
  switch (outcome.result.kind) {
    case 'saved':
      return `Saved ${size} to ${outcome.result.path}`;
    case 'downloaded':
      return `Download started (${size}).`;
    case 'cancelled':
      return 'Export cancelled.';
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
