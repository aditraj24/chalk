import { Job } from 'bullmq';
import pdfParse from 'pdf-parse';
import { getDb, documents, chunks } from '@chalk/shared';
import {
  CHUNK_SIZE_CHARS,
  CHUNK_OVERLAP_CHARS,
  EMBEDDING_DIMENSION,
} from '@chalk/shared';
import type { IngestionJob } from '@chalk/shared';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

// ─── Embedding (local BGE-M3 via ONNX) ────────────────
let extractor: any = null;

async function getExtractor() {
  if (extractor) return extractor;
  const { pipeline } = await import('@xenova/transformers');
  extractor = await pipeline('feature-extraction', 'Xenova/bge-m3', {
    quantized: true,
  });
  console.log('[Ingest] BGE-M3 embedding model loaded');
  return extractor;
}

async function embedText(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: 'cls', normalize: true });
  return Array.from(output.data as Float32Array).slice(0, EMBEDDING_DIMENSION);
}

// ─── Ingestion Processor ───────────────────────────────

/**
 * Process a PDF ingestion job:
 * 1. Download PDF from local storage
 * 2. Extract text with pdf-parse (preserving page numbers)
 * 3. Chunk text semantically
 * 4. Embed chunks (BGE-M3, local ONNX)
 * 5. Store chunks + embeddings in Postgres
 * 6. Update document status
 */
export async function processIngestion(job: Job<IngestionJob>): Promise<void> {
  const { documentId, chatId, s3Key, filename } = job.data;
  const db = getDb();

  try {
    // ─── Update status: processing ─────────────────
    await db
      .update(documents)
      .set({ status: 'processing' })
      .where(eq(documents.id, documentId));

    await job.updateProgress(10);

    // ─── Step 1: Read PDF from local storage ───────
    const basePath = path.resolve(process.cwd(), 'uploads');
    const filePath = path.join(basePath, s3Key);
    const pdfBuffer = await fs.readFile(filePath);

    await job.updateProgress(20);

    // ─── Step 2: Extract text ──────────────────────
    const pdfData = await pdfParse(pdfBuffer);
    const fullText = pdfData.text;
    const pageCount = pdfData.numpages;

    // Update page count
    await db
      .update(documents)
      .set({ pageCount })
      .where(eq(documents.id, documentId));

    await job.updateProgress(30);
    console.log(`[Ingest] Extracted ${pageCount} pages, ${fullText.length} chars from ${filename}`);

    // ─── Step 3: Semantic chunking ─────────────────
    const textChunks = chunkText(fullText, pageCount);

    await job.updateProgress(50);
    console.log(`[Ingest] Created ${textChunks.length} chunks from ${filename}`);

    // ─── Step 4: Embed and store chunks ────────────
    const ext = await getExtractor(); // Ensure model is loaded

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];

      // Embed the chunk
      const embedding = await embedText(chunk.content);

      // Insert into database
      await db.insert(chunks).values({
        documentId,
        chatId,
        content: chunk.content,
        embedding,
        tokenCount: Math.ceil(chunk.content.length / 4), // rough estimate
        pageNumber: chunk.pageNumber,
        chunkIndex: i,
        sectionHeading: chunk.sectionHeading,
      });

      // Update progress (50% to 90% during embedding)
      const embeddingProgress = 50 + Math.round((i / textChunks.length) * 40);
      await job.updateProgress(embeddingProgress);
    }

    // ─── Step 5: Update status: ready ──────────────
    await db
      .update(documents)
      .set({ status: 'ready' })
      .where(eq(documents.id, documentId));

    await job.updateProgress(100);
    console.log(`[Ingest] ✅ ${filename} ingested: ${textChunks.length} chunks embedded`);

  } catch (error) {
    console.error(`[Ingest] ❌ Failed to ingest ${filename}:`, error);

    // Update status: failed
    await db
      .update(documents)
      .set({ status: 'failed' })
      .where(eq(documents.id, documentId));

    throw error; // Re-throw for BullMQ retry logic
  }
}

// ─── Chunking Logic ────────────────────────────────────

interface TextChunk {
  content: string;
  pageNumber: number | null;
  sectionHeading: string | null;
}

/**
 * Semantic-aware text chunking.
 * Splits at paragraph/section boundaries, not fixed character count.
 * Target: ~300-500 tokens (~1200-2000 chars) with 15% overlap.
 */
function chunkText(text: string, totalPages: number): TextChunk[] {
  const result: TextChunk[] = [];

  // Split by paragraph breaks (double newlines) and heading patterns
  const paragraphs = text.split(/\n{2,}/);

  let currentChunk = '';
  let currentHeading: string | null = null;
  let currentPage = 1;

  // Simple page estimation based on character position
  const charsPerPage = text.length / Math.max(totalPages, 1);

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // Detect section headings (ALL CAPS, numbered sections, etc.)
    const headingMatch = trimmed.match(/^(?:(?:Chapter|Section|Part)\s+\d+[.:]\s*|(?:\d+\.)+\s*)?([A-Z][A-Z\s]{3,})$/m)
      || trimmed.match(/^(?:(?:\d+\.)+\s*)(.{3,80})$/m);

    if (headingMatch && trimmed.length < 100) {
      currentHeading = trimmed;
    }

    // Would adding this paragraph exceed the chunk size?
    if (currentChunk.length + trimmed.length > CHUNK_SIZE_CHARS && currentChunk.length > 0) {
      // Estimate page number based on position in text
      const chunkStartPos = text.indexOf(currentChunk.slice(0, 50));
      const estimatedPage = Math.min(
        Math.ceil((chunkStartPos >= 0 ? chunkStartPos : 0) / charsPerPage),
        totalPages,
      ) || 1;

      result.push({
        content: currentChunk.trim(),
        pageNumber: estimatedPage,
        sectionHeading: currentHeading,
      });

      // Keep overlap from the end of the previous chunk
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP_CHARS);
      currentChunk = currentChunk.slice(overlapStart) + '\n\n' + trimmed;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    const chunkStartPos = text.indexOf(currentChunk.trim().slice(0, 50));
    const estimatedPage = Math.min(
      Math.ceil((chunkStartPos >= 0 ? chunkStartPos : 0) / charsPerPage),
      totalPages,
    ) || 1;

    result.push({
      content: currentChunk.trim(),
      pageNumber: estimatedPage,
      sectionHeading: currentHeading,
    });
  }

  return result;
}
