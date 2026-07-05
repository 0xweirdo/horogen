import { z } from 'zod';

// Job state machine — LOCKED ใน docs/PROJECT_SPEC.md §2 (Data Flow Rules)
// ค่าใน enum ต้องตรงกับ CHECK constraint ของตาราง jobs เสมอ
export const JOB_STATUSES = [
  'QUEUED',
  'TTS_RUNNING',
  'ANIMATING',
  'ENCODING',
  'DONE',
  'FAILED',
  'CANCELLED',
] as const;

export const jobStatusSchema = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const JOB_PRIORITIES = ['standard', 'paid'] as const;

export const jobPrioritySchema = z.enum(JOB_PRIORITIES);
export type JobPriority = z.infer<typeof jobPrioritySchema>;

/** สถานะปลายทางที่ job ไม่วิ่งต่อแล้ว (ใช้ร่วมกับ partial index ใน DB) */
export const TERMINAL_JOB_STATUSES = [
  'DONE',
  'FAILED',
  'CANCELLED',
] as const satisfies readonly JobStatus[];

export function isTerminalStatus(status: JobStatus): boolean {
  return (TERMINAL_JOB_STATUSES as readonly JobStatus[]).includes(status);
}
