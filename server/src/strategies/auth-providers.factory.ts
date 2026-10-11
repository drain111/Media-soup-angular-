import type { AuthProvider } from '../domain/auth-provider.js';
import { FakeAuthProvider } from './fake-auth.strategy.js';
import { GoogleAuthProvider } from './google.strategy.js';

/** Builds the enabled providers from the environment. Registered under AUTH_PROVIDERS. */
export function createAuthProviders(env: NodeJS.ProcessEnv = process.env): ReadonlyMap<string, AuthProvider> {
  const providers = new Map<string, AuthProvider>();

  const { CLIENTID, CLIENTSECRET, REDIRECTURI } = env;
  if (CLIENTID && CLIENTSECRET && REDIRECTURI) {
    providers.set('google', new GoogleAuthProvider({ clientId: CLIENTID, clientSecret: CLIENTSECRET, redirectUri: REDIRECTURI }));
  }
  if (env['NODE_ENV'] !== 'production') {
    providers.set('fake', new FakeAuthProvider());
  }
  return providers;
}
