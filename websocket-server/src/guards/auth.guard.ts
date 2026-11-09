import { Injectable, Logger } from '@nestjs/common';
import { jwtVerify } from 'jose';
import { Socket } from 'socket.io';
import { SessionUser } from '../domain/session-user.js';
const isProd = () => process.env['NODE_ENV'] === 'production';

const logger = new Logger('AuthGuard');

@Injectable()
export class AuthGuard {
  private readonly key: Uint8Array;

  constructor() {
    const secret = process.env['SESSION_SECRET'] ?? (isProd() ? '' : 'dev-only-secret-change-me-0123456789abcdef');
    if (secret.length < 32) throw new Error('SESSION_SECRET must be set (at least 32 characters)');
    this.key = new TextEncoder().encode(secret);
  }

  async verify(token: string): Promise<SessionUser | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      const loginKey = payload['loginKey'];
      if (!payload.sub || typeof loginKey !== 'string') return undefined;
      const name = payload['name'];
      return { id: payload.sub, loginKey, name: typeof name === 'string' ? name : undefined };
    } catch (_e) {
      logger.warn('JWT verification failed ' + _e);
      return undefined;
    }
  }

  getToken(socket: Socket): string | null {
    const auth = socket.handshake.auth as Record<string, string> | undefined;
    if (auth?.token) return auth.token;

    const query = socket.handshake.query as Record<string, string>;
    if (query.token) return query.token;

    return null;
  }
}
