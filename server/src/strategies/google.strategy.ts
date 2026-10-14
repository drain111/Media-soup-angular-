import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthenticatedUser, AuthProvider, DiscoveryEndpoint } from '../domain/auth-provider.js';

export class GoogleAuthProvider implements AuthProvider {
  readonly id = 'google';
  private discovery?: Promise<DiscoveryEndpoint>;

constructor(private readonly cfg: { clientId: string; clientSecret: string; redirectUri: string }) {
  void this.getDiscovery().catch(() => {}); // si falla, la caché se limpia y se reintenta en el primer login
}
  private getDiscovery(): Promise<DiscoveryEndpoint> {
    this.discovery ??= fetch('https://accounts.google.com/.well-known/openid-configuration')
      .then(async (r) => {
        if (!r.ok) throw new Error('Discovery failed');
        return (await r.json()) as DiscoveryEndpoint;
      })
      .catch((err) => {
        this.discovery = undefined; // do not cache a failure forever
        throw err;
      });
    return this.discovery;
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
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const { id_token } = (await tokenRes.json()) as { id_token: string };

    const { payload } = await jwtVerify(id_token, createRemoteJWKSet(new URL(d.jwks_uri)), {
      issuer: [d.issuer, 'accounts.google.com'],
      audience: this.cfg.clientId,
    });
    if (!payload.sub || typeof payload['email'] !== 'string') throw new Error('Google token without sub/email');

    return {
      provider: 'google',
      subject: payload.sub,
      email: payload['email'],
      emailVerified: payload['email_verified'] === true,
      name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
    };
  }
}
