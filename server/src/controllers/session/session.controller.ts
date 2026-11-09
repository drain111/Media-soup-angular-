import { Controller, Delete, Get, HttpCode, HttpStatus, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { SessionUser } from '../../domain/session-user.js';
import { CurrentUser } from '../../guards/current-user.decorator.js';
import { SessionGuard } from '../../guards/session.guard.js';
import { SESSION_COOKIE, SessionService } from '../../services/session.service.js';

@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /** Who is logged in? 401 when there is no valid login cookie. */
  @Get()
  @UseGuards(SessionGuard)
  current(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }

  /** Get the session token (for WebSocket JWT auth). 401 when not logged in. */
  @Get('token')
  @UseGuards(SessionGuard)
  token(@CurrentUser() user: SessionUser): { token: string } {
    if (!user.token) throw new UnauthorizedException();
    return { token: user.token };
  }

  /** Log out. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.sessionService.clearCookieOptions());
  }
}
