import { createApp } from './api/index.js';

async function main() {

  const app = createApp();            // inject, don't import globally
  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);   // container exits, `docker logs` shows the config error
});