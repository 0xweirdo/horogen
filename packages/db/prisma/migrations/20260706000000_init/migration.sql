-- Initial schema ตาม docs/PROJECT_SPEC.md §4 (LOCKED)
-- ส่วนบน = Prisma-canonical DDL / ส่วนล่าง = CUSTOM SQL ที่ Prisma model ไม่ได้
-- หมายเหตุ: id ของ credit_ledger ใช้ BIGSERIAL (Prisma canonical) แทน IDENTITY ใน spec
--   — พฤติกรรม append-only เท่ากัน บังคับด้วย REVOKE ด้านล่าง

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerk_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "script_config" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "priority" TEXT NOT NULL DEFAULT 'standard',
    "input_config" JSONB NOT NULL,
    "output_asset_id" UUID,
    "model_version" TEXT NOT NULL,
    "gpu_seconds" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(10,5) NOT NULL DEFAULT 0,
    "fail_reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "delta_credits" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "job_id" UUID,
    "stripe_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "bytes" BIGINT,
    "sha256" TEXT,
    "purge_after" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable (CUSTOM: partitioned by month ตั้งแต่สร้าง — LOCKED spec)
CREATE TABLE "job_events" (
    "id" BIGSERIAL NOT NULL,
    "job_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id","created_at")
) PARTITION BY RANGE ("created_at");

-- CreateTable
CREATE TABLE "subscriptions" (
    "user_id" UUID NOT NULL,
    "stripe_sub_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "period_end" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE INDEX "idx_projects_user" ON "projects"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_idempotency_key_key" ON "jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_jobs_user_created" ON "jobs"("user_id", "created_at" DESC);

-- CreateIndex (CUSTOM: + INCLUDE สำหรับ cost report รายเดือน — LOCKED spec)
CREATE INDEX "idx_jobs_cost_month" ON "jobs"("created_at") INCLUDE ("cost_usd", "gpu_seconds");

-- CreateIndex
CREATE INDEX "idx_ledger_user" ON "credit_ledger"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "assets_r2_key_key" ON "assets"("r2_key");

-- CreateIndex
CREATE INDEX "idx_job_events_job" ON "job_events"("job_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_sub_id_key" ON "subscriptions"("stripe_sub_id");

-- CreateIndex
CREATE INDEX "idx_audit_user" ON "audit_logs"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_output_asset_id_fkey" FOREIGN KEY ("output_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
-- CUSTOM SQL — นอกเหนือความสามารถของ Prisma (LOCKED spec ทั้งหมด)
-- Prisma migrate diff ไม่ model สิ่งเหล่านี้ จึงไม่เกิด drift
-- ═══════════════════════════════════════════════════════════════════

-- ── CHECK constraints (state machine + enum values บังคับที่ระดับ DB) ──
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_status_check"
  CHECK (status IN ('QUEUED','TTS_RUNNING','ANIMATING','ENCODING','DONE','FAILED','CANCELLED'));

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_priority_check"
  CHECK (priority IN ('standard','paid'));

ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_reason_check"
  CHECK (reason IN ('purchase','subscription_grant','hold','capture','refund','bonus','admin_adjust'));

ALTER TABLE "assets" ADD CONSTRAINT "assets_kind_check"
  CHECK (kind IN ('avatar_photo','audio','video_output','thumbnail'));

ALTER TABLE "job_events" ADD CONSTRAINT "job_events_status_check"
  CHECK (status IN ('QUEUED','TTS_RUNNING','ANIMATING','ENCODING','DONE','FAILED','CANCELLED'));

-- ── Partial indexes ──
-- jobs ที่ยังวิ่งอยู่ (คิวใช้บ่อยสุด — index เล็กเพราะไม่รวม terminal states)
CREATE INDEX "idx_jobs_status" ON "jobs"("status")
  WHERE status NOT IN ('DONE','FAILED','CANCELLED');

-- retention scan รายวัน (PDPA purge)
CREATE INDEX "idx_assets_purge" ON "assets"("purge_after")
  WHERE deleted_at IS NULL;

-- ── job_events: monthly partitions (ล่วงหน้า 12 เดือน + DEFAULT กันหลุด) ──
-- การสร้าง partition เดือนใหม่อัตโนมัติ = งาน ops job ใน Phase 8
CREATE TABLE "job_events_2026_07" PARTITION OF "job_events" FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');
CREATE TABLE "job_events_2026_08" PARTITION OF "job_events" FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');
CREATE TABLE "job_events_2026_09" PARTITION OF "job_events" FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
CREATE TABLE "job_events_2026_10" PARTITION OF "job_events" FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE "job_events_2026_11" PARTITION OF "job_events" FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE "job_events_2026_12" PARTITION OF "job_events" FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE "job_events_2027_01" PARTITION OF "job_events" FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');
CREATE TABLE "job_events_2027_02" PARTITION OF "job_events" FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');
CREATE TABLE "job_events_2027_03" PARTITION OF "job_events" FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');
CREATE TABLE "job_events_2027_04" PARTITION OF "job_events" FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');
CREATE TABLE "job_events_2027_05" PARTITION OF "job_events" FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');
CREATE TABLE "job_events_2027_06" PARTITION OF "job_events" FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');
CREATE TABLE "job_events_default" PARTITION OF "job_events" DEFAULT;

-- ── app_role: สิทธิ์ runtime ของแอป — credit_ledger เป็น append-only เท่านั้น ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role NOLOGIN;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON "users", "projects", "jobs", "assets", "subscriptions", "audit_logs", "job_events"
  TO app_role;

GRANT SELECT, INSERT ON "credit_ledger" TO app_role;
REVOKE UPDATE, DELETE ON "credit_ledger" FROM app_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;
