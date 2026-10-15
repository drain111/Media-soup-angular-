import type { AuthProvider } from '../domain/auth-provider.js';
import { FakeAuthProvider } from './fake-auth.strategy.js';
import { GoogleAuthProvider } from './google.strategy.js';
import { CustomAuthProvider } from './custom-auth.strategy.js';
type ProviderSetter = (providers: Map<string, AuthProvider>, env: NodeJS.ProcessEnv) => void;

function setGoogleProviders(providers : Map<string, AuthProvider>, env: NodeJS.ProcessEnv) : void {
  const { CLIENTIDGOOGLE, CLIENTSECRETGOOGLE, PUBLIC_URL } = env;
  if(CLIENTIDGOOGLE && CLIENTSECRETGOOGLE && PUBLIC_URL) {
    providers.set('google', new GoogleAuthProvider({ clientId: CLIENTIDGOOGLE, clientSecret: CLIENTSECRETGOOGLE, redirectUri: `${PUBLIC_URL}/api/auth/google/callback` }));
  }
  else {
    throw new Error('Added google but forgot to add clientid, secret or url');
  }
}

function setCustomProviders(providers : Map<string, AuthProvider>, env: NodeJS.ProcessEnv) : void {
  const { CLIENTIDCUSTOM, CLIENTSECRETCUSTOM, PUBLIC_URL, ISSUER } = env;
  if(CLIENTIDCUSTOM && CLIENTSECRETCUSTOM && PUBLIC_URL && ISSUER) {
    providers.set('custom', new CustomAuthProvider({ clientId: CLIENTIDCUSTOM, clientSecret: CLIENTSECRETCUSTOM, redirectUri: `${PUBLIC_URL}/api/auth/custom/callback`, issuer:ISSUER }));
  }
  else {
    throw new Error('Added custom but forgot to add clientid, secret or url');
  }
}

const providerFunctions : Record<string, ProviderSetter> = {
  "google": setGoogleProviders,
  "custom": setCustomProviders
}

/** Builds the enabled providers from the environment. Registered under AUTH_PROVIDERS. */
export function createAuthProviders(env: NodeJS.ProcessEnv = process.env): ReadonlyMap<string, AuthProvider> {
  const providers = new Map<string, AuthProvider>();

  const {AUTH_PROVIDERS} = env;
  
  if (process.env['NODE_ENV'] !== 'production') {
    providers.set('fake', new FakeAuthProvider());
  }

  if (AUTH_PROVIDERS) {
    AUTH_PROVIDERS.split(',').map((p: string) => p.trim().toLowerCase()).forEach((provider: string) => {
      if(!provider) return;
      const fn = providerFunctions[provider];
      if(fn) {
        fn(providers, env);
      } else {
        throw new Error(`Unknown auth provider: ${provider}`);
      }
    });
  }

  return providers;
}
