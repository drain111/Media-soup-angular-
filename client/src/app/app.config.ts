import { ApplicationConfig, effect, inject, PLATFORM_ID, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { routes } from './app.routes';
import { apiOriginInterceptor } from './api-origin';
import { AuthProvidersService } from './services/auth-providers.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiOriginInterceptor])),
    provideClientHydration(),
    provideAppInitializer(() => {
      const auth = inject(AuthProvidersService);
      return auth.authCheckPromise();

    }),
  ],
};