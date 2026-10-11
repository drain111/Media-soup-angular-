import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth/auth.controller.js';
import { SessionController } from './controllers/session/session.controller.js';
import { AUTH_PROVIDERS } from './domain/auth-provider.js';
import { AuthService } from './services/auth.service.js';
import { SessionService } from './services/session.service.js';
import { createAuthProviders } from './strategies/auth-providers.factory.js';

@Module({
  controllers: [AuthController, SessionController],
  providers: [
    AuthService,
    SessionService,
    { provide: AUTH_PROVIDERS, useFactory: () => createAuthProviders() },
  ],
})
export class AppModule {}
