import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { RequestHandler } from 'express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  console.log('NODE_ENV:', process.env['NODE_ENV']);
  console.log('PUBLIC_URL:', process.env['PUBLIC_URL']);
  console.log('PORT:', process.env['PORT']);

  if (process.env['NODE_ENV'] === 'production') {
    // Built by `npm run build:client`. Importing the bundle does not start its own server.
    const here = path.dirname(fileURLToPath(import.meta.url)); // server/dist
    console.log('Server dist:', here);
    const ssrEntry = path.resolve(here, '../../client/dist/client/server/server.mjs');
    console.log('SSR entry:', ssrEntry);
    const { reqHandler } = (await import(pathToFileURL(ssrEntry).href)) as { reqHandler: RequestHandler };
    // Registered before Nest's routes, so /api must be skipped explicitly.
    const ssr: RequestHandler = (req, res, next) =>
      req.path.startsWith('/api') ? next() : reqHandler(req, res, next);
    app.use(ssr);
  }

  await app.listen(Number(process.env['PORT'] ?? 3001));
}

await bootstrap();
