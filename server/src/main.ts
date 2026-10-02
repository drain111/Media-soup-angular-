import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { RequestHandler } from 'express';
import { createApp } from './api/index.js';

const isProd = process.env['NODE_ENV'] === 'production';

const app = createApp();

if (isProd) {
  // Built by `npm run build:client`. Importing it does NOT start its own server:
  // the generated file only listens when it is the main module.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const ssrEntry = path.resolve(here, '../../client/dist/client/server/server.mjs');
  const { reqHandler } = (await import(pathToFileURL(ssrEntry).href)) as { reqHandler: RequestHandler };
  app.use(reqHandler); // static files from /browser + SSR for every non-API URL
}

const port = Number(process.env['PORT'] ?? 3001);
http.createServer(app).listen(port, () => {
  console.log(`Web server listening on http://localhost:${port} (${isProd ? 'API + SSR' : 'API only'})`);
});