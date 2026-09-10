import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { getDb, users } from '@chalk/shared';
import { eq } from 'drizzle-orm';

/**
 * Extends Express Request with authenticated user info.
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;    // Internal Chalk user UUID
  clerkId?: string;   // Clerk user ID
}

/**
 * Middleware that requires Clerk authentication and resolves/creates
 * the internal Chalk user record. Attaches `userId` and `clerkId` to the request.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = getAuth(req);

    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized — no valid session' });
      return;
    }

    const clerkId = auth.userId;
    const db = getDb();

    // Find or create user by Clerk ID
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      // Auto-create user record on first API call after Clerk signup
      const sessionClaims = (auth as Record<string, unknown>).sessionClaims as Record<string, unknown> | undefined;
      let email =
        (typeof sessionClaims?.email === 'string' && sessionClaims.email.trim()) ||
        (typeof sessionClaims?.primary_email_address === 'string' && sessionClaims.primary_email_address.trim()) ||
        null;

      if (!email) {
        email = `${clerkId}@clerk.user`;
      }

      [user] = await db
        .insert(users)
        .values({ clerkId, email })
        .returning();
    }

    req.userId = user.id;
    req.clerkId = clerkId;
    next();
  } catch (error) {
    console.error('[Auth] Error:', error);
    const message = error instanceof Error ? error.message : 'Authentication error';
    res.status(500).json({ error: message });
  }
}
