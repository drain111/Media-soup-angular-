import type { AuthenticatedUser, AuthProvider } from '../domain/auth-provider.js';

const defaultUsers: Record<string, AuthenticatedUser> = {
  alice: { provider: 'fake', subject: 'alice-sub', email: 'alice@example.com', emailVerified: true, name: 'Alice' },
};

/** Dev-only provider: "code" is just a user key. Never registered in production. */
export class FakeAuthProvider implements AuthProvider {
  readonly id = 'fake';
  constructor(private readonly users: Record<string, AuthenticatedUser> = defaultUsers) {}

  async getLoginUrl(state: string): Promise<string> {
    return `/api/auth/fake/callback?code=alice&state=${encodeURIComponent(state)}`;
  }

  async handleCallback({ code }: { code: string }): Promise<AuthenticatedUser> {
    const user = Object.hasOwn(this.users, code) ? this.users[code] : undefined;
    if (!user) throw new Error('Unknown fake user');
    return user;
  }
}
