# heygen-th — Thai-first Talking Avatar Platform

Script → TTS ไทย → Talking Avatar Video ใน 5 นาที

- **Spec (LOCKED)**: [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)
- **Build plan**: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)
- **Dev setup**: [docs/onboarding.md](docs/onboarding.md)
- **AI rules**: [CLAUDE.md](CLAUDE.md)

## Quick start

```bash
pnpm install
docker compose up -d        # postgres + redis + minio
pnpm turbo lint typecheck test
```

## Monorepo layout

| path                  | คืออะไร                                                 |
| --------------------- | ------------------------------------------------------- |
| `apps/web`            | Next.js 15 — studio + landing + pricing                 |
| `apps/api`            | NestJS modular monolith                                 |
| `packages/contracts`  | zod schemas + shared types (contract-first)             |
| `packages/db`         | Prisma schema + migrations                              |
| `packages/queue`      | BullMQ wrapper                                          |
| `packages/config`     | eslint / tsconfig / tailwind presets                    |
| `services/dispatcher` | queue → Modal orchestrator (ตัวเดียวที่คุย Modal)       |
| `workers/encoder`     | FFmpeg CPU worker                                       |
| `ai/`                 | Python ทั้งหมด (Modal GPU worker, bake-off, golden set) |
| `infra/`              | terraform / railway / runbooks                          |
