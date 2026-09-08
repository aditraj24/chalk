import type { RetrievedChunk } from '@chalk/shared';

export interface VectorStore {
  /**
   * Perform a dense similarity search using an embedding vector.
   */
  denseRetrieve(chatId: string, queryEmbedding: number[], topK: number): Promise<RetrievedChunk[]>;

  /**
   * Perform a sparse search using BM25 or full-text keywords.
   */
  sparseRetrieve(chatId: string, query: string, topK: number): Promise<RetrievedChunk[]>;
}
