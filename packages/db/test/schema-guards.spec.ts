// Integration tests ตาม DoD ของ Phase 1 (BUILD_PLAN.md)
// ต้องมี postgres ที่ migrate แล้ว: docker compose up -d && pnpm migrate:deploy

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/index.js';

const url = process.env.DATABASE_URL ?? 'postgresql://heygen:heygen@localhost:5433/heygen_dev';
const prisma = createPrismaClient(url);

let userId: string;
let projectId: string;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error(
      `Postgres ไม่พร้อมที่ ${url} — รัน "docker compose up -d" และ "pnpm --filter @horogen/db migrate:deploy" ก่อน`,
    );
  }
  const user = await prisma.user.create({
    data: { clerkId: `it_${randomUUID()}`, email: 'integration@test.local' },
  });
  userId = user.id;
  const project = await prisma.project.create({
    data: { userId, title: 'integration-test project' },
  });
  projectId = project.id;
});

afterAll(async () => {
  // connection หลักเป็น owner (heygen) — REVOKE จำกัดเฉพาะ app_role จึงลบ cleanup ได้
  await prisma.creditLedger.deleteMany({ where: { userId } });
  await prisma.jobEvent.deleteMany({ where: { job: { userId } } });
  await prisma.job.deleteMany({ where: { userId } });
  await prisma.project.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

function createJob(idempotencyKey: string) {
  return prisma.job.create({
    data: {
      projectId,
      userId,
      inputConfig: { script: 'ทดสอบ' },
      modelVersion: 'test-0.0.0',
      idempotencyKey,
    },
  });
}

describe('credit_ledger append-only (REVOKE ที่ระดับ DB)', () => {
  it('app_role ถูกปฏิเสธ UPDATE', async () => {
    const row = await prisma.creditLedger.create({
      data: { userId, deltaCredits: 100, reason: 'bonus' },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_role`);
        await tx.$executeRawUnsafe(
          `UPDATE credit_ledger SET delta_credits = 999 WHERE id = ${row.id}`,
        );
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it('app_role ถูกปฏิเสธ DELETE', async () => {
    const row = await prisma.creditLedger.create({
      data: { userId, deltaCredits: -50, reason: 'hold' },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_role`);
        await tx.$executeRawUnsafe(`DELETE FROM credit_ledger WHERE id = ${row.id}`);
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it('app_role INSERT ได้ (append ยังทำงานปกติ)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE app_role`);
        await tx.$executeRawUnsafe(
          `INSERT INTO credit_ledger (user_id, delta_credits, reason) VALUES ('${userId}', 10, 'bonus')`,
        );
      }),
    ).resolves.not.toThrow();
  });

  it('reason นอกลิสต์ถูก CHECK ปฏิเสธ', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO credit_ledger (user_id, delta_credits, reason) VALUES ('${userId}', 1, 'gift')`,
      ),
    ).rejects.toThrow(/check constraint/i);
  });
});

describe('jobs.idempotency_key UNIQUE (กันกดซ้ำ/retry ซ้อน)', () => {
  it('insert key ซ้ำถูกปฏิเสธที่ระดับ schema', async () => {
    const key = `key_${randomUUID()}`;
    await createJob(key);
    await expect(createJob(key)).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('jobs.status CHECK (state machine ที่ระดับ DB)', () => {
  it('status นอก state machine ถูกปฏิเสธ', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO jobs (project_id, user_id, status, input_config, model_version, idempotency_key)
         VALUES ('${projectId}', '${userId}', 'RENDERING', '{}', 'test-0.0.0', 'k_${randomUUID()}')`,
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('priority นอกลิสต์ถูกปฏิเสธ', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO jobs (project_id, user_id, priority, input_config, model_version, idempotency_key)
         VALUES ('${projectId}', '${userId}', 'premium', '{}', 'test-0.0.0', 'k_${randomUUID()}')`,
      ),
    ).rejects.toThrow(/check constraint/i);
  });
});

describe('job_events partitioned by month', () => {
  it('insert ผ่าน parent แล้ว row ลงใน monthly partition', async () => {
    const job = await createJob(`key_${randomUUID()}`);
    await prisma.jobEvent.create({ data: { jobId: job.id, status: 'QUEUED' } });

    const rows = await prisma.$queryRaw<{ partition: string }[]>`
      SELECT tableoid::regclass::text AS partition
      FROM job_events WHERE job_id = ${job.id}::uuid
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.partition).toMatch(/^job_events_\d{4}_\d{2}$/);
  });

  it('อ่านผ่าน Prisma model ได้ปกติ', async () => {
    const job = await createJob(`key_${randomUUID()}`);
    await prisma.jobEvent.create({ data: { jobId: job.id, status: 'QUEUED' } });
    await prisma.jobEvent.create({ data: { jobId: job.id, status: 'TTS_RUNNING' } });

    const events = await prisma.jobEvent.findMany({
      where: { jobId: job.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((e) => e.status)).toEqual(['QUEUED', 'TTS_RUNNING']);
  });
});
