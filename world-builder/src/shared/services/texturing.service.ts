import { Injectable, OnDestroy } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  from,
  map,
  Observable,
  Subscription,
  switchMap,
} from 'rxjs';
import { generateBuiltinTexture } from '../generation/builtin-textures';
import {
  TerrainConfig,
  TexturingConfig,
  ZoneMaterial,
  ZoneTexture,
} from '../generation/config';
import { ImageDataLike } from '../generation/texturing';
import { GenerationConfigService } from './generation-config.service';
import { GenerationWorkerService } from './generation-worker.service';
import { TerrainMeshService } from './terrain-mesh.service';

const UPLOAD_MAX_SIZE = 512;

// Keeps the terrain's colour texture in sync with the texturing settings:
// whenever they or the terrain change, the texture is re-baked in the worker.
@Injectable({
  providedIn: 'root',
})
export class TexturingService implements OnDestroy {
  constructor(
    private configService: GenerationConfigService,
    private terrainMesh: TerrainMeshService,
    private workerService: GenerationWorkerService
  ) {}

  private subscription?: Subscription;
  private sources = new Map<string, Promise<CanvasImageSource>>();
  private _baking = new BehaviorSubject<boolean>(false);

  baking$: Observable<boolean> = this._baking.asObservable();

  start(): void {
    if (this.subscription) return;
    const texturing$ = this.configService.config$.pipe(
      map((config) => config.texturing),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );
    const terrain$ = this.terrainMesh.builtConfig$.pipe(
      filter((config): config is TerrainConfig => config !== null)
    );

    this.subscription = combineLatest([texturing$, terrain$])
      .pipe(
        // Colour pickers and threshold drags fire continuously.
        debounceTime(80),
        // A newer change cancels waiting for an older bake.
        switchMap(([texturing, terrain]) => from(this.bake(texturing, terrain)))
      )
      .subscribe((result) => {
        if (result) this.terrainMesh.setAlbedo(result.pixels, result.size);
        this._baking.next(false);
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  // Draws a zone's tinted texture (2 × 2 repeats) for the settings panel.
  async renderSwatch(zone: ZoneMaterial, canvas: HTMLCanvasElement): Promise<void> {
    const context = canvas.getContext('2d');
    if (!context) return;
    const { width, height } = canvas;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = zone.color;
    context.fillRect(0, 0, width, height);
    if (!zone.texture) return;

    const source = await this.getSource(zone.texture);
    context.clearRect(0, 0, width, height);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        context.drawImage(source, (x * width) / 2, (y * height) / 2, width / 2, height / 2);
      }
    }
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = zone.color;
    context.fillRect(0, 0, width, height);
  }

  // Turns an uploaded image into a zone texture: downscaled to at most
  // 512 px and stored as a JPEG data URL so presets stay self-contained.
  async importImage(file: File): Promise<ZoneTexture> {
    const url = URL.createObjectURL(file);
    try {
      const image = await this.loadImage(url);
      const scale = Math.min(1, UPLOAD_MAX_SIZE / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d')!;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return {
        type: 'image',
        name: file.name,
        dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private async bake(
    texturing: TexturingConfig,
    terrain: TerrainConfig
  ): Promise<{ pixels: Uint8ClampedArray; size: number } | null> {
    const heightmap = this.terrainMesh.getHeightmap();
    if (!heightmap) return null;
    this._baking.next(true);
    try {
      // About 8 px per metre on the default 128 m terrain.
      const size = terrain.resolution >= 513 ? 2048 : 1024;
      const zoneTextures = await Promise.all(
        texturing.zones.map((zone) => this.prepareZoneTexture(zone, size, terrain.worldSize))
      );
      const pixels = await this.workerService.bakeAlbedo(heightmap, texturing, zoneTextures, size);
      return { pixels, size };
    } catch (error) {
      console.error('Texture bake failed:', error);
      return null;
    }
  }

  // Tints the zone texture with its colour and scales it so one repeat
  // covers `tileSize` metres of the baked texture.
  private async prepareZoneTexture(
    zone: ZoneMaterial,
    bakeSize: number,
    worldSize: number
  ): Promise<ImageDataLike> {
    const tilePixels = zone.texture
      ? Math.min(Math.max(Math.round((zone.tileSize * bakeSize) / worldSize), 2), 1024)
      : 1;
    const canvas = document.createElement('canvas');
    canvas.width = tilePixels;
    canvas.height = tilePixels;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;

    if (zone.texture) {
      context.imageSmoothingQuality = 'high';
      context.drawImage(await this.getSource(zone.texture), 0, 0, tilePixels, tilePixels);
      context.globalCompositeOperation = 'multiply';
    }
    context.fillStyle = zone.color;
    context.fillRect(0, 0, tilePixels, tilePixels);
    return context.getImageData(0, 0, tilePixels, tilePixels);
  }

  private getSource(texture: ZoneTexture): Promise<CanvasImageSource> {
    const key = texture.type === 'builtin' ? `builtin:${texture.id}` : texture.dataUrl;
    let source = this.sources.get(key);
    if (!source) {
      source =
        texture.type === 'builtin'
          ? Promise.resolve(this.builtinCanvas(texture.id))
          : this.loadImage(texture.dataUrl);
      this.sources.set(key, source);
    }
    return source;
  }

  private builtinCanvas(id: Extract<ZoneTexture, { type: 'builtin' }>['id']): HTMLCanvasElement {
    const image = generateBuiltinTexture(id);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')!.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    return canvas;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The image could not be read.'));
      image.src = src;
    });
  }
}
