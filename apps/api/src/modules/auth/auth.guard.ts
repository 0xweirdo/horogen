import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@horogen/db';
import type { Request } from 'express';

import { UsersService } from '../users/users.service.js';
import { TokenVerifier } from './token-verifier.js';

export interface AuthenticatedRequest extends Request {
  user: User;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly verifier: TokenVerifier,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }

    const { clerkUserId } = await this.verifier.verify(header.slice('Bearer '.length));

    const user = await this.users.findByClerkId(clerkUserId);
    if (!user) {
      // user ต้องถูกสร้างผ่าน Clerk webhook ก่อน — ถ้ายังไม่ sync ถือว่าไม่มีสิทธิ์
      throw new ForbiddenException('user not synced');
    }

    req.user = user;
    return true;
  }
}
