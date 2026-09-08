import { getReadDb } from '@chalk/shared';
import type { RetrievedChunk } from '@chalk/shared';
import { sql } from 'drizzle-orm';
import type { VectorStore } from './index.js';

export class PgVectorStore implements VectorStore {
  async denseRetrieve(
    chatId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    const db = getReadDb();
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

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

    return this.mapRowsToChunks(result.rows);
  }

  async sparseRetrieve(
    chatId: string,
    query: string,
    topK: number
  ): Promise<RetrievedChunk[]> {
    const db = getReadDb();

    // Postgres BM25 using ts_rank
    const result = await db.execute(sql`
      SELECT
        c.id,
        c.content,
        c.document_id,
        c.page_number,
        c.section_heading,
        d.filename,
        ts_rank(c.tsv, plainto_tsquery('english', ${query})) AS similarity
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.chat_id = ${chatId}
        AND c.tsv @@ plainto_tsquery('english', ${query})
      ORDER BY similarity DESC
      LIMIT ${topK}
    `);

    return this.mapRowsToChunks(result.rows);
  }

  private mapRowsToChunks(rows: Record<string, unknown>[]): RetrievedChunk[] {
    return rows.map((row) => ({
      id: row.id as string,
      content: row.content as string,
      documentId: row.document_id as string,
      pageNumber: row.page_number as number | null,
      sectionHeading: row.section_heading as string | null,
      similarity: parseFloat(row.similarity as string),
      filename: row.filename as string,
    }));
  }
}

export const defaultVectorStore = new PgVectorStore();
