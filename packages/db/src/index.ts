import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

/**
 * สร้าง PrismaClient — worker ต้องคุม pool ให้เล็ก (2–3 ต่อ worker ตาม spec)
 * โดยใส่ `?connection_limit=3` ใน DATABASE_URL และใช้ Neon pooler บน prod
 */
export function createPrismaClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({ datasources: { db: { url } } });
}
