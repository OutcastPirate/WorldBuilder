import { Injectable, OnDestroy } from '@angular/core';
import { TerrainConfig, TexturingConfig } from '../generation/config';
import { generateHeightmap, Heightmap } from '../generation/heightmap';
import { placeObjects, PlacementInput, PlacementResult } from '../generation/placement';
import { bakeAlbedo, ImageDataLike } from '../generation/texturing';
import { WorkerRequest, WorkerResponse } from '../generation/worker-messages';

// Omit applied to each member of the union, so each keeps its own fields.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type RequestBody = DistributiveOmit<WorkerRequest, 'id'>;

interface PendingRequest {
  resolve: (response: WorkerResponse) => void;
  reject: (error: unknown) => void;
}

// Runs generation steps in a Web Worker (falls back to the main thread where
// workers are unavailable).
@Injectable({
  providedIn: 'root',
})
export class GenerationWorkerService implements OnDestroy {
  private worker?: Worker;
  private nextId = 0;
  private pending = new Map<number, PendingRequest>();

  async generateHeightmap(config: TerrainConfig): Promise<Heightmap> {
    if (!this.getWorker()) return generateHeightmap(config);
    const response = await this.request({ type: 'heightmap', config });
    if (response.type !== 'heightmap') throw new Error('Unexpected worker response');
    return response.heightmap;
  }

  // Bakes the terrain colour texture; returns RGBA pixels of size × size.
  async bakeAlbedo(
    heightmap: Heightmap,
    texturing: Pick<TexturingConfig, 'thresholds' | 'blendWidth'>,
    zoneTextures: ImageDataLike[],
    size: number
  ): Promise<Uint8ClampedArray> {
    if (!this.getWorker()) {
      return bakeAlbedo(heightmap, texturing, zoneTextures, size);
    }
    const response = await this.request({
      type: 'bake',
      heightmap,
      texturing: { thresholds: texturing.thresholds, blendWidth: texturing.blendWidth },
      zoneTextures,
      size,
    });
    if (response.type !== 'bake') throw new Error('Unexpected worker response');
    return response.pixels;
  }

  async placeObjects(input: PlacementInput): Promise<PlacementResult> {
    if (!this.getWorker()) return placeObjects(input);
    const response = await this.request({ type: 'placement', ...input });
    if (response.type !== 'placement') throw new Error('Unexpected worker response');
    return response.result;
  }

  // Small heightmap of the same terrain for the live thumbnail; fast enough
  // to run synchronously on every slider change.
  previewHeightmap(config: TerrainConfig, size = 128): Heightmap {
    return generateHeightmap(config, size);
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
  }

  private request(body: RequestBody): Promise<WorkerResponse> {
    const worker = this.getWorker()!;
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ ...body, id });
    });
  }

  private getWorker(): Worker | undefined {
    if (typeof Worker === 'undefined') return undefined;
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../generation/generation.worker', import.meta.url),
        { type: 'module' }
      );
      this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        this.pending.get(data.id)?.resolve(data);
        this.pending.delete(data.id);
      };
      this.worker.onerror = (error) => {
        this.pending.forEach((request) => request.reject(error));
        this.pending.clear();
      };
    }
    return this.worker;
  }
}
