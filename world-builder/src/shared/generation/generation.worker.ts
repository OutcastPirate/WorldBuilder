/// <reference lib="webworker" />

import { generateHeightmap } from './heightmap';
import { placeObjects } from './placement';
import { bakeAlbedo } from './texturing';
import { WorkerRequest, WorkerResponse } from './worker-messages';

// Runs the heavy generation steps off the main thread (a 513² heightmap with
// 8 octaves, a 2048² texture bake or placing thousands of objects would
// otherwise freeze the UI).
addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  let response: WorkerResponse;
  let transfer: Transferable[];

  switch (data.type) {
    case 'heightmap': {
      const heightmap = generateHeightmap(data.config);
      response = { id: data.id, type: 'heightmap', heightmap };
      transfer = [heightmap.data.buffer];
      break;
    }
    case 'bake': {
      const pixels = bakeAlbedo(data.heightmap, data.texturing, data.zoneTextures, data.size);
      response = { id: data.id, type: 'bake', size: data.size, pixels };
      transfer = [pixels.buffer];
      break;
    }
    case 'placement': {
      const result = placeObjects(data);
      response = { id: data.id, type: 'placement', result };
      transfer = [];
      break;
    }
  }
  postMessage(response, transfer);
});
