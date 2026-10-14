import { randomBytes, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Controller, Get, HttpStatus, Param, Query, Redirect, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CallbackQueryDto } from '../../dto/callback-query.dto.js';
import { AuthService } from '../../services/auth.service.js';
import { SESSION_COOKIE, SessionService } from '../../services/session.service.js';
import { AuthOAuthException } from '../../errors/auth-oauth.exception.js';

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_PATH = '/api/auth'; // the callback lives under this path
//helps test the response time of buttons and behaviour when loading, to prevent double clicks and make it seem fast
//const sleep = (ms : number) => new Promise((resolve) => setTimeout(resolve, ms));
function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Get('providers')
  getProviders() {
    return this.authService.getProviders();
  }

  @Get(':provider/login-url')
  async getLoginUrl(@Param('provider') providerId: string, @Res({ passthrough: true }) res: Response) {
    return { url: await this.begin(providerId, res) };
  }

  @Get(':provider/redirect')
  @Redirect()
  async redirect(@Param('provider') providerId: string, @Res({ passthrough: true }) res: Response) {
    return { url: await this.begin(providerId, res), statusCode: HttpStatus.FOUND };
  }
  @Redirect('/', HttpStatus.FOUND)
  @Get(':provider/callback')
  async callback(
    @Param('provider') providerId: string,
    @Query() query: CallbackQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {

    const expected: unknown = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_STATE_PATH });
    if (typeof expected !== 'string' || !sameString(expected, query.state)) {
      throw new BadRequestException('Invalid login state');
    }

    let user;
    try {
      user = await this.authService.handleCallback(providerId, query.code);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown authentication error';
      throw new AuthOAuthException(message, providerId);
    }
    const token = await this.sessionService.create(user);
    res.cookie(SESSION_COOKIE, token, this.sessionService.cookieOptions());
  }

  /** Generates the CSRF `state`, keeps it in a short-lived cookie and returns the provider URL. */
  private async begin(providerId: string, res: Response): Promise<string> {
    const state = randomBytes(16).toString('hex');
    const url = await this.authService.getLoginUrl(providerId, state); // throws 404 for unknown providers

    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(process.env['PUBLIC_URL']!).protocol === 'https:',
      maxAge: 10 * 60 * 1000,
      path: OAUTH_STATE_PATH,
    });
    return url;
  }
}
