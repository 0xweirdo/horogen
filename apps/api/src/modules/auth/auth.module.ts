import { Global, Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module.js';
import { AuthGuard } from './auth.guard.js';
import { ClerkTokenVerifier } from './clerk-token-verifier.js';
import { ClerkWebhookController } from './clerk-webhook.controller.js';
import { SvixWebhookVerifier } from './svix-webhook-verifier.js';
import { TokenVerifier } from './token-verifier.js';
import { WebhookVerifier } from './webhook-verifier.js';

@Global()
@Module({
  imports: [UsersModule],
  controllers: [ClerkWebhookController],
  providers: [
    AuthGuard,
    { provide: TokenVerifier, useClass: ClerkTokenVerifier },
    { provide: WebhookVerifier, useClass: SvixWebhookVerifier },
  ],
  exports: [AuthGuard, TokenVerifier, WebhookVerifier],
})
export class AuthModule {}
