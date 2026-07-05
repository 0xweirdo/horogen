import type { IncomingHttpHeaders } from 'node:http';

export interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { id: string; email_address: string }[];
    primary_email_address_id?: string | null;
  };
}

/** DI token — svix จริงบน prod / fake ใน test */
export abstract class WebhookVerifier {
  abstract verify(payload: Buffer | undefined, headers: IncomingHttpHeaders): ClerkWebhookEvent;
}
