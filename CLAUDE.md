# CLAUDE.md — heygen-th (Thai-first Talking Avatar Platform)

## อ่านก่อนทำอะไรทุกครั้ง

1. **[docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)** = LOCKED DECISIONS ทั้งหมด — source of truth
2. **[docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)** = ลำดับ phase การเขียนโค้ด — ทำทีละ phase เท่านั้น

## กฎเหล็ก (ห้ามละเมิดโดยไม่ถามเจ้าของโปรเจกต์ก่อน)

1. **ห้ามเปลี่ยน tech stack ที่ล็อกไว้** — ทุกหมวดเลือกแล้ว 1 ตัวใน PROJECT_SPEC.md §2
   ถ้าคิดว่ามีเหตุผลต้องเปลี่ยน → หยุด อธิบายเหตุผล ถามก่อน ห้ามเปลี่ยนเอง
2. **ทำทีละ phase ตาม BUILD_PLAN.md** — จบ phase = test ผ่านทั้งหมด + commit + สรุป → หยุดรอรีวิว
3. **ทุก phase ต้องมี test และรันผ่านจริงก่อนบอกว่าเสร็จ** — logic เงิน = unit test 100% path
4. **spec ขัดกับความเป็นจริงทางเทคนิค → หยุดถามก่อน อย่าเดา**
5. **commit เป็นก้อนเล็ก** พร้อม message ที่สื่อความ (conventional commits)

### Non-negotiables (ห้ามก่อหนี้เด็ดขาด)

- License audit: `ai/LICENSES.md` ครบก่อน lock model —
  ⛔ ห้ามใช้ Wav2Lip / InsightFace / RetinaFace weights / CodeFormer / XTTS-v2 (non-commercial ทั้งหมด)
- Credit ledger = append-only เท่านั้น (REVOKE UPDATE, DELETE ที่ DB) — flow เงินผ่าน hold/capture/refund
- PDPA hard deletion cascade ถึง R2 จริง / R2 key = uuid ห้ามมี PII ใน path
- Idempotency: jobs (idempotency_key UNIQUE) + Stripe webhooks (event dedupe)
- Web/API ห้ามเรียก GPU ตรง — ทุกงานผ่าน queue, dispatcher เท่านั้นที่คุย Modal
- Concurrency caps / limits ต้องมาจาก env/DB — ห้าม hardcode
- Sanitize/escape SSML ทุก input ก่อนส่ง TTS

## Tech Stack (LOCKED — ดูรายละเอียดเต็มใน PROJECT_SPEC.md §2)

Next.js 15 (App Router) + TS + Tailwind · NestJS modular monolith · PostgreSQL @ Neon + Prisma
· Clerk · Stripe + PromptPay (packs only) · Cloudflare R2 + CDN · BullMQ @ Upstash Redis
· Modal (GPU, Python) · FFmpeg CPU worker · Docker + Railway (NO K8s) · GitHub Actions
· Grafana Cloud + Sentry · Resend · Doppler · Terraform (critical only)

## โครง Monorepo

pnpm + Turborepo — ดู tree เต็มใน PROJECT_SPEC.md §6

- `apps/web` (Next.js) · `apps/api` (NestJS) · `apps/admin`
- `packages/contracts` (zod + OpenAPI — **contract ตกลงก่อนเขียนโค้ด**) · `packages/db` (Prisma)
  · `packages/queue` (BullMQ wrapper) · `packages/config`
- `services/dispatcher` (ตัวเดียวที่คุย Modal) · `workers/encoder` (FFmpeg)
- `ai/` = Python ทั้งหมด แยกโลกจาก TS, CI แยก (pytest + golden set)

## คำสั่ง (จะใช้ได้หลัง Phase 0 scaffold)

```bash
# ทั้ง monorepo (รันจาก root)
pnpm install
pnpm turbo lint          # eslint ทุก package
pnpm turbo typecheck     # tsc --noEmit ทุก package
pnpm turbo test          # unit tests ทุก package
pnpm turbo build

# local infra
docker compose up -d     # postgres + redis + minio (แทน R2)

# database (packages/db)
pnpm --filter @horogen/db prisma migrate dev
pnpm --filter @horogen/db prisma migrate diff
pnpm --filter @horogen/db seed

# Python (ai/) — โลกแยก
cd ai && pytest
```

## Coding Conventions

### TypeScript

- strict mode ทุก package, ห้าม `any` โดยไม่มีเหตุผลเขียนกำกับ
- Validation ที่ boundary ด้วย zod จาก `packages/contracts` — type อนุมานจาก schema ไม่เขียนซ้ำ
- NestJS: module ต่อ domain (`auth/ billing/ jobs/ media/ admin/`), service = logic, controller = บาง
- Error: typed exceptions + Sentry, ห้ามกลืน error เงียบ ๆ
- Logging: pino structured JSON — ทุก log ของ job ต้องมี `job_id`
- Naming: DB = snake_case, TS = camelCase (Prisma map), ไฟล์ = kebab-case

### Python (ai/)

- ruff + type hints, pytest, ห้าม dependency ที่ license ไม่ clean (ตรวจก่อนเพิ่มทุกตัว → ลง LICENSES.md)
- Model versioning = pin-as-code: HF revision hash + Docker image tag (NO MLflow)

### Tests

- Unit ข้าง source (`*.spec.ts`) / integration ต่อ app / E2E = Playwright (web), supertest (api)
- Logic เงิน (billing/ledger) = unit ครบ 100% path — เป็น DoD บังคับ
- งาน AI pipeline: แนบ output video ตัวอย่างใน PR

### Git

- trunk-based, feature branch ≤ 3 วัน, squash merge, main เขียวเสมอ
- PR < 400 บรรทัด / conventional commits (`feat: ...`, `fix: ...`, `chore: ...`)
- DB migration: expand → migrate → contract, backward-compatible 1 เวอร์ชัน, ไม่ rollback schema บน prod

## สถานะปัจจุบัน

- [x] เอกสารออกแบบ (PROJECT_SPEC.md / BUILD_PLAN.md)
- [x] Phase 0 — Monorepo foundations (scaffold + config presets + contracts placeholder + compose + CI)
  - ⚠️ docker compose ยังไม่ได้ verify บนเครื่อง dev — Docker Desktop ยังไม่ติดตั้ง
- [ ] Phase 1 — Database layer ← **รอเจ้าของโปรเจกต์รีวิว Phase 0 ก่อน**
