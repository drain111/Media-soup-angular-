import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AuthOAuthExceptionFilter } from './filters/auth-oauth.exception-filter.js';

/** Shared by main.ts and the tests so both run with the same prefix, cookies and validation. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Do NOT set forbidNonWhitelisted: Google adds scope/authuser/prompt to the callback URL.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AuthOAuthExceptionFilter());
}
