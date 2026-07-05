import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';

import { env } from '../../config/env.js';
import { TokenVerifier, type VerifiedToken } from './token-verifier.js';

@Injectable()
export class ClerkTokenVerifier extends TokenVerifier {
  async verify(token: string): Promise<VerifiedToken> {
    if (!env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }
    try {
      const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
      return { clerkUserId: payload.sub };
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }
}
