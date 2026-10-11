import { ForbiddenException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AUTH_PROVIDERS } from '../domain/auth-provider.js';
import type { AuthenticatedUser, AuthProvider } from '../domain/auth-provider.js';

const LABELS: Record<string, string> = { google: 'Google', fake: 'Fake (dev only)' };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(@Inject(AUTH_PROVIDERS) private readonly providers: ReadonlyMap<string, AuthProvider>) {}

  getProviders(): Array<{ id: string; label: string }> {
    return [...this.providers.keys()].map((id) => ({ id, label: LABELS[id] ?? id }));
  }

  private get(providerId: string): AuthProvider {
    const provider = this.providers.get(providerId);
    if (!provider) throw new NotFoundException('Unknown auth provider');
    return provider;
  }

  getLoginUrl(providerId: string, state: string): Promise<string> {
    return this.get(providerId).getLoginUrl(state);
  }

  async handleCallback(providerId: string, code: string): Promise<AuthenticatedUser> {
    const provider = this.get(providerId);
    let user: AuthenticatedUser;
    try {
      user = await provider.handleCallback({ code });
    } catch (err) {
      this.logger.warn(`Login failed for ${providerId}: ${err instanceof Error ? err.message : err}`);
      throw new UnauthorizedException('Login failed');
    }
    if (!user.emailVerified) throw new ForbiddenException('Email not verified');
    return user;
  }
}
