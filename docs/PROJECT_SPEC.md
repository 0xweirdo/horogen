# PROJECT SPEC — Thai-first Talking Avatar Platform (HeyGen-like)

> **สถานะ: LOCKED** — เอกสารนี้รวบผลการตัดสินใจจาก architecture planning 5 รอบ
> (Product → Architecture → AI Pipeline → Infra/DevOps → CTO Review)
> ทุกการตัดสินใจถูกล็อกแล้ว **ห้ามเปลี่ยนโดยไม่มีเหตุผลใหม่และไม่ได้รับการยืนยันจากเจ้าของโปรเจกต์**
> ทุก session ของ Claude Code ต้องอ้างอิงไฟล์นี้เป็น source of truth

---

## 0. PROJECT CONTEXT (คงที่)

- **Product**: เว็บแพลตฟอร์ม Talking Avatar (Thai-first) คล้าย HeyGen
- **Team**: 3–6 full-stack devs, ML engineer 0–1 คน
- **Timeline**: MVP ใช้งานจริงใน 12 สัปดาห์
- **Budget**: startup ระยะแรก คุม GPU/cloud cost ต่ำสุด
- **Scale target**: ล้าน user โดยไม่ rewrite

---

## 1. PRODUCT (LOCKED — Round 1)

### Must Have (3 ฟีเจอร์เท่านั้น)

1. **Talking Avatar** — photo → video พูดได้
2. **AI Voice / TTS** — Thai-first
3. **Lip Sync**

→ ทั้งหมดคือ pipeline เดียว: **Text → TTS → Audio-driven Face Animation**

### Positioning

- **Killer Feature**: "Script-to-Talking-Video in 5 Minutes (Thai-native)"
- **Persona หลัก**: Course Creator / Content Creator สายความรู้
  (รอง: SME Marketer / องค์กร = ปี 2)
- **North star metric**: time-to-first-video < 5 นาที

### Business Goals

- 1,000 paying subs, ARPU ≥ $29, gross margin/วิดีโอ ≥ 60% ภายใน 12 เดือน
- **Cost guardrail**: ต้นทุนวิดีโอ 1 นาที < $0.20 (เป้า ≤ $0.15 ภายในเดือน 2)

### ตัดออกจาก v1 เด็ดขาด

- Text-to-Video, AI Video Generation → ปี 2+
- Voice Clone + Face Swap → เดือน 4–6 (ต้องมี liveness consent system ก่อน)

---

## 2. ARCHITECTURE + TECH STACK (LOCKED — Round 2)

### Architecture Pattern

- **Modular Monolith (NestJS) + async job queue**
- Worker แยก 2 ชนิด:
  - **GPU worker**: Modal (Python) — face animation
  - **CPU worker**: FFmpeg (Railway) — mux/encode/watermark
- **กฎเหล็ก**: web ไม่เรียก GPU ตรงเด็ดขาด — ทุกงานผ่าน queue
- **AI Service Layer**: interface กลาง `generate_tts()`, `animate_face()`
  → สลับ model/vendor ได้โดยไม่แตะ backend

### Tech Stack (เลือกแล้ว 1 ต่อหมวด — ห้ามเปลี่ยน)

| หมวด             | เลือก                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Frontend         | Next.js 15 (App Router) + TypeScript + Tailwind                                     |
| Backend          | Node.js + NestJS (TypeScript, modular monolith)                                     |
| Database         | PostgreSQL @ Neon (ใช้ Neon pooler/PgBouncer สำหรับ workers)                        |
| ORM              | Prisma (Prisma Migrate เท่านั้น)                                                    |
| Auth             | Clerk                                                                               |
| Payment          | Stripe (subscription + metered) + PromptPay (credit packs เท่านั้น — ไม่ recurring) |
| Object Storage   | Cloudflare R2 (zero egress)                                                         |
| Video Processing | FFmpeg บน CPU worker (Docker)                                                       |
| GPU              | Modal serverless + PyTorch                                                          |
| Queue            | BullMQ บน Upstash Redis                                                             |
| Cache            | Upstash Redis (แยก 2 instance ตั้งแต่เดือน 2: queue / cache)                        |
| Container        | Docker + Railway (**NO Kubernetes ใน MVP**)                                         |
| CI/CD            | GitHub Actions                                                                      |
| Monitoring       | Grafana Cloud (metrics + Loki logs) + Sentry                                        |
| Email            | Resend                                                                              |
| CDN              | Cloudflare (+ WAF + rate limit ที่ edge)                                            |
| Secrets          | Doppler (rotation 90 วัน)                                                           |
| IaC              | Terraform เฉพาะ critical (Cloudflare DNS/R2/WAF, Neon)                              |

