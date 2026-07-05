import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByClerkId(clerkId: string) {
    return this.prisma.user.findFirst({ where: { clerkId, deletedAt: null } });
  }

  upsertFromClerk(input: { clerkId: string; email: string }) {
    return this.prisma.user.upsert({
      where: { clerkId: input.clerkId },
      create: { clerkId: input.clerkId, email: input.email },
      // user.updated หลังเคย soft-delete = บัญชีกลับมา active
      update: { email: input.email, deletedAt: null },
    });
  }

  softDeleteByClerkId(clerkId: string) {
    return this.prisma.user.updateMany({
      where: { clerkId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
