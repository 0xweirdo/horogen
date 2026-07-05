export interface VerifiedToken {
  clerkUserId: string;
}

/** DI token — สลับ implementation ได้ (Clerk จริง / fake ใน test) */
export abstract class TokenVerifier {
  abstract verify(token: string): Promise<VerifiedToken>;
}