### Data Flow Rules

- **Upload**: presigned PUT ตรงเข้า R2 (อายุ 15 นาที) — ไม่ผ่าน backend
- **Download**: Cloudflare CDN + signed GET (อายุ 24 ชม.) เท่านั้น — backend ไม่แตะ video bytes
- **Job state machine**: `QUEUED → TTS_RUNNING → ANIMATING → ENCODING → DONE / FAILED / CANCELLED`
- เก็บ **cost/job** (gpu_seconds × ราคา) + **model_version** ลง DB ทุก job

---

## 3. AI PIPELINE (LOCKED — Round 3)

### Models per Stage

| Stage                    | เลือก                                                             | หมายเหตุ                                                                                                            |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TTS                      | **Azure Neural TTS (th-TH)** = default (~$0.015/นาที)             | + ElevenLabs = Premium Voice เฉพาะ tier สูง (กินเครดิต 3–5 เท่า) — ผ่าน AI Service Layer เท่านั้น                   |
| Face Detection/Alignment | **MediaPipe** (Apache-2.0) รันใน GPU worker                       | ⛔ ห้ามใช้ InsightFace / RetinaFace pretrained weights (non-commercial)                                             |
| Face Animation           | **self-host open-source license-clean (Apache-2.0/MIT) บน Modal** | bake-off สัปดาห์ 1 จาก: EchoMimic / AniPortrait / Hallo / MuseTalk → lock 1 ตัว ⛔ ห้ามใช้ Wav2Lip (non-commercial) |
| Enhancement              | **GFPGAN** (Apache-2.0) เฉพาะ paid tier                           | ⛔ ห้ามใช้ CodeFormer (non-commercial)                                                                              |
| Voice Clone              | — (ยังไม่ทำใน v1)                                                 | ⛔ ห้ามใช้ XTTS-v2 (CPML non-commercial)                                                                            |

### Cost Recipe

- Animate ที่ **512px** → GFPGAN enhance ทีหลัง (ถูกกว่า animate 1024px ~2 เท่า)
- หั่นวิดีโอเป็น **chunk 10–15 วิ** กระจายหลาย GPU worker → ต่อกันใน FFmpeg
- **ตัด silence** ออกจาก audio ก่อน animate
- **fp16 ตั้งแต่วันแรก** / torch.compile ทีหลัง / TensorRT = เดือน 3+ เท่านั้น
- เป้า cost/นาที ≤ $0.15 ภายในเดือน 2 (เริ่มที่ ~$0.10–0.23)

### GPU Serving

- Modal serverless, **scale-to-zero** เมื่อ queue ว่าง
- `keep_warm=1` ช่วง 9:00–22:00 ไทย (ปรับตาม histogram จริงหลัง beta)
- Queue แยก paid/standard + concurrency cap (paid ≤ 8, standard ≤ 2 —
  **ต้อง dynamic จาก env/DB, ห้าม hardcode**)
- Timeout 5 นาที/chunk → kill + retry 1 ครั้ง + auto-refund
- **Versioning = pin-as-code**: HF revision hash + Docker image tag + `model_version` ใน jobs table (NO MLflow)
- จุดคุ้มทุนย้าย dedicated: utilization > ~35–40% ต่อเนื่อง (≈2,500–3,500 นาที/เดือน)
  → hybrid: dedicated base + serverless peak

### Trust & Safety v1 (บังคับก่อน beta)

