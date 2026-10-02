import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_ORIGIN } from './api-origin';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // SSR talks to the API process directly (same machine), not through Nginx.
    { provide: API_ORIGIN, useValue: process.env['API_ORIGIN'] ?? 'http://127.0.0.1:3001' },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);