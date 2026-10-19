import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AuthOAuthExceptionFilter } from './filters/auth-oauth.exception-filter.js';
import { json } from 'express';
/** Shared by main.ts and the tests so both run with the same prefix, cookies and validation. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(json());  
  // Strip unknown properties but keep unknown arrays (class-transformer isn't installed).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AuthOAuthExceptionFilter());
}