- Consent declaration + log (timestamp, IP, user_id) ตอน upload รูป
- Visible watermark ทุกวิดีโอ free tier + provenance metadata (C2PA-style) ทุก tier
- NSFW check บน CPU **ก่อน enqueue** (fail fast ใน 2 วิ ก่อนเผา GPU)
- Celebrity/public figure hash blocklist + ตรวจสคริปต์หมวดการเงิน/ชวนลงทุนเข้มพิเศษ
- Rate limit บัญชีใหม่: 2–3 วิดีโอ/วัน, ยาวสุด 1 นาที + email verify
- PDPA: hard delete จริงจาก R2, source photo purge 90 วัน
- Sanitize/escape SSML ทุก input ก่อนส่ง TTS

---

## 4. DATABASE SCHEMA (LOCKED — Round 4)

### หลักการ

- **credit_ledger = append-only เท่านั้น** (`REVOKE UPDATE, DELETE` ที่ระดับ DB)
  → balance = `SUM(delta_credits)`, cache ใน Redis
  → flow เงิน: hold → capture → refund ผ่าน ledger เท่านั้น
- **Soft delete** (`deleted_at`) สำหรับ UX 30 วัน → job รายวัน hard delete จริง + ลบไฟล์ R2 (PDPA)
- **idempotency_key UNIQUE บน jobs** — กันกดซ้ำ/retry ซ้อนที่ระดับ schema
- **job_events แยกตาราง** (ทุก state transition + timestamp) — partition by month ตั้งแต่สร้าง
- `assets.purge_after` สำหรับ retention (source 90 วัน, output ตาม plan)
- **R2 key = uuid, ห้ามมี PII ใน path**

### SQL หลัก

```sql
CREATE TABLE jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  status          text NOT NULL DEFAULT 'QUEUED'
                    CHECK (status IN ('QUEUED','TTS_RUNNING','ANIMATING',
                                      'ENCODING','DONE','FAILED','CANCELLED')),
  priority        text NOT NULL DEFAULT 'standard',   -- standard | paid
  input_config    jsonb NOT NULL,        -- script, voice_id, avatar_asset_id, options
  output_asset_id uuid REFERENCES assets(id),
  model_version   text NOT NULL,
  gpu_seconds     integer DEFAULT 0,
  cost_usd        numeric(10,5) DEFAULT 0,
  fail_reason     text,
  idempotency_key text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_user_created ON jobs (user_id, created_at DESC);
CREATE INDEX idx_jobs_status ON jobs (status)
  WHERE status NOT IN ('DONE','FAILED','CANCELLED');
CREATE INDEX idx_jobs_cost_month ON jobs (created_at) INCLUDE (cost_usd, gpu_seconds);

CREATE TABLE credit_ledger (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),
  delta_credits integer NOT NULL,
  reason        text NOT NULL
                  CHECK (reason IN ('purchase','subscription_grant','hold',
                                    'capture','refund','bonus','admin_adjust')),
  job_id        uuid REFERENCES jobs(id),
  stripe_ref    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_user ON credit_ledger (user_id, created_at DESC);
REVOKE UPDATE, DELETE ON credit_ledger FROM app_role;

CREATE TABLE assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  kind        text NOT NULL CHECK (kind IN ('avatar_photo','audio','video_output','thumbnail')),
  r2_key      text NOT NULL UNIQUE,
  bytes       bigint,
  sha256      text,
  purge_after timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_purge ON assets (purge_after) WHERE deleted_at IS NULL;
```

### ตารางอื่น (ER)

- `users` (clerk_id UK, email, plan, deleted_at)
- `projects` (user_id, title, script_config jsonb, deleted_at)
- `job_events` (job_id, status, timestamp — partition by month)
- `subscriptions` (user_id PK, stripe_sub_id, status, period_end)
- `audit_logs` (user_id, action, detail jsonb, ip — เก็บ 1 ปี, ทุก sensitive action)

### Migration Policy

- **Prisma Migrate เท่านั้น** / expand → migrate → contract (backward-compatible 1 เวอร์ชัน)
- **ไม่ rollback schema บน prod** — roll code กลับแทน
- Neon branch ต่อ PR ที่แตะ schema → รัน migration test ใน CI

---

## 5. QUEUE / DEVOPS / SECURITY (LOCKED — Round 4)

### Queue

