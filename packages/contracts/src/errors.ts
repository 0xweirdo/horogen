import { z } from 'zod';

/** รูปแบบ error มาตรฐานของ NestJS ที่ API ใช้ทุก endpoint */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
