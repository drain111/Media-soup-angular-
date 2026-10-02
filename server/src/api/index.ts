import { randomBytes } from 'node:crypto';
import express from 'express';
import { GoogleAuthProvider } from '../adapters/auth/google.js';
import type { AuthenticatedUser, AuthProvider } from '../ports/authProvider.js';
import { FakeAuthProvider } from '../adapters/auth/fakeAdapter.js';

const isProd = process.env['NODE_ENV'] === 'production';

const fakeUsers: Record<string, AuthenticatedUser> = {
  alice: { provider: 'fake', subject: 'alice-sub', email: 'alice@example.com', emailVerified: true, name: 'Alice' },
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // ---- auth providers ----
  const providers: Record<string, AuthProvider> = {};
  const labels: Record<string, string> = { google: 'Google', fake: 'Fake (dev only)' };
  const { CLIENTID, CLIENTSECRET, REDIRECTURI } = process.env;
  if (CLIENTID && CLIENTSECRET && REDIRECTURI) {
    providers['google'] = new GoogleAuthProvider({
      clientId: CLIENTID,
      clientSecret: CLIENTSECRET,
      redirectUri: REDIRECTURI,
    });
  }
  if (!isProd) {
    providers['fake'] = new FakeAuthProvider(fakeUsers); // never enabled in production
  }

  async function beginLogin(providerId: string, res: express.Response): Promise<string | null> {
    const provider = providers[providerId];
    if (!provider) return null;
    const state = randomBytes(16).toString('hex');
    
    return provider.getLoginUrl(state);
  }



  // ---- auth routes ----
  app.get('/api/auth/providers', (_req, res) => {
    res.json(Object.keys(providers).map((id) => ({ id, label: labels[id] ?? id })));
  });

  app.get('/api/auth/:provider/login-url', async (req, res) => {
    const url = await beginLogin(req.params.provider, res);
    if (!url) {
      res.status(404).json({ message: 'Unknown provider' });
      return;
    }
    res.json({ url });
  });

  app.get('/api/auth/:provider/redirect', async (req, res) => {
    const url = await beginLogin(req.params.provider, res);
    if (!url) {
      res.status(404).json({ message: 'Unknown provider' });
      return;
    }
    res.redirect(url);
  });

  app.get('/api/auth/:provider/callback', async (req, res) => {
    const provider = providers[req.params.provider];
    const code = req.query['code'];
    const state = req.query['state'];
    
    res.redirect('/');
  });

  app.post('/api/auth/logout', (_req, res) => {
    //res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  // ---- API fallbacks (must stay before the SSR handler) ----
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ message: 'Internal error' });
  });

  return app;
}