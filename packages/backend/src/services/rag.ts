import { getDb, chunks, documents } from '@chalk/shared';
import { TOP_K } from '@chalk/shared';
import type { RetrievedChunk, CitationMarker } from '@chalk/shared';
import { eq, sql } from 'drizzle-orm';
import { getLlm, buildFocusSystemPrompt, buildExploreSystemPrompt } from './llm.js';
import { getEmbedding, rerankChunks } from './embeddings.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { tavily } from '@tavily/core';

// ─── RAG Pipeline Types ────────────────────────────────

interface RagPipelineParams {
  chatId: string;
  query: string;
  mode: 'focus' | 'explore';
  perfMode: 'speed' | 'balanced' | 'accuracy';
  onToken: (token: string) => void;
  onCitations: (citations: CitationMarker[]) => void;
  onComplete: (fullContent: string, chunkIds: string[]) => void;
  onError: (error: string) => void;
}

// ─── LangGraph State Definition ────────────────────────

const GraphState = Annotation.Root({
  chatId: Annotation<string>(),
  query: Annotation<string>(),
  mode: Annotation<'focus' | 'explore'>(),
  perfMode: Annotation<'speed' | 'balanced' | 'accuracy'>(),
  retrievedChunks: Annotation<RetrievedChunk[]>({
    reducer: (x, y) => y, // Overwrite
    default: () => [],
  }),
  contextBlock: Annotation<string>({
    reducer: (x, y) => y,
    default: () => "",
  }),
  citations: Annotation<CitationMarker[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),
  generation: Annotation<string>({
    reducer: (x, y) => y,
    default: () => "",
  }),
  // Callbacks passed down via state for simplicity
  onToken: Annotation<((token: string) => void) | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
  onCitations: Annotation<((citations: CitationMarker[]) => void) | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
});

// ─── LangGraph Nodes ───────────────────────────────────

async function retrieveNode(state: typeof GraphState.State) {
  const { chatId, query, perfMode } = state;
  
  // Dynamic topK based on perfMode
  const topK = TOP_K[perfMode] || TOP_K.balanced;
  const candidatePoolSize = perfMode === 'speed' ? topK * 2 : topK * 4;

  // 1. Dense (pgvector)
  const queryEmbedding = await getEmbedding(query);
  const denseChunks = await denseRetrieve(chatId, queryEmbedding, candidatePoolSize);

  // 2. Sparse (BM25 pg_search/tsvector)
  const sparseChunks = await sparseRetrieve(chatId, query, candidatePoolSize);

  // 3. Fusion (RRF)
  const fusedChunks = fuseRRF(denseChunks, sparseChunks);

  return { retrievedChunks: fusedChunks };
}

async function rerankNode(state: typeof GraphState.State) {
  const { query, retrievedChunks, perfMode } = state;
  const topK = TOP_K[perfMode] || TOP_K.balanced;

  if (retrievedChunks.length === 0) return { retrievedChunks: [] };

  // Skip cross-encoder in speed mode to minimize latency
  if (perfMode === 'speed') {
    return { retrievedChunks: retrievedChunks.slice(0, topK) };
  }

  const reranked = await rerankChunks(query, retrievedChunks, topK);
  return { retrievedChunks: reranked as RetrievedChunk[] };
}

async function confidenceNode(state: typeof GraphState.State) {
  // Pass-through node, the real logic is in the edge
  return {};
}

async function webSearchNode(state: typeof GraphState.State) {
  const { query, retrievedChunks } = state;
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    console.warn('[WebSearch] TAVILY_API_KEY is missing. Skipping web search.');
    return { retrievedChunks };
  }

  try {
    const tvly = tavily({ apiKey });
    const response = await tvly.search(query, {
      searchDepth: "basic",
      includeDomains: ["wikipedia.org", "khanacademy.org", "openstax.org"], // educational domains
      maxResults: 3,
    });

    const webChunks: RetrievedChunk[] = response.results.map((r, i) => ({
      id: `web-${i}-${Date.now()}`,
      documentId: `web-${i}`, 
      filename: r.url,
      content: r.content,
      pageNumber: null,
      sectionHeading: r.title,
      similarity: 1.0, // Top priority
    }));

    // Prepend web results to context
    return { retrievedChunks: [...webChunks, ...retrievedChunks] };
  } catch (error) {
    console.error('[WebSearch] Failed:', error);
    return { retrievedChunks };
  }
}

async function fastExitNode(state: typeof GraphState.State) {
  const { onToken } = state;
  const noContentMsg = "Your notes don't seem to cover this topic. Try uploading more documents or switch to Explore mode for a broader search.";
  if (onToken) onToken(noContentMsg);
  return { generation: noContentMsg };
}

async function contextNode(state: typeof GraphState.State) {
  const { retrievedChunks, onCitations } = state;
  
  if (retrievedChunks.length === 0) {
    return { contextBlock: "", citations: [] };
  }

  const { contextBlock, citations } = buildContext(retrievedChunks);
  
  if (onCitations) {
    onCitations(citations);
  }

  return { contextBlock, citations };
}

