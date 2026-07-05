# ai/ — Python world

แยกโลกจาก TypeScript ทั้งหมด — ไม่อยู่ใน pnpm workspace, CI แยก (ruff + pytest + golden set)

- `worker/` — Modal GPU pipeline: detect → align → animate → enhance (Phase A2)
- `bakeoff/` — สคริปต์ + ผล bake-off 4 models (Phase A1 — เก็บถาวร)
- `golden/` — golden set: รูปสมจริง 20 + สคริปต์ไทย 10 + expected metrics
- `LICENSES.md` — license audit ทุก model/weight/dep — **ต้องครบก่อน lock model (GATE 1)**

⛔ ห้ามใช้: Wav2Lip / InsightFace / RetinaFace pretrained weights / CodeFormer / XTTS-v2
(non-commercial license ทั้งหมด — ดู docs/PROJECT_SPEC.md §3)
