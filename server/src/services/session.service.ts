import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import type { CookieOptions } from 'express';
import type { AuthenticatedUser } from '../domain/auth-provider.js';
import type { SessionUser } from '../domain/session-user.js';

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const isProd = () => process.env['NODE_ENV'] === 'production';

/**
 * The login session lives in a signed, httpOnly cookie (stateless JWT).
 * Nothing is stored server-side yet.
 */
@Injectable()
export class SessionService {
  private readonly key: Uint8Array;

  constructor() {
    const secret = process.env['SESSION_SECRET'] ?? (isProd() ? '' : 'dev-only-secret-change-me-0123456789abcdef');
    if (secret.length < 32) throw new Error('SESSION_SECRET must be set (at least 32 characters)');
    this.key = new TextEncoder().encode(secret);
  }

  create(user: AuthenticatedUser): Promise<string> {
    return new SignJWT({ email: user.email.toLowerCase(), name: user.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(`${user.provider}:${user.subject}`)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<SessionUser | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      const email = payload['email'];
      if (!payload.sub || typeof email !== 'string') return null;
      const name = payload['name'];
      return { id: payload.sub, email, name: typeof name === 'string' ? name : undefined };
    } catch {
      return null;
    }
  }

  cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: isProd(), path: '/', maxAge: SESSION_TTL_SECONDS * 1000 };
  }

  clearCookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: isProd(), path: '/' };
  }
}
