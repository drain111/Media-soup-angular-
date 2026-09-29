// domain/auth/AuthProvider.ts
export interface AuthenticatedUser {
  provider: string;      // 'google' | 'fake' | 'microsoft' | ...
  subject: string;       // stable id from the provider (the `sub` claim)
  email: string;
  emailVerified: boolean;
  name?: string;
}

export interface AuthProvider {
  readonly id: string;
  /** URL to redirect the browser to. The provider stores/returns `state`. */
  getLoginUrl(state: string): Promise<string>;
  /** Exchange the callback params for a verified user. */
  handleCallback(params: { code: string }): Promise<AuthenticatedUser>;
}