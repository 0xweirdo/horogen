// E2E ตาม DoD Phase 2: auth flow (mock Clerk) + projects CRUD + soft delete
// ทุก response ถูก validate ด้วย zod schema จาก @horogen/contracts (contract test)
// ต้องมี postgres ที่ migrate แล้ว (docker compose up -d + migrate:deploy)

import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  projectListResponseSchema,
  projectResponseSchema,
  userProfileResponseSchema,
} from '@horogen/contracts';
import { createPrismaClient } from '@horogen/db';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { TokenVerifier, type VerifiedToken } from '../src/modules/auth/token-verifier.js';
import { WebhookVerifier, type ClerkWebhookEvent } from '../src/modules/auth/webhook-verifier.js';

const suffix = randomUUID().slice(0, 8);
const CLERK_A = `e2e_a_${suffix}`;
const CLERK_B = `e2e_b_${suffix}`;
const TOKENS: Record<string, string> = { 'token-a': CLERK_A, 'token-b': CLERK_B };

class FakeTokenVerifier extends TokenVerifier {
  async verify(token: string): Promise<VerifiedToken> {
    const clerkUserId = TOKENS[token];
    if (!clerkUserId) throw new UnauthorizedException('invalid token');
    return { clerkUserId };
  }
}

class FakeWebhookVerifier extends WebhookVerifier {
  verify(payload: Buffer | undefined, _headers: IncomingHttpHeaders): ClerkWebhookEvent {
    if (!payload) throw new Error('missing raw body');
    return JSON.parse(payload.toString('utf8')) as ClerkWebhookEvent;
  }
}

function clerkUserEvent(type: string, clerkId: string, email: string): ClerkWebhookEvent {
  return {
    type,
    data: {
      id: clerkId,
      primary_email_address_id: 'em_1',
      email_addresses: [{ id: 'em_1', email_address: email }],
    },
  };
}

const prisma = createPrismaClient(
  process.env.DATABASE_URL ?? 'postgresql://heygen:heygen@localhost:5433/heygen_dev',
);

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenVerifier)
    .useValue(new FakeTokenVerifier())
    .overrideProvider(WebhookVerifier)
    .useValue(new FakeWebhookVerifier())
    .compile();

  app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('v1');
  await app.init();
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { clerkId: { in: [CLERK_A, CLERK_B] } } });
  const userIds = users.map((u) => u.id);
  await prisma.project.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
  await app.close();
});

const http = () => request(app.getHttpServer());

describe('health', () => {
  it('GET /v1/health → ok + db up', async () => {
    const res = await http().get('/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });
});

describe('auth flow', () => {
  it('ไม่มี token → 401 (รูปแบบ error ตาม contract)', async () => {
    const res = await http().get('/v1/me').expect(401);
    apiErrorSchema.parse(res.body);
  });

  it('token ปลอม → 401', async () => {
    await http().get('/v1/me').set('Authorization', 'Bearer nonsense').expect(401);
  });

  it('token ถูกแต่ user ยังไม่ sync → 403', async () => {
    await http().get('/v1/me').set('Authorization', 'Bearer token-a').expect(403);
  });

  it('หลัง webhook user.created → /v1/me ใช้ได้ (validate ด้วย contract)', async () => {
    await http()
      .post('/v1/webhooks/clerk')
      .send(clerkUserEvent('user.created', CLERK_A, `${CLERK_A}@test.local`))
      .expect(200);

    const res = await http().get('/v1/me').set('Authorization', 'Bearer token-a').expect(200);
    const profile = userProfileResponseSchema.parse(res.body);
    expect(profile.email).toBe(`${CLERK_A}@test.local`);
  });

  it('webhook เดิมยิงซ้ำ → idempotent (user มีแถวเดียว)', async () => {
    await http()
      .post('/v1/webhooks/clerk')
      .send(clerkUserEvent('user.created', CLERK_A, `${CLERK_A}@test.local`))
      .expect(200);
    const count = await prisma.user.count({ where: { clerkId: CLERK_A } });
    expect(count).toBe(1);
  });
});

describe('projects CRUD + soft delete + ownership', () => {
  let projectId: string;

  it('POST body ผิด → 400', async () => {
    const res = await http()
      .post('/v1/projects')
      .set('Authorization', 'Bearer token-a')
      .send({ title: '' })
      .expect(400);
    apiErrorSchema.parse(res.body);
  });

  it('POST → 201 + contract ผ่าน', async () => {
    const res = await http()
      .post('/v1/projects')
      .set('Authorization', 'Bearer token-a')
      .send({ title: 'วิดีโอสอนบทที่ 1', scriptConfig: { script: 'สวัสดีครับ' } })
      .expect(201);
    const project = projectResponseSchema.parse(res.body);
    expect(project.title).toBe('วิดีโอสอนบทที่ 1');
    projectId = project.id;
  });

  it('GET list → เห็นของตัวเอง', async () => {
    const res = await http().get('/v1/projects').set('Authorization', 'Bearer token-a').expect(200);
    const list = projectListResponseSchema.parse(res.body);
    expect(list.map((p) => p.id)).toContain(projectId);
  });

  it('user B มองไม่เห็น project ของ A (กัน IDOR)', async () => {
    await http()
      .post('/v1/webhooks/clerk')
      .send(clerkUserEvent('user.created', CLERK_B, `${CLERK_B}@test.local`))
      .expect(200);

    const listB = await http()
      .get('/v1/projects')
      .set('Authorization', 'Bearer token-b')
      .expect(200);
    expect(projectListResponseSchema.parse(listB.body)).toEqual([]);

    await http()
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', 'Bearer token-b')
      .expect(404);
  });

  it('PATCH → แก้ title ได้', async () => {
    const res = await http()
      .patch(`/v1/projects/${projectId}`)
      .set('Authorization', 'Bearer token-a')
      .send({ title: 'แก้แล้ว' })
      .expect(200);
    expect(projectResponseSchema.parse(res.body).title).toBe('แก้แล้ว');
  });

  it('DELETE → 204 แล้ว GET เป็น 404 แต่แถวยังอยู่ใน DB (soft delete)', async () => {
    await http()
      .delete(`/v1/projects/${projectId}`)
      .set('Authorization', 'Bearer token-a')
      .expect(204);

    await http()
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', 'Bearer token-a')
      .expect(404);

    const row = await prisma.project.findUnique({ where: { id: projectId } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
  });

  it('id ไม่ใช่ uuid → 400', async () => {
    await http().get('/v1/projects/not-a-uuid').set('Authorization', 'Bearer token-a').expect(400);
  });
});

describe('user lifecycle', () => {
  it('webhook user.deleted → token เดิมใช้ไม่ได้อีก (403)', async () => {
    await http()
      .post('/v1/webhooks/clerk')
      .send({ type: 'user.deleted', data: { id: CLERK_A } })
      .expect(200);

    await http().get('/v1/me').set('Authorization', 'Bearer token-a').expect(403);
  });
});
