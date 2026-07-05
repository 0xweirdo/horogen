import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AuthGuard } from './auth.guard.js';
import type { TokenVerifier } from './token-verifier.js';
import type { UsersService } from '../users/users.service.js';

function contextWithAuth(header?: string): ExecutionContext {
  const req: Record<string, unknown> = { headers: { authorization: header } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const fakeVerifier = {
  verify: async (token: string) => {
    if (token !== 'valid-token') throw new UnauthorizedException('invalid token');
    return { clerkUserId: 'clerk_1' };
  },
} as TokenVerifier;

function fakeUsers(found: boolean): UsersService {
  return {
    findByClerkId: async () => (found ? { id: 'u1', clerkId: 'clerk_1' } : null),
  } as unknown as UsersService;
}

describe('AuthGuard', () => {
  it('ปฏิเสธ request ที่ไม่มี Authorization header → 401', async () => {
    const guard = new AuthGuard(fakeVerifier, fakeUsers(true));
    await expect(guard.canActivate(contextWithAuth(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('ปฏิเสธ header ที่ไม่ใช่ Bearer → 401', async () => {
    const guard = new AuthGuard(fakeVerifier, fakeUsers(true));
    await expect(guard.canActivate(contextWithAuth('Basic abc'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('ปฏิเสธ token ปลอม → 401', async () => {
    const guard = new AuthGuard(fakeVerifier, fakeUsers(true));
    await expect(guard.canActivate(contextWithAuth('Bearer bad-token'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('token ถูกแต่ user ยังไม่ sync → 403', async () => {
    const guard = new AuthGuard(fakeVerifier, fakeUsers(false));
    await expect(guard.canActivate(contextWithAuth('Bearer valid-token'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('token ถูก + user มีจริง → ผ่าน และแนบ user กับ request', async () => {
    const guard = new AuthGuard(fakeVerifier, fakeUsers(true));
    const ctx = contextWithAuth('Bearer valid-token');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest<{ user?: { id: string } }>();
    expect(req.user?.id).toBe('u1');
  });
});
