import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  // default = local docker compose (postgres อยู่ host port 5433)
  DATABASE_URL: z.string().default('postgresql://heygen:heygen@localhost:5433/heygen_dev'),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export const env = envSchema.parse(process.env);

/** บังคับ secret ที่ห้ามขาดบน production — เรียกตอน bootstrap เท่านั้น */
export function assertProdSecrets(): void {
  if (env.NODE_ENV !== 'production') return;
  const missing = (['CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET'] as const).filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`missing required env on production: ${missing.join(', ')}`);
  }
}
