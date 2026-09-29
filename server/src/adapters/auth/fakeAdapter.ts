import { AuthProvider, AuthenticatedUser  } from "../../ports/authProvider.js";
// adapters/auth/FakeAuthProvider.ts
export class FakeAuthProvider implements AuthProvider {
  readonly id = 'fake';
  constructor(private users: Record<string, AuthenticatedUser>) {}

  async getLoginUrl(state: string) {
    // Redirects straight to your own callback, "code" is just a user key
    return `/api/auth/fake/callback?code=alice&state=${state}`;
  }

  async handleCallback({ code }: { code: string }) {
    const user = this.users[code];
    if (!user) throw new Error('Unknown fake user');
    return user;
  }
}