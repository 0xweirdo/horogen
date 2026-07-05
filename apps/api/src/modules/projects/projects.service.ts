import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateProjectInput, UpdateProjectInput } from '@horogen/contracts';
import type { Prisma } from '@horogen/db';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, input: CreateProjectInput) {
    return this.prisma.project.create({
      data: {
        userId,
        title: input.title,
        scriptConfig: input.scriptConfig as Prisma.InputJsonObject,
      },
    });
  }

  list(userId: string) {
    return this.prisma.project.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** scope ด้วย userId เสมอ — id ของคนอื่นได้ 404 เหมือนไม่มีอยู่ (กัน IDOR) */
  async get(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('project not found');
    return project;
  }

  async update(userId: string, id: string, input: UpdateProjectInput) {
    await this.get(userId, id);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.scriptConfig !== undefined
          ? { scriptConfig: input.scriptConfig as Prisma.InputJsonObject }
          : {}),
      },
    });
  }

  async softDelete(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
