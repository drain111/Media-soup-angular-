import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionUser } from '../domain/session-user.js';
import { SESSION_COOKIE, SessionService } from '../services/session.service.js';

export type RequestWithUser = Request & { user: SessionUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly session: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const user = typeof token === 'string' ? await this.session.verify(token) : null;
    if (!user) throw new UnauthorizedException('Not authenticated');
    req.user = user;
    return true;
  }
}
