// สร้าง openapi.json จาก zod schemas — contract-first ตาม spec
// รัน: pnpm --filter @horogen/contracts run openapi (แล้ว commit ไฟล์ที่ generate)

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// patch ZodType.prototype ให้มี .openapi() — มีผลถึง schema ที่ import มาแล้วด้วย
extendZodWithOpenApi(z);

import { apiErrorSchema } from '../src/errors.js';
import {
  createProjectSchema,
  projectResponseSchema,
  updateProjectSchema,
} from '../src/projects.js';
import { userProfileResponseSchema } from '../src/users.js';

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT (Clerk session token)',
});

const ApiError = registry.register('ApiError', apiErrorSchema);
const UserProfile = registry.register('UserProfile', userProfileResponseSchema);
const Project = registry.register('Project', projectResponseSchema);
const CreateProject = registry.register('CreateProjectInput', createProjectSchema);
const UpdateProject = registry.register('UpdateProjectInput', updateProjectSchema);

const security = [{ [bearerAuth.name]: [] }];
const errorResponses = {
  400: { description: 'Validation error', content: { 'application/json': { schema: ApiError } } },
  401: { description: 'Unauthenticated', content: { 'application/json': { schema: ApiError } } },
  403: { description: 'Forbidden', content: { 'application/json': { schema: ApiError } } },
  404: { description: 'Not found', content: { 'application/json': { schema: ApiError } } },
};

registry.registerPath({
  method: 'get',
  path: '/v1/health',
  responses: {
    200: {
      description: 'Service health',
      content: {
        'application/json': { schema: z.object({ status: z.string(), db: z.string() }) },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/v1/me',
  security,
  responses: {
    200: {
      description: 'Current user profile',
      content: { 'application/json': { schema: UserProfile } },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/v1/projects',
  security,
  request: { body: { content: { 'application/json': { schema: CreateProject } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: Project } } },
    400: errorResponses[400],
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'get',
  path: '/v1/projects',
  security,
  responses: {
    200: {
      description: 'Projects ของ user (ไม่รวมที่ soft-deleted)',
      content: { 'application/json': { schema: z.array(Project) } },
    },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'get',
  path: '/v1/projects/{id}',
  security,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Project', content: { 'application/json': { schema: Project } } },
    401: errorResponses[401],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/v1/projects/{id}',
  security,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateProject } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: Project } } },
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/v1/projects/{id}',
  security,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Soft-deleted' },
    401: errorResponses[401],
    404: errorResponses[404],
  },
});

const doc = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: '3.0.3',
  info: {
    title: 'Horogen API',
    version: '0.1.0',
    description: 'Thai-first Talking Avatar Platform — contract-first จาก zod schemas',
  },
});

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.json');
writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote ${out}`);