- BullMQ **3 คิว: paid / standard / encode**
- **Dispatcher (Railway) = ตัวเดียวที่คุย Modal API** — backend ไม่รู้จัก Modal
- Retry ราย chunk: 1 ครั้ง + exponential backoff → fail = job FAILED + auto-refund hold
- **Poison job detection**: input เดิม fail 2 ครั้ง = ไม่ retry
- **Budget circuit breaker รายวัน**: GPU spend เกิน cap → ตัด standard queue อัตโนมัติ (paid ไปต่อ)
- Job status ส่งผ่าน **SSE จาก backend** (ไม่ให้ client poll Redis ตรง)

### DevOps

- Git: trunk-based, feature branch ≤ 3 วัน, squash merge, main เขียวเสมอ
- Feature flags: env-based ใน MVP (DB flag table = เดือน 5–6)
- Environments: PR-preview (Railway + Neon branch + Vercel preview)
  → staging (merge main) → prod (manual promote)
- CI: lint + typecheck + unit + prisma migrate diff + docker build
- Smoke test staging = **golden job จริง 1 ตัว end-to-end**
- Canary: app (Railway replica ~10–20% traffic 10 นาที) + model (model_version 10% ของ jobs)
- Rollback: pin image เก่า < 2 นาที / DB ไม่ rollback

### Security

- Presigned URL อายุสั้น (upload 15 นาที / download 24 ชม.), ไม่มี public bucket
- DSAR self-service: export + delete (cascade ถึง R2 จริง)
- Doppler rotation 90 วัน + rotate ทันทีเมื่อคนออก
- gitleaks ใน CI บล็อก PR
- Audit log ทุก sensitive action เก็บ 1 ปี
- Admin เข้าถึงข้อมูล user ผ่าน admin tool + audit log เท่านั้น (ไม่มี direct DB/R2 access)
- Prisma pool size ต่อ worker = 2–3 + Neon pooler ตั้งแต่วันแรก

### Cost Envelope (ประมาณการ USD/เดือน)

- 100 users: ~$200–380 | 1K: ~$1.2–2.1K | 10K: ~$9–15K
- 100K: ~$67–105K | 1M: ~$150–250K (หลัง GPU optimize เป้า $0.06–0.08/นาที)
- Margin guardrail 60% ผ่านจริงที่ ~5–10K users

### Scaling Triggers

- 2.5–3.5K นาทีวิดีโอ/เดือน → hybrid GPU (dedicated base + serverless peak)
- ~50K jobs/วัน → พิจารณาย้าย queue BullMQ → SQS/NATS
- 10K users → CPU workers ไป K8s/ECS ได้ (API ยังอยู่ Railway) + read replica/analytics แยก
- 100K users → จ้าง infra engineer + reserved ทุกอย่าง
- 1M users → TensorRT/quantization + dedicated GPU cluster
- R2 operation bill > $500/เดือน → ปรับ chunk 30 วิ + pipe in-memory

---

## 6. REPO STRUCTURE (LOCKED — Round 5, Monorepo: pnpm + Turborepo)

