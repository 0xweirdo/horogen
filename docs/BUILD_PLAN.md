# BUILD PLAN — แตก 12-Week Roadmap เป็น Phase ของการเขียนโค้ด

> อ้างอิง: [PROJECT_SPEC.md](PROJECT_SPEC.md) (LOCKED)
> กฎ: **ทำทีละ phase — จบ phase แล้วหยุดรอรีวิวจากเจ้าของโปรเจกต์ก่อนเริ่ม phase ถัดไป**
> ทุก phase ต้องมี test ที่รันผ่านจริงก่อนประกาศว่าเสร็จ

## ภาพรวม Dependency

```
Phase 0 (Foundations)
  ├─► Phase 1 (DB layer) ──► Phase 2 (API skeleton) ──► Phase 3 (Media/Upload + Safety gate)
  │                                   │
  ├─► Phase A1 (Bake-off) ─► Phase A2 (GPU worker v1 + TTS)      [Python track — ขนานกับ 1–3]
  │                                   │
  └───────────────► Phase 4 (Queue + Dispatcher + State machine) ◄── ต้องมี 1,2,A2
                                      │
                    Phase 5 (Chunking + Encoder + Retry/Refund)  ══ 🚩 GATE 2: E2E
                                      │
        ┌─────────────────────────────┼─────────────────────────┐
        ▼                             ▼                         ▼
  Phase 6 (Studio UI + SSE)   Phase 7 (Credits + Billing)  Phase 8 (T&S + Admin)
        └─────────────────────────────┼─────────────────────────┘
                                      ▼
                    Phase 9 (Observability + Hardening + Load test)
                                      ▼
                    Phase 10 (Beta fixes → Launch prep)
```

- **สองแทร็กขนานกัน**: TS track (Phase 0–3) กับ Python/AI track (Phase A1–A2)
  มาบรรจบกันที่ Phase 4
- Phase 6 / 7 / 8 ขนานกันได้บางส่วน แต่ในการทำงานกับ Claude Code จะทำ**เรียงทีละ phase**

---

## Phase 0 — Monorepo Foundations (≈ W1)

**เป้าหมาย**: repo ที่ dev ใหม่ clone แล้ว `pnpm install && docker compose up` ใช้ได้ใน < 1 ชม.

**Deliverables**

- โครง monorepo pnpm + Turborepo ตาม structure ที่ล็อก (apps/ packages/ services/ workers/ ai/ infra/ docs/)
- `packages/config`: eslint / tsconfig / tailwind presets ใช้ร่วมทุก package
- `docker-compose.yml`: postgres + redis + minio (แทน R2 สำหรับ local dev)
- GitHub Actions `ci.yml`: lint + typecheck + unit test + gitleaks + docker build
- `.env.example` ทุก app + โครง Doppler project (เอกสาร ไม่ใช่ secret จริง)
- `docs/onboarding.md` ฉบับแรก

**Tests / Definition of Done**

- CI เขียวบน PR แรก (lint + typecheck + placeholder unit test ผ่าน)
- `docker compose up` แล้ว postgres/redis/minio healthcheck ผ่าน

**ขึ้นกับ**: —

---

## Phase 1 — Database Layer (≈ W2)

**เป้าหมาย**: `packages/db` เป็น source of truth ของ schema ทั้งหมด

**Deliverables**

- Prisma schema ครบทุกตารางตาม Round 4: users, projects, jobs, job_events (partition by month),
  credit_ledger, assets, subscriptions, audit_logs
- Migration แรก + raw SQL migration สำหรับสิ่งที่ Prisma ทำไม่ได้:
  `REVOKE UPDATE, DELETE ON credit_ledger`, partial indexes, partitioning, CHECK constraints
- Seed script (dev user, stock project)
- CI step: `prisma migrate diff` + migration test บน DB สด (local postgres ใน CI)

**Tests / DoD**

- Migration รันจาก 0 → ล่าสุดบน postgres สดผ่านใน CI
- Integration test: UPDATE/DELETE บน credit_ledger ด้วย app_role ต้อง **fail**
- Integration test: insert job ซ้ำ idempotency_key เดิมต้อง fail (UNIQUE)
- Test state CHECK constraint ของ jobs.status

**ขึ้นกับ**: Phase 0

---

## Phase 2 — API Skeleton: Auth + CRUD + Contracts (≈ W2–W3)

**เป้าหมาย**: NestJS monolith ที่ login ได้ สร้าง project ได้ พร้อม contract กลาง

**Deliverables**

