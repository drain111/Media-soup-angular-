import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AuthOAuthException } from '../errors/auth-oauth.exception.js';

@Catch(AuthOAuthException)
export class AuthOAuthExceptionFilter implements ExceptionFilter {
  catch(exception: AuthOAuthException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const { message, provider } = exception.getResponse() as { message: string; provider?: string };

    // URL-encode the message so it survives the redirect query string
    const encoded = encodeURIComponent(message);
    const q = provider ? `?provider=${encodeURIComponent(provider)}&message=${encoded}` : `?message=${encoded}`;

    res.status(HttpStatus.FOUND).redirect(`/auth/error${q}`);
  }
}