async function generateNode(state: typeof GraphState.State) {
  const { query, contextBlock, onToken, mode } = state;

  const llm = getLlm(true);
  const systemPrompt = mode === 'explore' 
    ? buildExploreSystemPrompt(contextBlock)
    : buildFocusSystemPrompt(contextBlock);

  const stream = await llm.stream([
    new SystemMessage(systemPrompt),
    new HumanMessage(query),
  ]);

  let fullContent = '';
  for await (const chunk of stream) {
    const token = chunk.content as string;
    if (token) {
      fullContent += token;
      if (onToken) onToken(token);
    }
  }

  return { generation: fullContent };
}

// ─── Conditional Edges ─────────────────────────────────

function checkConfidence(state: typeof GraphState.State) {
  const { retrievedChunks, mode, perfMode } = state;
  
  if (retrievedChunks.length === 0) {
    return mode === 'explore' ? 'webSearch' : 'fastExit';
  }

  // In Speed mode, we skipped reranking so we don't have rerank scores. Just proceed.
  if (perfMode === 'speed') {
    return 'context';
  }

  // If we have rerank scores, check the top chunk's score
  const topChunk = retrievedChunks[0] as any;
  const topScore = topChunk.rerankScore ?? 1.0;

  // If confidence is very low (< 0.05)
  if (topScore < 0.05) {
    return mode === 'explore' ? 'webSearch' : 'fastExit';
  }

  return 'context';
}

// ─── Compile LangGraph ─────────────────────────────────

const workflow = new StateGraph(GraphState)
  .addNode("retrieve", retrieveNode)
  .addNode("rerank", rerankNode)
  .addNode("confidence", confidenceNode)
  .addNode("webSearch", webSearchNode)
  .addNode("fastExit", fastExitNode)
  .addNode("context", contextNode)
  .addNode("generate", generateNode)
  
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "rerank")
  .addEdge("rerank", "confidence")
  
  // Conditional routing based on confidence and mode
  .addConditionalEdges("confidence", checkConfidence, {
    "webSearch": "webSearch",
    "fastExit": "fastExit",
    "context": "context"
  })

  .addEdge("webSearch", "context")
  .addEdge("context", "generate")
  .addEdge("generate", "__end__")
  .addEdge("fastExit", "__end__");

const compiledGraph = workflow.compile();

// ─── RAG Pipeline Entry ────────────────────────────────

export async function ragPipeline(params: RagPipelineParams): Promise<void> {
  const { chatId, query, mode, perfMode, onToken, onCitations, onComplete, onError } = params;

  try {
    const initialState = {
      chatId,
      query,
      mode,
      perfMode,
      onToken,
      onCitations,
      retrievedChunks: [],
      contextBlock: "",
      citations: [],
      generation: "",
    };

    // Execute the graph
    const finalState = await compiledGraph.invoke(initialState);
    
    const chunkIds = finalState.retrievedChunks.map((c: RetrievedChunk) => c.id);
    onComplete(finalState.generation, chunkIds);
  } catch (error) {
    console.error('[RAG] Pipeline error:', error);
    onError(error instanceof Error ? error.message : 'RAG pipeline failed');
  }
}

// ─── Retrieval Helpers ─────────────────────────────────

async function denseRetrieve(
  chatId: string,
  queryEmbedding: number[],
  topK: number,
): Promise<RetrievedChunk[]> {
  const db = getDb();
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

  return mapRowsToChunks(result.rows);
}

async function sparseRetrieve(
  chatId: string,
  query: string,
  topK: number
): Promise<RetrievedChunk[]> {
  const db = getDb();

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

  return mapRowsToChunks(result.rows);
}

function mapRowsToChunks(rows: Record<string, unknown>[]): RetrievedChunk[] {
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

/**
 * Reciprocal Rank Fusion (RRF)
 */
function fuseRRF(listA: RetrievedChunk[], listB: RetrievedChunk[], k: number = 60): RetrievedChunk[] {
  const scores = new Map<string, { chunk: RetrievedChunk; rrfScore: number }>();

  const addToList = (list: RetrievedChunk[]) => {
    list.forEach((chunk, index) => {
      const rank = index + 1;
      const score = 1 / (k + rank);
      if (scores.has(chunk.id)) {
        scores.get(chunk.id)!.rrfScore += score;
      } else {
        scores.set(chunk.id, { chunk, rrfScore: score });
      }
    });
  };

  addToList(listA);
  addToList(listB);

  // Sort descending by RRF score
  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((item) => item.chunk);
}

// ─── Context Assembly ──────────────────────────────────

function buildContext(retrievedChunks: RetrievedChunk[]): {
  contextBlock: string;
  citations: CitationMarker[];
} {
  const citations: CitationMarker[] = [];
  const contextParts: string[] = [];

  const byDocument = new Map<string, RetrievedChunk[]>();
  for (const chunk of retrievedChunks) {
    const existing = byDocument.get(chunk.documentId) || [];
    existing.push(chunk);
    byDocument.set(chunk.documentId, existing);
  }

  let chunkCounter = 1;
  for (const [_docId, docChunks] of byDocument) {
    const isWeb = _docId.startsWith('web-');
    const docName = isWeb ? docChunks[0].filename : docChunks[0].filename.replace('.pdf', '');
    contextParts.push(`\n--- Source: ${docName} ---\n`);

    for (const chunk of docChunks) {
      let citationLabel;
      if (isWeb) {
        citationLabel = `[Web: ${docName}]`;
      } else {
        const pageLabel = chunk.pageNumber ? `p.${chunk.pageNumber}` : 'unknown page';
        citationLabel = `[Doc: ${docName}, ${pageLabel}]`;
      }

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
