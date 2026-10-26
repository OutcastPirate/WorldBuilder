import { ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  // Hash URLs (#/terrainMenu) work on any static web host without server
  // rewrites, as well as in Electron.
  providers: [provideRouter(routes, withHashLocation())],
};