```
heygen-th/
├── apps/
│   ├── web/                      # Next.js 15 — studio + landing + pricing
│   ├── api/                      # NestJS modular monolith
│   │   └── src/modules/          #   auth/ billing/ jobs/ media/ admin/
│   └── admin/                    # Admin tool (หรือ route ใน api ถ้าทีม 3 คน)
├── packages/
│   ├── contracts/                # OpenAPI spec + zod schemas + shared types
│   ├── db/                       # Prisma schema + migrations + seed
│   ├── queue/                    # BullMQ wrapper: queue names, payload types, enqueue helpers
│   └── config/                   # eslint/tsconfig/tailwind presets
├── services/
│   └── dispatcher/               # queue→Modal orchestrator (Node, Railway)
├── workers/
│   └── encoder/                  # FFmpeg CPU worker (Dockerfile ตัวเอง, Railway autoscale)
├── ai/                           # Python ทั้งหมด — แยกโลกจาก TS, CI แยก (pytest + golden set)
│   ├── worker/
│   │   ├── pipeline/             #   detect.py align.py animate.py enhance.py
│   │   ├── models/               #   model loading + pin revision hash
│   │   └── modal_app.py          #   Modal entrypoints + GPU config + keep_warm
│   ├── bakeoff/                  # สคริปต์ + ผล bake-off W1 (เก็บถาวร)
│   ├── golden/                   # golden set: รูปสมจริง 20 + สคริปต์ 10 + expected metrics
│   └── LICENSES.md               # license audit ทุก model/weight/dep — เอกสารบังคับ
├── infra/
│   ├── terraform/                # Cloudflare (DNS/R2/WAF) + Neon
│   ├── railway/                  # railway.json ต่อ service
│   └── runbooks/                 # dispatcher-down.md modal-outage.md stripe-freeze.md restore-db.md
├── docs/
│   ├── decisions/                # ADR-001..N = LOCKED DECISIONS ทั้ง 5 รอบ
│   ├── onboarding.md             # dev ใหม่ setup < 1 ชม.
│   └── pii-inventory.md          # PDPA: ข้อมูลอ่อนไหวอยู่ไหนบ้างทุกจุด
├── .github/workflows/            # ci.yml deploy-staging.yml promote-prod.yml
├── turbo.json / pnpm-workspace.yaml
└── docker-compose.yml            # local dev: postgres + redis + minio (แทน R2)
```

---

## 7. TEAM WORKFLOW (LOCKED)

- Kanban (GitHub Projects): Backlog → This Week → In Progress (WIP=1/คน)
  → In Review (WIP=3 ทั้งบอร์ด) → Testing/Staging → Done + lane 🔥 Incident
- จันทร์ 30 นาที: จัด This Week / ศุกร์ 30 นาที: demo จริงบน staging / daily = async Slack
- แบ่งงานตาม surface: A=backend core+billing, B=frontend, C=สลับตามคอขวด,
  D=AI pipeline (A pair เดือนแรก — แก้ bus factor), E=infra/CI/observability
- **API contract ตกลงก่อนเขียน** ใน `packages/contracts`
- **DoD**: code+test (logic เงิน = unit 100% path) / review 1 คน / deploy staging + ใช้เองจริง
  / มี metric-log / flag ปิดถ้ายังไม่พร้อม
- PR < 400 บรรทัด / review ภายใน 4 ชม. / งาน AI pipeline แนบ output video ใน PR

---

## 8. TOP 5 RISKS + MITIGATION

1. **(~40%) คุณภาพ face animation กับรูป user จริงไม่ถึงขั้นขายได้**
   → bake-off ด้วยรูปสมจริง + เกณฑ์ตัวเลขล่วงหน้า (15/20 ผ่าน)
   → แผนสำรอง: pivot เป็น stock avatar ก่อน, custom photo = beta label
2. **(~35%) Integration hell W4–W6** (chunk boundary + audio sync + retry + refund)
   → Gate 2 ที่ W5 บังคับเจอ pain เร็ว / ถ้า W6 ไม่นิ่ง = ตัด PromptPay + Admin UI ทันที
3. **(~25%) Free tier abuse / GPU bill รั่ว**
   → rate limit + watermark + circuit breaker เสร็จก่อน beta / cost/user dashboard ดูทุกเช้า
4. **(~15%) Bus factor — คนหลัก (D) หายกลางทาง**
   → pair AI pipeline เดือนแรก + runbook ทุก gate / เกิดจริง = ตัด scope สูตรทีม 3 คน ห้าม crunch
5. **(~15% ใน 3 เดือน / ~60% เดือน 4–6) Launch แล้วเงียบ — distribution**
   → W9 beta = จุดเริ่ม distribution / watermark + ลิงก์กลับทุกวิดีโอ free
   → founder ≥ 20% เวลากับ distribution ตั้งแต่ W9

---

## 9. ห้ามก่อหนี้เด็ดขาด (NON-NEGOTIABLE)

1. **License audit** — `ai/LICENSES.md` ต้องครบก่อน lock model
2. **Credit ledger integrity** — append-only, REVOKE ที่ DB
3. **PDPA hard deletion** — cascade ถึง R2 จริง + PII inventory
4. **Idempotency** — jobs + Stripe webhooks
