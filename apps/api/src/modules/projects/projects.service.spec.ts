import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ProjectsService } from './projects.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function makePrismaMock() {
  return {
    project: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

const USER = 'user-1';
const OTHER = 'user-2';
const PROJECT = { id: 'p1', userId: USER, title: 't', deletedAt: null };

describe('ProjectsService', () => {
  it('list กรอง userId + deletedAt: null เสมอ', async () => {
    const prisma = makePrismaMock();
    const service = new ProjectsService(prisma as unknown as PrismaService);
    await service.list(USER);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER, deletedAt: null } }),
    );
  });

  it('get ของ user อื่น → NotFound (กัน IDOR — query ต้อง scope userId)', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue(null);
    const service = new ProjectsService(prisma as unknown as PrismaService);
    await expect(service.get(OTHER, 'p1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', userId: OTHER, deletedAt: null },
    });
  });

  it('softDelete ตั้ง deletedAt ไม่ใช่ลบจริง', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue(PROJECT);
    const service = new ProjectsService(prisma as unknown as PrismaService);
    await service.softDelete(USER, 'p1');
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('update field ที่ไม่ได้ส่งมา ต้องไม่ถูกแตะ', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue(PROJECT);
    prisma.project.update.mockResolvedValue(PROJECT);
    const service = new ProjectsService(prisma as unknown as PrismaService);
    await service.update(USER, 'p1', { title: 'ใหม่' });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { title: 'ใหม่' },
    });
  });
});
