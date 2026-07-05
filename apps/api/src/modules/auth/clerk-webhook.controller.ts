import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { UsersService } from '../users/users.service.js';
import { WebhookVerifier, type ClerkWebhookEvent } from './webhook-verifier.js';

function primaryEmail(data: ClerkWebhookEvent['data']): string {
  const primary = data.email_addresses?.find((a) => a.id === data.primary_email_address_id);
  return (
    primary?.email_address ??
    data.email_addresses?.[0]?.email_address ??
    // users.email เป็น NOT NULL — Clerk ส่ง user ไม่มีอีเมลได้ (เช่น OAuth บางแบบ)
    `${data.id}@no-email.clerk`
  );
}

@Controller('webhooks')
export class ClerkWebhookController {
  constructor(
    private readonly verifier: WebhookVerifier,
    private readonly users: UsersService,
  ) {}

  @Post('clerk')
  @HttpCode(200)
  async handle(@Req() req: RawBodyRequest<Request>) {
    const event = this.verifier.verify(req.rawBody, req.headers);

    // upsert/soft-delete โดย clerk_id → ยิงซ้ำกี่ครั้งผลเท่าเดิม (idempotent)
    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await this.users.upsertFromClerk({
          clerkId: event.data.id,
          email: primaryEmail(event.data),
        });
        break;
      case 'user.deleted':
        await this.users.softDeleteByClerkId(event.data.id);
        break;
      default:
        break; // event อื่นยังไม่สนใจใน MVP
    }

    return { received: true };
  }
}
