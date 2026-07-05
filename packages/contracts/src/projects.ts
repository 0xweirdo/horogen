import { z } from 'zod';

export const PROJECT_TITLE_MAX = 200;

/** POST /v1/projects (body) */
export const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(PROJECT_TITLE_MAX),
  scriptConfig: z.record(z.unknown()).default({}),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** PATCH /v1/projects/:id (body) */
export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(PROJECT_TITLE_MAX),
    scriptConfig: z.record(z.unknown()),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'body must not be empty' });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  scriptConfig: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProjectResponse = z.infer<typeof projectResponseSchema>;

/** GET /v1/projects */
export const projectListResponseSchema = z.array(projectResponseSchema);
