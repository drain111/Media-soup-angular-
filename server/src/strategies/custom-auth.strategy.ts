// adapters/auth/custom-auth.strategy.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthenticatedUser, AuthProvider, DiscoveryEndpoint } from '../domain/auth-provider.js';

export interface CustomAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer: string; // e.g. https://sso.example.com/realms/main
}

export class CustomAuthProvider implements AuthProvider {
  readonly id = 'custom';

  private discovery?: Promise<DiscoveryEndpoint>;
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly cfg: CustomAuthConfig) {
    if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri || !cfg.issuer) {
      throw new Error('CustomAuthProvider: missing clientId, clientSecret, redirectUri, or issuer');
    }
  }

  /** Call once at startup so a bad issuer/config fails fast instead of on first login. */
  async init(): Promise<void> {
    await this.getDiscovery();
  }

  private getDiscovery(): Promise<DiscoveryEndpoint> {
    this.discovery ??= fetch(`${this.cfg.issuer}/.well-known/openid-configuration`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Discovery failed: ${r.status} ${r.statusText}`);
        const doc = (await r.json()) as DiscoveryEndpoint;
        if (doc.issuer !== this.cfg.issuer) {
          throw new Error(`Issuer mismatch: configured "${this.cfg.issuer}", discovery document says "${doc.issuer}"`);
        }
        return doc;
      })
      .catch((err) => {
        this.discovery = undefined; // allow retry on next call instead of caching the failure
        throw err;
      });
    return this.discovery;
  }

  private async getJwks(jwksUri: string) {
    this.jwks ??= createRemoteJWKSet(new URL(jwksUri));
    return this.jwks;
  }

  async getLoginUrl(state: string): Promise<string> {
    const { authorization_endpoint } = await this.getDiscovery();
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    return `${authorization_endpoint}?${params}`;
  }

  async handleCallback({ code }: { code: string }): Promise<AuthenticatedUser> {
    const d = await this.getDiscovery();

    const tokenRes = await fetch(d.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        redirect_uri: this.cfg.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status} ${tokenRes.statusText}`);

    const { id_token } = (await tokenRes.json()) as { id_token?: string };
    if (!id_token) throw new Error('Token response missing id_token');

    const jwks = await this.getJwks(d.jwks_uri);
    const { payload } = await jwtVerify(id_token, jwks, {
      issuer: d.issuer,
      audience: this.cfg.clientId,
    });

    if (!payload.sub || typeof payload['email'] !== 'string') {
      throw new Error('Custom token missing sub or email claim');
    }

    return {
      provider: 'custom',
      subject: payload.sub,
      email: payload['email'],
      emailVerified: payload['email_verified'] === true,
      name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
    };
  }
}