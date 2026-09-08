import { Router, Response } from 'express';
import { getDb, documents, chunks } from '@chalk/shared';
import { INGESTION_QUEUE_NAME, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from '@chalk/shared';
import { eq, and } from 'drizzle-orm';
import { Queue } from 'bullmq';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { requireChatOwnership, ChatScopedRequest } from '../middleware/chatOwnership.js';
import { storageService } from '../services/storage.js';
import type { IngestionJob } from '@chalk/shared';

export const documentRoutes = Router();

// All document routes require auth + chat ownership
documentRoutes.use(requireAuth);

// Configure multer for PDF uploads (in-memory buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_MIME_TYPES[number])) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// BullMQ queue for ingestion jobs
const ingestionQueue = new Queue(INGESTION_QUEUE_NAME, {
  connection: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
});

/**
 * POST /api/chats/:chatId/documents — Upload PDF(s) and trigger ingestion
 */
documentRoutes.post(
  '/:chatId/documents',
  requireChatOwnership,
  upload.array('files', 10), // max 10 files per upload
  async (req: ChatScopedRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const db = getDb();
      const createdDocs = [];

      for (const file of files) {
        const documentId = uuidv4();
        const s3Key = `${req.userId}/${req.chatId}/raw/${documentId}.pdf`;

        // Upload to storage (local fs or S3)
        await storageService.uploadFile(s3Key, file.buffer);

        // Create document record
        const [doc] = await db
          .insert(documents)
          .values({
            id: documentId,
            chatId: req.chatId!,
            filename: file.originalname,
            s3Key,
            docType: (req.body.docType as string) || null,
            status: 'pending',
          })
          .returning();

        // Queue ingestion job
        const job: IngestionJob = {
          documentId: doc.id,
          chatId: req.chatId!,
          userId: req.userId!,
          s3Key,
          filename: file.originalname,
        };

        await ingestionQueue.add('ingest', job, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });

        createdDocs.push(doc);
      }

      res.status(201).json({ documents: createdDocs });
    } catch (error) {
      console.error('[Documents] Upload error:', error);
      res.status(500).json({ error: 'Failed to upload documents' });
    }
  },
);

/**
 * GET /api/chats/:chatId/documents — List documents and their status
 */
documentRoutes.get(
  '/:chatId/documents',
  requireChatOwnership,
  async (req: ChatScopedRequest, res: Response) => {
    try {
      const db = getDb();
      const docs = await db
        .select()
        .from(documents)
        .where(eq(documents.chatId, req.chatId!));

      res.json({ documents: docs });
    } catch (error) {
      console.error('[Documents] List error:', error);
      res.status(500).json({ error: 'Failed to list documents' });
    }
  },
);

/**
 * DELETE /api/chats/:chatId/documents/:docId — Delete a document and its chunks
 */
documentRoutes.delete(
  '/:chatId/documents/:docId',
  requireChatOwnership,
  async (req: ChatScopedRequest, res: Response) => {
    try {
      const { docId } = req.params;
      const db = getDb();

      // Verify the document belongs to this chat
      const [doc] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, docId),
            eq(documents.chatId, req.chatId!),
          ),
        )
        .limit(1);

      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      // Delete chunks first (referential integrity)
      await db.delete(chunks).where(eq(chunks.documentId, docId));

      // Delete document record
      await db.delete(documents).where(eq(documents.id, docId));

      // Delete from storage
      await storageService.deleteFile(doc.s3Key);

      res.json({ success: true });
    } catch (error) {
      console.error('[Documents] Delete error:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  },
);