- `packages/contracts`: zod schemas + shared types + OpenAPI spec (contract-first)
- `apps/api` NestJS modular monolith: modules `auth/`, `users/`, `projects/`
- Clerk integration: JWT verify middleware + webhook sync users (idempotent)
- Soft delete (`deleted_at`) บน users/projects + guard ไม่ให้ query เจอของที่ลบ
- Health endpoint + Sentry init + structured logging (pino)

**Tests / DoD**

- Unit tests: auth guard, projects CRUD service
- E2E test (supertest): auth flow (mock Clerk JWT) + projects CRUD + soft delete
- Contract: response ทุก endpoint validate ผ่าน zod schema ใน test

**ขึ้นกับ**: Phase 1

---

## Phase A1 — Bake-off + License Audit (≈ W1–W2, Python track — ขนานกับ Phase 1–2)

> ⚠️ ความเสี่ยงใหญ่สุดของโปรเจกต์อยู่ phase นี้ — ต้องเริ่มเร็วที่สุด

**เป้าหมาย**: 🚩 **GATE 1** — lock face animation model 1 ตัว พร้อม license audit เป็นเอกสาร

**Deliverables**

- `ai/golden/`: golden set — รูปสมจริง 20 ใบ + สคริปต์ไทย 10 + เกณฑ์ตัวเลขล่วงหน้า (ผ่าน 15/20)
- `ai/bakeoff/`: สคริปต์รัน 4 models (EchoMimic / AniPortrait / Hallo / MuseTalk) บน Modal
  - ตารางผล (คุณภาพ, GPU seconds/chunk, cost/นาที) — เก็บถาวร
- `ai/LICENSES.md`: license audit ทุก model/weight/dependency (**บังคับก่อน lock**)
- ADR ใน `docs/decisions/`: model ที่ lock + เหตุผล — **ห้ามเปลี่ยนจนหลัง launch**

**Tests / DoD**

- ผล bake-off เป็นตัวเลขเทียบกับเกณฑ์ที่ตั้งไว้ก่อนรัน
- LICENSES.md ครอบคลุมทุก weight ที่จะ ship
- ถ้าไม่มี model ไหนผ่าน 15/20 → **หยุด ถามเจ้าของโปรเจกต์** (แผนสำรอง: stock avatar first)

**ขึ้นกับ**: Phase 0 (แค่โครง repo + Modal account)

---

## Phase A2 — GPU Worker v1 + TTS Service (≈ W3, Python track)

**เป้าหมาย**: photo + audio → video 1 chunk บน Modal และ text → Thai audio ผ่าน AI Service Layer

**Deliverables**

- `ai/worker/`: pipeline detect (MediaPipe) → align → animate (model ที่ lock) → enhance (GFPGAN, flag)
- `modal_app.py`: Modal entrypoint, fp16, timeout 5 นาที/chunk, GPU config, model pin (HF revision hash)
- AI Service Layer interface: `generate_tts()`, `animate_face()` — vendor-agnostic
- Azure Neural TTS (th-TH) integration + SSML sanitize/escape + silence trimming
- TTS preview endpoint ใน API (สั้น ๆ ไม่กินเครดิต)

**Tests / DoD**

- pytest: golden image 1 ใบ + audio 10 วิ → video chunk ออกมา ตรวจ duration/fps/มีหน้า
- pytest: SSML injection test (input มี `<`, `&`, tag แปลก ๆ ต้องถูก escape)
- Cost log: gpu_seconds ต่อ chunk ถูกรายงานกลับจาก Modal

**ขึ้นกับ**: Phase A1 (model locked)

---

## Phase 3 — Media Upload + Safety Gate (≈ W3–W4)

**เป้าหมาย**: user อัปโหลดรูป avatar เข้า R2 ได้อย่างปลอดภัย โดย bytes ไม่ผ่าน backend

**Deliverables**

- Module `media/`: presigned PUT (อายุ 15 นาที) + presigned GET (24 ชม.) — local dev ใช้ minio
- assets table flow: create → confirm upload → sha256 → purge_after (source 90 วัน)
- R2 key = uuid เท่านั้น (ไม่มี PII ใน path)
- **Consent declaration + log** (timestamp, IP, user_id) ตอน upload — ลง audit_logs
- **NSFW + face quality gate บน CPU ก่อน enqueue** (fail fast < 2 วิ)

**Tests / DoD**

- E2E: ขอ presigned → PUT ไฟล์เข้า minio → confirm → asset record ถูกต้อง
- Unit: NSFW gate block / face-not-found block / ไฟล์ใหญ่เกิน block
- Audit log ถูกเขียนทุก upload พร้อม consent record

**ขึ้นกับ**: Phase 2

---

## Phase 4 — Queue + Dispatcher + Job State Machine (≈ W4)

