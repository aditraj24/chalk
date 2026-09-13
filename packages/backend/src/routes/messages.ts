import { Router, Response } from 'express';
import { getDb, getReadDb, messages, chats } from '@chalk/shared';
import type { SendMessageRequest, ResumeSearchRequest } from '@chalk/shared';
import { eq, asc, desc, and, lt } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { requireChatOwnership, ChatScopedRequest } from '../middleware/chatOwnership.js';
import { ragPipeline, resumeRagPipeline } from '../services/rag.js';

export const messageRoutes = Router();

// All message routes require auth + chat ownership
messageRoutes.use(requireAuth);

/**
 * GET /api/chats/:chatId/messages — Get message history
 */
messageRoutes.get(
  '/:chatId/messages',
  requireChatOwnership,
  async (req: ChatScopedRequest, res: Response) => {
    try {
      const db = getReadDb();
      const limitParam = parseInt(req.query.limit as string) || 50;
      const cursor = req.query.cursor as string;

      let query = db
        .select()
        .from(messages)
        .where(eq(messages.chatId, req.chatId!))
        .orderBy(desc(messages.createdAt))
        .limit(limitParam + 1);

      if (cursor) {
        query = db
          .select()
          .from(messages)
          .where(and(eq(messages.chatId, req.chatId!), lt(messages.createdAt, new Date(cursor))))
          .orderBy(desc(messages.createdAt))
          .limit(limitParam + 1);
      }

      const results = await query;
      const hasMore = results.length > limitParam;
      const data = hasMore ? results.slice(0, limitParam) : results;

      // Reverse so frontend gets chronological order
      const chatMessages = data.reverse();

      res.json({ messages: chatMessages, hasMore });
    } catch (error) {
      console.error('[Messages] History error:', error);
      res.status(500).json({ error: 'Failed to fetch message history' });
    }
  },
);

/**
 * POST /api/chats/:chatId/messages — Send a query and stream response via SSE
 */
messageRoutes.post(
  '/:chatId/messages',
  requireChatOwnership,
  async (req: ChatScopedRequest, res: Response) => {
    try {
      const { content } = req.body as SendMessageRequest;

      if (!content || content.trim().length === 0) {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }

      const db = getDb();

      // Fetch the chat's current mode configuration and title
      const [chatRecord] = await db
        .select({
          title: chats.title,
          mode: chats.mode,
          perfMode: chats.perfMode,
          autoSearch: chats.autoSearch,
        })
        .from(chats)
        .where(eq(chats.id, req.chatId!))
        .limit(1);

      if (!chatRecord) {
        res.status(404).json({ error: 'Chat not found' });
        return;
      }

      // Auto-update chat title on first message if still default
      if (
        chatRecord.title === 'New Study Session' ||
        chatRecord.title === 'New Session' ||
        !chatRecord.title
      ) {
        const cleanPrompt = content.trim().replace(/\s+/g, ' ');
        const autoTitle = cleanPrompt.length > 36 ? cleanPrompt.slice(0, 36).trim() + '...' : cleanPrompt;
        if (autoTitle) {
          await db
            .update(chats)
            .set({ title: autoTitle, updatedAt: new Date() })
            .where(eq(chats.id, req.chatId!));
        }
      }

      // Persist the user message
      await db
        .insert(messages)
        .values({
          chatId: req.chatId!,
          role: 'user',
          content: content.trim(),
        });

      // Set up SSE headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders();

      // Run the RAG pipeline and stream the response
      await ragPipeline({
        chatId: req.chatId!,
        query: content.trim(),
        mode: chatRecord.mode as 'focus' | 'agent' | 'explore',
        perfMode: chatRecord.perfMode as 'speed' | 'balanced' | 'accuracy',
        autoSearch: chatRecord.autoSearch ?? true,
        onToken: (token: string) => {
          res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
        },
        onCitations: (citations) => {
          res.write(`data: ${JSON.stringify({ type: 'citations', citations })}\n\n`);
        },
        onInterrupt: (payload) => {
          // Interrupt reached: notify frontend of confirmation prompt and finish SSE stream
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
          res.end();
        },
        onComplete: (fullContent: string, chunkIds: string[]) => {
          // Persist the assistant message
          db.insert(messages)
            .values({
              chatId: req.chatId!,
              role: 'assistant',
              content: fullContent,
              modeUsed: chatRecord.mode,
              retrievedChunkIds: JSON.stringify(chunkIds),
            })
            .then(() => {
              res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
              res.end();
            })
            .catch((err: unknown) => {
              console.error('[Messages] Persist error:', err);
              res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to save response' })}\n\n`);
              res.end();
            });
        },
        onError: (error: string) => {
          res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
          res.end();
        },
      });
    } catch (error) {
      console.error('[Messages] Send error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process message' });
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
        res.end();
      }
    }
  },
);

/**
 * POST /api/chats/:chatId/messages/resume — Resume interrupted search after student confirms or declines
 */
messageRoutes.post(
  '/:chatId/messages/resume',
  requireChatOwnership,
  async (req: ChatScopedRequest, res: Response) => {
    try {
      const { confirmed } = req.body as ResumeSearchRequest;

      const db = getDb();
      const [chatRecord] = await db
        .select({ mode: chats.mode })
        .from(chats)
        .where(eq(chats.id, req.chatId!))
        .limit(1);

      if (!chatRecord) {
        res.status(404).json({ error: 'Chat not found' });
        return;
      }

      // Set up SSE headers for streaming resumed generation
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      await resumeRagPipeline({
        chatId: req.chatId!,
        confirmed: Boolean(confirmed),
        onToken: (token: string) => {
          res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
        },
        onCitations: (citations) => {
          res.write(`data: ${JSON.stringify({ type: 'citations', citations })}\n\n`);
        },
        onComplete: (fullContent: string, chunkIds: string[]) => {
          db.insert(messages)
            .values({
              chatId: req.chatId!,
              role: 'assistant',
              content: fullContent,
              modeUsed: chatRecord.mode || 'agent',
              retrievedChunkIds: JSON.stringify(chunkIds),
            })
            .then(() => {
              res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
              res.end();
            })
            .catch((err: unknown) => {
              console.error('[Messages] Persist error on resume:', err);
              res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to save response' })}\n\n`);
              res.end();
            });
        },
        onError: (error: string) => {
          res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
          res.end();
        },
      });
    } catch (error) {
      console.error('[Messages] Resume error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to resume search' });
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
        res.end();
      }
    }
  },
);

