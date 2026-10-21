import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, REQUEST, inject } from '@angular/core';

/**
 * Origin prepended to relative /api requests.
 * Empty in the browser (same-origin through Nginx / the dev proxy);
 * the server config overrides it so SSR calls the API directly on loopback.
 */
export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN', {
  providedIn: 'root',
  factory: () => '',
});

export const apiOriginInterceptor: HttpInterceptorFn = (req, next) => {
  const origin = inject(API_ORIGIN);
  if (!origin || !req.url.startsWith('/api')) return next(req);

  const incomingReq = inject(REQUEST, { optional: true });
  const cookie = incomingReq?.headers.get('cookie');

  let headers = req.headers.delete('host');
  if (cookie) headers = headers.set('cookie', cookie);

  return next(req.clone({ url: origin + req.url, headers }));
};