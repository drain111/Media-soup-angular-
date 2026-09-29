// adapters/auth/GoogleAuthProvider.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthProvider, AuthenticatedUser  } from "../../ports/authProvider.js";
interface endPoint {
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
    issuer: string;  
}
export class GoogleAuthProvider implements AuthProvider {
  readonly id = 'google';
  private discovery?: Promise<endPoint>;
  
  constructor(private cfg: { clientId: string; clientSecret: string; redirectUri: string }) {}

  private getDiscovery(): Promise<endPoint> {
    // cached: you were fetching this on every login before
    this.discovery ??= fetch('https://accounts.google.com/.well-known/openid-configuration')
      .then(async r => {
        if (!r.ok) throw new Error('Discovery failed');
        return (await r.json()) as endPoint;
      });
    return this.discovery;
  }

  async getLoginUrl(state: string) {
    const authorization_endpoint = await this.getDiscovery();
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    return `${authorization_endpoint}?${params}`;
  }

  async handleCallback({ code }: { code: string }) {
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

    return {
      provider: 'google',
      subject: payload.sub!,
      email: String(payload.email),
      emailVerified: payload.email_verified === true,
      name: payload.name as string | undefined,
    };
  }
}