**เป้าหมาย**: จุดบรรจบสองแทร็ก — enqueue job แล้ววิ่งผ่าน state machine จนจบ 1 chunk

**Deliverables**

- `packages/queue`: BullMQ wrapper — 3 คิว (paid / standard / encode), payload types, enqueue helpers
- Module `jobs/` ใน API: create job (idempotency_key), state machine
  `QUEUED → TTS_RUNNING → ANIMATING → ENCODING → DONE/FAILED/CANCELLED` + job_events ทุก transition
- `services/dispatcher`: consumer ที่เดียวที่คุย Modal API — backend ไม่รู้จัก Modal
- Concurrency cap จาก env/DB (paid ≤ 8, standard ≤ 2 — **ห้าม hardcode**)
- บันทึก model_version, gpu_seconds, cost_usd ลง jobs ทุก job

**Tests / DoD**

- Unit: state machine ปฏิเสธ transition ผิด (เช่น DONE → ANIMATING)
- Integration (redis จริงใน docker): enqueue → dispatcher mock-Modal → job DONE + job_events ครบ
- Idempotency: ยิง create job ซ้ำ key เดิม → ได้ job เดิม ไม่สร้างใหม่
- E2E บน staging: 1 job จริงผ่าน Modal จนได้ video chunk

**ขึ้นกับ**: Phase 1, 2, A2

---

## Phase 5 — Chunking + FFmpeg Encoder + Retry/Refund (≈ W5) — 🚩 GATE 2

**เป้าหมาย**: **E2E เถื่อน — script → downloadable video บน staging**

**Deliverables**

- Chunking: หั่น audio 10–15 วิ → fan-out หลาย GPU worker → track ครบทุก chunk
- `workers/encoder`: FFmpeg CPU worker — concat chunks + mux audio + encode + **watermark (free tier)**
  - provenance metadata (C2PA-style) ทุก tier
- Retry ราย chunk: 1 ครั้ง + exponential backoff / timeout 5 นาที → kill + retry + **auto-refund hold**
- Poison job detection: input เดิม fail 2 ครั้ง = ไม่ retry
- Download: signed GET 24 ชม. ผ่าน CDN path

**Tests / DoD**

- Unit: chunk boundary math (audio ยาวไม่ลงตัว), retry counter, poison detection
- Integration: chunk 1 ตัว fail ครั้งแรก retry สำเร็จ → job DONE / fail 2 ครั้ง → job FAILED + refund event
- **Gate 2 smoke**: script ไทย 30–60 วิ → video ดาวน์โหลดได้จริงบน staging, audio sync ไม่หลุดที่รอยต่อ chunk
- Load test เบา: 10 jobs พร้อมกัน

**ขึ้นกับ**: Phase 3, 4

---

## Phase 6 — Studio UI + SSE Progress (≈ W4–W6, frontend — เริ่มขนานได้ตั้งแต่มี contracts)

**เป้าหมาย**: user จริงใช้ flow ทั้งหมดผ่านเว็บได้ โดยไม่ต้องแตะ API ตรง

**Deliverables**

- `apps/web`: Next.js 15 App Router — landing, Clerk auth, studio shell
- Studio: script editor + เลือก avatar (upload + consent UI) + เลือกเสียง + TTS preview
- SSE endpoint ใน API (client ไม่ poll Redis ตรง) + progress UI ตาม state machine
- Video preview + download + error states ครบทุก fail path
- Milestone: คนนอกทีม 2 คนใช้ได้จริงโดยไม่ต้องอธิบาย

**Tests / DoD**

- Component tests ส่วน logic (script length limit, upload validation)
- Playwright E2E: login → create project → upload → generate → เห็น progress → download (mock หรือ staging)
- TTFV วัดได้จริง — instrument event ตั้งแต่ signup ถึงวิดีโอแรก

**ขึ้นกับ**: Phase 2 (contracts), สมบูรณ์ได้เมื่อ Phase 5 เสร็จ

---

## Phase 7 — Credit Ledger + Stripe + PromptPay (≈ W6–W8)

**เป้าหมาย**: เก็บเงินได้ โดย logic เงินถูกต้อง 100% path

**Deliverables**

- Module `billing/`: credit ledger hold → capture → refund (append-only เท่านั้น)
  - balance = SUM cache ใน Redis + invalidation
- Stripe: subscription + credit packs + webhook **idempotent** (event id dedupe)
- PromptPay: credit packs เท่านั้น (ไม่ recurring)
- Pricing page + paywall + credit balance UI (ประสานกับ Phase 6)
- ผูกกับ jobs: enqueue = hold, DONE = capture, FAILED = auto-refund (ต่อจาก Phase 5)

**Tests / DoD**

