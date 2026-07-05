import { Controller, Get, UseGuards } from '@nestjs/common';
import type { UserProfileResponse } from '@horogen/contracts';
import type { User } from '@horogen/db';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller()
@UseGuards(AuthGuard)
export class UsersController {
  @Get('me')
  me(@CurrentUser() user: User): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      plan: user.plan,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
