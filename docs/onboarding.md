# Onboarding — dev ใหม่ setup ให้เสร็จใน < 1 ชม.

## 1. เครื่องมือที่ต้องมี

| tool           | version | ติดตั้ง                                                                                      |
| -------------- | ------- | -------------------------------------------------------------------------------------------- |
| Node.js        | ≥ 22    | https://nodejs.org                                                                           |
| pnpm           | 9.x     | `npm install -g pnpm@9`                                                                      |
| Docker Desktop | ล่าสุด  | https://docker.com — ต้องมี `docker compose`                                                 |
| Git            | ≥ 2.40  | https://git-scm.com                                                                          |
| Doppler CLI    | ล่าสุด  | https://docs.doppler.com/docs/install-cli (ขอ invite เข้า project `heygen-th` จาก tech lead) |

ฝั่ง Python (เฉพาะคนแตะ `ai/`): Python 3.11+ + `pip install modal` + ขอ Modal workspace invite

## 2. Setup

```bash
git clone <repo-url> && cd heygen-th
pnpm install
cp .env.example .env          # ค่า local dev ใช้ได้เลย ไม่ต้องแก้
cp packages/db/.env.example packages/db/.env
docker compose up -d          # postgres :5433 / redis :6379 / minio :9000 (console :9001)
pnpm --filter @horogen/db run migrate:deploy   # สร้าง schema
pnpm --filter @horogen/db run seed             # dev user + demo project
```

> postgres ถูก map ที่ host port **5433** (ไม่ใช่ 5432) — กันชนกับ postgres native ที่หลายเครื่องมีอยู่แล้ว

ตรวจว่า infra ขึ้นครบ:

```bash
docker compose ps             # ทุก service ต้อง healthy, minio-init ต้อง Exited (0)
```

## 3. รัน checks

```bash
pnpm turbo lint typecheck test   # ต้องเขียวทั้งหมด
pnpm format:check
```

## 4. Secrets

- **ห้ามใส่ secret จริงใน `.env` แล้ว commit เด็ดขาด** — gitleaks ใน CI จะบล็อก PR
- Secret จริงอยู่ใน Doppler: `doppler setup` → เลือก project `heygen-th` config `dev`
  → รัน app ผ่าน `doppler run -- <command>` (เริ่มจำเป็นตั้งแต่ Phase 2: Clerk keys)

## 5. Workflow

- อ่าน [CLAUDE.md](../CLAUDE.md) (conventions + กฎเหล็ก) และ [PROJECT_SPEC.md](PROJECT_SPEC.md) (LOCKED decisions)
- trunk-based: feature branch ≤ 3 วัน → PR < 400 บรรทัด → squash merge / main เขียวเสมอ
- commit = conventional commits (`feat:` `fix:` `chore:` `ci:` `docs:`)

## Troubleshooting

- **port ชน**: postgres ของเรา map ที่ 5433 อยู่แล้ว — ถ้า redis/minio ชน ให้แก้ port mapping ฝั่งซ้ายใน docker-compose.yml (แล้วแก้ .env ให้ตรง)
- **pnpm install ล้ม engine-strict**: Node < 22 → อัปเกรด Node
- **minio-init ล้ม**: `docker compose up -d --force-recreate minio-init` หลัง minio healthy
