import { PlacementConfig, TerrainConfig, TexturingConfig } from './config';
import { Heightmap } from './heightmap';
import { PlacementResult } from './placement';
import { ImageDataLike } from './texturing';

// Messages exchanged with generation.worker.ts. Kept outside the worker file
// so the app can import them without pulling in the worker's typings.
export type WorkerRequest =
  | { id: number; type: 'heightmap'; config: TerrainConfig }
  | {
      id: number;
      type: 'bake';
      heightmap: Heightmap;
      texturing: Pick<TexturingConfig, 'thresholds' | 'blendWidth'>;
      zoneTextures: ImageDataLike[];
      size: number;
    }
  | {
      id: number;
      type: 'placement';
      heightmap: Heightmap;
      worldSize: number;
      heightScale: number;
      placement: PlacementConfig;
    };

export type WorkerResponse =
  | { id: number; type: 'heightmap'; heightmap: Heightmap }
  | { id: number; type: 'bake'; size: number; pixels: Uint8ClampedArray }
  | { id: number; type: 'placement'; result: PlacementResult };
