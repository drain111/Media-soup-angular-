export interface AuthenticatedUser {
  provider: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export interface AuthProvider {
  readonly id: string;
  /** URL to redirect the browser to. */
  getLoginUrl(state: string): Promise<string>;
  /** Exchange the callback params for a verified user. */
  handleCallback(params: { code: string }): Promise<AuthenticatedUser>;
}

export interface DiscoveryEndpoint {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

/** Interfaces do not exist at runtime, so Nest injects the provider map by this token. */
export const AUTH_PROVIDERS = Symbol('AUTH_PROVIDERS');
