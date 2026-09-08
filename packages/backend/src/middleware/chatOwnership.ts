import { Response, NextFunction } from 'express';
import { getDb, chats } from '@chalk/shared';
import { eq, and, isNull } from 'drizzle-orm';
import { AuthenticatedRequest } from './auth.js';

/**
 * Extends request with the verified chat ID.
 */
export interface ChatScopedRequest extends AuthenticatedRequest {
  chatId?: string;
}

/**
 * Middleware that verifies the authenticated user owns the requested chat.
 * Per architecture doc: "never trust a client-supplied chat_id alone."
 *
 * Expects `req.params.chatId` and `req.userId` to be set.
 */
export async function requireChatOwnership(
  req: ChatScopedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const chatId = req.params.chatId as string;
    const userId = req.userId;

    if (!chatId || !userId) {
      res.status(400).json({ error: 'Missing chat ID or user authentication' });
      return;
    }

    const db = getDb();

    const [chat] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, userId),
          isNull(chats.deletedAt), // exclude soft-deleted chats
        ),
      )
      .limit(1);

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    req.chatId = chatId as string;
    next();
  } catch (error) {
    console.error('[ChatOwnership] Error:', error);
    res.status(500).json({ error: 'Failed to verify chat ownership' });
  }
}
