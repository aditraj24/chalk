import { Router, Response } from 'express';
import { getDb, chats } from '@chalk/shared';
import type { CreateChatRequest, UpdateChatRequest } from '@chalk/shared';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { requireChatOwnership, ChatScopedRequest } from '../middleware/chatOwnership.js';

export const chatRoutes = Router();

// All chat routes require authentication
chatRoutes.use(requireAuth);

/**
 * GET /api/chats — List user's chats (excluding soft-deleted)
 */
chatRoutes.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const userChats = await db
      .select()
      .from(chats)
      .where(
        and(
          eq(chats.userId, req.userId!),
          isNull(chats.deletedAt),
        ),
      )
      .orderBy(desc(chats.updatedAt));

    res.json({ chats: userChats });
  } catch (error) {
    console.error('[Chats] List error:', error);
    res.status(500).json({ error: 'Failed to list chats' });
  }
});

/**
 * POST /api/chats — Create a new chat
 */
chatRoutes.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, mode, perfMode } = req.body as CreateChatRequest;

    if (!title || title.trim().length === 0) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const db = getDb();
    const [chat] = await db
      .insert(chats)
      .values({
        userId: req.userId!,
        title: title.trim(),
        mode: mode || 'focus',
        perfMode: perfMode || 'balanced',
      })
      .returning();

    res.status(201).json({ chat });
  } catch (error) {
    console.error('[Chats] Create error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

/**
 * PATCH /api/chats/:chatId — Update chat (rename, change mode/perfMode)
 */
chatRoutes.patch(
  '/:chatId',
  requireChatOwnership,
  async (req: ChatScopedRequest, res: Response) => {
    try {
      const { title, mode, perfMode } = req.body as UpdateChatRequest;
      const db = getDb();

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (title !== undefined) updateData.title = title.trim();
      if (mode !== undefined) updateData.mode = mode;
      if (perfMode !== undefined) updateData.perfMode = perfMode;

      const [updated] = await db
        .update(chats)
        .set(updateData)
        .where(eq(chats.id, req.chatId!))
        .returning();

      res.json({ chat: updated });
    } catch (error) {
      console.error('[Chats] Update error:', error);
      res.status(500).json({ error: 'Failed to update chat' });
    }
  },
);

/**
 * DELETE /api/chats/:chatId — Soft-delete a chat
 */
chatRoutes.delete(
  '/:chatId',
  requireChatOwnership,
  async (req: ChatScopedRequest, res: Response) => {
    try {
      const db = getDb();
      await db
        .update(chats)
        .set({ deletedAt: new Date() })
        .where(eq(chats.id, req.chatId!));

      res.json({ success: true });
    } catch (error) {
      console.error('[Chats] Delete error:', error);
      res.status(500).json({ error: 'Failed to delete chat' });
    }
  },
);
