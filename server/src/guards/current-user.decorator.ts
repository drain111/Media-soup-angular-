import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '../domain/session-user.js';
import type { RequestWithUser } from './session.guard.js';

/** Use only on routes protected by SessionGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => ctx.switchToHttp().getRequest<RequestWithUser>().user,
);
