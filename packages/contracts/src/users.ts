import { z } from 'zod';

/** GET /v1/me */
export const userProfileResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  plan: z.string(),
  createdAt: z.string().datetime(),
});
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
