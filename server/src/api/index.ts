import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {  FakeAuthProvider } from '../adapters/auth/fakeAdapter.js';
import { GoogleAuthProvider } from '../adapters/auth/google.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../client/dist/client');
const state = process.env.STATE || "a";
const app = express();
app.use(express.json());
app.use(express.static(DIST));
//TODO, put these functions in separated ts files, to not make this one too large

// Fake auth users store (shared across fake auth endpoints)
const fakeUsers: Record<string, import('../ports/authProvider.js').AuthenticatedUser> = {
  alice: { provider: 'fake', subject: 'alice-sub', email: 'alice@example.com', emailVerified: true, name: 'Alice' },
};

export function createApp() {
  const app = express();
  app.use(express.json());

  const fakeAuth = new FakeAuthProvider(fakeUsers);

  // Fake auth endpoints (no network calls needed)
  app.get('/api/auth/fake/login-url', async (_req: express.Request, res: express.Response) => {
    try {
      const loginUrl = await fakeAuth.getLoginUrl(state);
      return res.status(200).json({ url: loginUrl });
    } catch {
      return res.status(500).json({ message: 'Failed to generate fake login URL' });
    }
  });

  app.get('/api/auth/fake/callback', async (req: express.Request, res: express.Response) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ message: 'Missing "code" query parameter' });
    try {
      const user = await fakeAuth.handleCallback({ code });
      // In production this would set a session cookie and redirect
      return res.status(200).json({ user, loginUrl: '/user-page' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(400).json({ message });
    }
  });

  // Google auth endpoints
  app.get('/api/auth/google/login-url', async (_req: express.Request, res: express.Response) => {
    const protocol = _req.protocol;
    const host = _req.hostname;
    const fullUrl = `${protocol}://${host}/api/auth/google/callback`; 
    const clientId = process.env.CLIENTID;
    const clientSecret = process.env.CLIENTSECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: 'Missing CLIENTID or CLIENTSECRET env vars' });
    }
    const authprovider = new GoogleAuthProvider({ clientId, clientSecret, redirectUri: fullUrl });
    try {
      const loginUrl = await authprovider.getLoginUrl(state);
      return res.status(200).json({ url: loginUrl });
    } catch {
      return res.status(500).json({ message: 'Failed to generate Google login URL' });
    }
  });

  app.get("/api/auth/google/callback", (_req, res) => res.sendFile(path.join(DIST, '/logedIn/index.html')));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

  return app;
}