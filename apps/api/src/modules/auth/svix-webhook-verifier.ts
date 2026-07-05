import type { IncomingHttpHeaders } from 'node:http';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Webhook } from 'svix';

import { env } from '../../config/env.js';
import { WebhookVerifier, type ClerkWebhookEvent } from './webhook-verifier.js';

@Injectable()
export class SvixWebhookVerifier extends WebhookVerifier {
  verify(payload: Buffer | undefined, headers: IncomingHttpHeaders): ClerkWebhookEvent {
    if (!env.CLERK_WEBHOOK_SECRET) {
      throw new Error('CLERK_WEBHOOK_SECRET is not configured');
    }
    if (!payload) {
      throw new BadRequestException('missing raw body');
    }
    try {
      const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
      return wh.verify(payload.toString('utf8'), {
        'svix-id': String(headers['svix-id'] ?? ''),
        'svix-timestamp': String(headers['svix-timestamp'] ?? ''),
        'svix-signature': String(headers['svix-signature'] ?? ''),
      }) as ClerkWebhookEvent;
    } catch {
      throw new UnauthorizedException('invalid webhook signature');
    }
  }
}