- **Unit 100% path สำหรับ logic เงิน** (DoD ตามทีม workflow): hold ซ้อน, capture เกิน hold,
  refund ซ้ำ, webhook ยิงซ้ำ, race บน balance
- Integration: Stripe webhook (stripe-cli fixture) end-to-end เข้า ledger
- ทดสอบว่า ledger ไม่มีทาง UPDATE/DELETE จาก app code path ใดเลย

**ขึ้นกับ**: Phase 5 (job lifecycle), Phase 6 (UI ผูก paywall)

---

## Phase 8 — Trust & Safety + Rate Limit + Admin v0 (≈ W6–W8)

**เป้าหมาย**: ครบเงื่อนไข "บังคับก่อน beta" ทุกข้อ

**Deliverables**

- Celebrity/public figure hash blocklist + ตรวจสคริปต์หมวดการเงิน/ชวนลงทุนเข้มพิเศษ
- Rate limit: บัญชีใหม่ 2–3 วิดีโอ/วัน + ยาวสุด 1 นาที + email verify / rate limit ต่อ plan
- **Budget circuit breaker รายวัน**: GPU spend เกิน cap → ตัด standard queue อัตโนมัติ
- PDPA: DSAR self-service (export + delete cascade ถึง R2 จริง) + daily hard-delete job
  - `docs/pii-inventory.md`
- Admin v0: ดู user/job/cost + admin_adjust ผ่าน ledger — ทุก action ลง audit_logs

**Tests / DoD**

- E2E: DSAR delete แล้วไฟล์หายจาก minio/R2 จริง + DB ไม่เหลือ PII
- Unit: circuit breaker ตัด standard แต่ paid ไปต่อ / rate limit ต่อ plan
- Blocklist test ด้วย fixture hashes

**ขึ้นกับ**: Phase 5, 7 (ledger สำหรับ admin_adjust)

---

## Phase 9 — Observability + Hardening + Load Test (≈ W7–W8, W11) — 🚩 GATE 3

**เป้าหมาย**: production-ready checklist + security review ผ่าน

**Deliverables**

- Grafana dashboards: queue depth, job success rate, cost/job, cost/user, GPU utilization
- Golden job smoke test เข้า CI (staging หลัง deploy)
- Alerting: job fail rate, queue stuck, GPU spend, dispatcher down
- Runbooks: dispatcher-down, modal-outage, stripe-freeze, restore-db + ซ้อม restore Neon PITR 1 ครั้ง
- Load test: 50 concurrent + soak 24 ชม. / Canary setup (Railway replica + model_version 10%)
- Security review 1 วันเต็ม: presigned scope, webhook sig verify, SSML injection, IDOR ทุก endpoint

**Tests / DoD**

- Golden job ผ่านใน CI ติดกัน 3 รัน
- Load test report: success rate > 95% ที่ 50 concurrent
- Checklist security review ปิดครบหรือมี ticket พร้อม owner

**ขึ้นกับ**: Phase 5–8

---

## Phase 10 — Private Beta → Launch (≈ W9–W12) — 🚩 GATE 4, 5

**เป้าหมาย**: beta 20–30 คน → fix → public soft launch

**งาน (ส่วนใหญ่ไม่ใช่โค้ดใหม่)**

- W9: beta — วัด TTFV + funnel จริง, on-call เริ่ม
- W10: **fix top issues เท่านั้น — ห้ามฟีเจอร์ใหม่** / ปรับ keep_warm ตาม histogram จริง
  - เกณฑ์: TTFV < 5 นาที ≥ 70%, job success rate > 95% (**< 90% = เลื่อน launch**)
- W11: landing + SEO ไทย + demo video / stock avatars 10–15 ตัว licensed
- W12: 🚀 public soft launch + war room 3 วัน

**ขึ้นกับ**: ทุก phase ก่อนหน้า

---

## หมายเหตุการทำงานกับ Claude Code

1. ทำเรียง: **0 → 1 → 2 → A1 → A2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10**
   (A1/A2 ในโลกจริงขนานกับ 1–3 แต่ใน session จะทำเรียงตาม dependency นี้)
2. จบแต่ละ phase: test ผ่านทั้งหมด + commit ก้อนเล็ก + สรุปสิ่งที่ทำ → **หยุดรอรีวิว**
3. เจอ spec ขัดกับความเป็นจริงทางเทคนิค → หยุดถาม ห้ามเดา ห้ามเปลี่ยน stack เอง
4. Phase A1 (bake-off) ต้องรันบน Modal จริงกับ golden set จริง — Claude Code เตรียมโครงสคริปต์/เกณฑ์ได้
   แต่การตัดสิน lock model เป็นของทีม (GATE 1)
