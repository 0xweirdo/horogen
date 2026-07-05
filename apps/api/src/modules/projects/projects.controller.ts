import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type ProjectResponse,
  type UpdateProjectInput,
} from '@horogen/contracts';
import type { Project, User } from '@horogen/db';
import { z } from 'zod';

import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ProjectsService } from './projects.service.js';

const uuidPipe = new ZodValidationPipe(z.string().uuid());

function toResponse(project: Project): ProjectResponse {
  return {
    id: project.id,
    title: project.title,
    scriptConfig: (project.scriptConfig ?? {}) as Record<string, unknown>,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ): Promise<ProjectResponse> {
    return toResponse(await this.projects.create(user.id, body));
  }

  @Get()
  async list(@CurrentUser() user: User): Promise<ProjectResponse[]> {
    return (await this.projects.list(user.id)).map(toResponse);
  }

  @Get(':id')
  async get(
    @CurrentUser() user: User,
    @Param('id', uuidPipe) id: string,
  ): Promise<ProjectResponse> {
    return toResponse(await this.projects.get(user.id, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ): Promise<ProjectResponse> {
    return toResponse(await this.projects.update(user.id, id, body));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id', uuidPipe) id: string): Promise<void> {
    await this.projects.softDelete(user.id, id);
  }
}
