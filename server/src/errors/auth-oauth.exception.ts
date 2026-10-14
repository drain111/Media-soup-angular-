import { HttpException, HttpStatus } from '@nestjs/common';

/** OAuth flow exception that redirects the browser to /auth/error instead of returning JSON. */
export class AuthOAuthException extends HttpException {
  constructor(message: string, provider?: string) {
    super({ message, provider }, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
