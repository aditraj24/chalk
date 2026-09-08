import { getDb, chunks, documents } from '@chalk/shared';
import { TOP_K } from '@chalk/shared';
import type { RetrievedChunk, CitationMarker } from '@chalk/shared';
import { eq, sql } from 'drizzle-orm';
import { getLlm, buildFocusSystemPrompt } from './llm.js';
import { getEmbedding } from './embeddings.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// ─── RAG Pipeline Types ────────────────────────────────

interface RagPipelineParams {
  chatId: string;
  query: string;
  onToken: (token: string) => void;
  onCitations: (citations: CitationMarker[]) => void;
  onComplete: (fullContent: string, chunkIds: string[]) => void;
  onError: (error: string) => void;
}

/**
 * MVP RAG pipeline (Phase 1 — Focus mode, dense-only retrieval):
 * 1. Embed the query
 * 2. Dense retrieval (pgvector cosine similarity, chat-scoped)
 * 3. Build context with citations
 * 4. Generate with Groq (Llama 3.3 70B), streaming
 * 5. Return result
 */
export async function ragPipeline(params: RagPipelineParams): Promise<void> {
  const { chatId, query, onToken, onCitations, onComplete, onError } = params;

  try {
    // ─── Step 1: Embed the query ─────────────────────
    const queryEmbedding = await getEmbedding(query);

    // ─── Step 2: Dense retrieval (pgvector) ──────────
    const topK = TOP_K.balanced; // MVP uses balanced mode
    const retrievedChunks = await denseRetrieve(chatId, queryEmbedding, topK);

    if (retrievedChunks.length === 0) {
      const noContentMsg = "Your notes don't seem to cover this topic. Try uploading more documents or switch to Explore mode for a broader search.";
      onToken(noContentMsg);
      onComplete(noContentMsg, []);
      return;
    }

    // ─── Step 3: Build context with citation markers ─
    const { contextBlock, citations } = buildContext(retrievedChunks);
    onCitations(citations);

    // ─── Step 4: Generate with Groq (streamed) ───────
    const llm = getLlm(true);
    const systemPrompt = buildFocusSystemPrompt(contextBlock);

    const stream = await llm.stream([
      new SystemMessage(systemPrompt),
      new HumanMessage(query),
    ]);

    let fullContent = '';
    const chunkIds = retrievedChunks.map((c) => c.id);

    for await (const chunk of stream) {
      const token = chunk.content as string;
      if (token) {
        fullContent += token;
        onToken(token);
      }
    }

    // ─── Step 5: Complete ────────────────────────────
    onComplete(fullContent, chunkIds);
  } catch (error) {
    console.error('[RAG] Pipeline error:', error);
    onError(error instanceof Error ? error.message : 'RAG pipeline failed');
  }
}

/**
 * Dense retrieval using pgvector cosine similarity.
 * CRITICAL: Always scoped by chat_id per architecture doc.
 */
async function denseRetrieve(
  chatId: string,
  queryEmbedding: number[],
  topK: number,
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Raw SQL for pgvector cosine similarity with chat_id scoping
  const result = await db.execute(sql`
    SELECT
      c.id,
      c.content,
      c.document_id,
      c.page_number,
      c.section_heading,
      d.filename,
      1 - (c.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE c.chat_id = ${chatId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    content: row.content as string,
    documentId: row.document_id as string,
    pageNumber: row.page_number as number | null,
    sectionHeading: row.section_heading as string | null,
    similarity: parseFloat(row.similarity as string),
    filename: row.filename as string,
  }));
}

/**
 * Build context block with citation markers for the LLM prompt.
 * Groups chunks by document and adds citation labels.
 */
function buildContext(retrievedChunks: RetrievedChunk[]): {
  contextBlock: string;
  citations: CitationMarker[];
} {
  const citations: CitationMarker[] = [];
  const contextParts: string[] = [];

  // Group chunks by document
  const byDocument = new Map<string, RetrievedChunk[]>();
  for (const chunk of retrievedChunks) {
    const existing = byDocument.get(chunk.documentId) || [];
    existing.push(chunk);
    byDocument.set(chunk.documentId, existing);
  }

  let chunkCounter = 1;
  for (const [_docId, docChunks] of byDocument) {
    const docName = docChunks[0].filename.replace('.pdf', '');
    contextParts.push(`\n--- Source: ${docName} ---\n`);

    for (const chunk of docChunks) {
      const pageLabel = chunk.pageNumber ? `p.${chunk.pageNumber}` : 'unknown page';
      const citationLabel = `[Doc: ${docName}, ${pageLabel}]`;

      citations.push({
        chunkId: chunk.id,
        documentName: docName,
        pageNumber: chunk.pageNumber,
        label: citationLabel,
      });

      const heading = chunk.sectionHeading ? `## ${chunk.sectionHeading}\n` : '';
      contextParts.push(`${heading}[Chunk ${chunkCounter}] ${citationLabel}\n${chunk.content}\n`);
      chunkCounter++;
    }
  }

  return {
    contextBlock: contextParts.join('\n'),
    citations,
  };
}
