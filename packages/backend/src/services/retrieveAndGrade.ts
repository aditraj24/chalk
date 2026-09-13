import {
  TOP_K,
  MAX_GRADE_RETRIES,
} from '@chalk/shared';
import type {
  RetrievedChunk,
  GradeVerdict,
  PerfMode,
} from '@chalk/shared';
import { getEmbedding, rerankChunks } from './embeddings.js';
import { defaultVectorStore } from './vectorStore/pgVector.js';
import { getGraderLlm } from './llm.js';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// ─── Subgraph State Definition ───────────────────────────

export const RetrieveAndGradeState = Annotation.Root({
  chatId: Annotation<string>(),
  query: Annotation<string>(),             // Current query (may be rewritten)
  originalQuery: Annotation<string>(),     // Preserved original student question
  perfMode: Annotation<PerfMode>(),
  retrievedChunks: Annotation<RetrievedChunk[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  retryCount: Annotation<number>({
    reducer: (_x, y) => y,
    default: () => 0,
  }),
  gradeVerdict: Annotation<GradeVerdict | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  rewrittenQuery: Annotation<string | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  status: Annotation<'sufficient' | 'insufficient'>({
    reducer: (_x, y) => y,
    default: () => 'insufficient',
  }),
});

// ─── Subgraph Nodes ──────────────────────────────────────

async function retrieveNode(state: typeof RetrieveAndGradeState.State) {
  const { chatId, query, perfMode } = state;
  const topK = TOP_K[perfMode] || TOP_K.balanced;
  const candidatePoolSize = perfMode === 'speed' ? topK * 2 : topK * 4;

  // 1. Dense (pgvector)
  const queryEmbedding = await getEmbedding(query);
  const denseChunks = await defaultVectorStore.denseRetrieve(chatId, queryEmbedding, candidatePoolSize);

  // 2. Sparse (BM25 pg_search/tsvector)
  const sparseChunks = await defaultVectorStore.sparseRetrieve(chatId, query, candidatePoolSize);

  // 3. Fusion (RRF)
  const fusedChunks = fuseRRF(denseChunks, sparseChunks);

  return { retrievedChunks: fusedChunks };
}

async function rerankNode(state: typeof RetrieveAndGradeState.State) {
  const { query, retrievedChunks, perfMode } = state;
  const topK = TOP_K[perfMode] || TOP_K.balanced;

  if (!retrievedChunks || retrievedChunks.length === 0) {
    return { retrievedChunks: [] };
  }

  // Skip cross-encoder in speed mode to minimize latency
  if (perfMode === 'speed') {
    return { retrievedChunks: retrievedChunks.slice(0, topK) };
  }

  const reranked = await rerankChunks(query, retrievedChunks, topK);
  return { retrievedChunks: reranked as RetrievedChunk[] };
}

async function gradeNode(state: typeof RetrieveAndGradeState.State) {
  const { originalQuery, query, retrievedChunks } = state;

  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      gradeVerdict: {
        sufficient: false,
        reason: 'No relevant documents or chunks found in uploaded material.',
      },
    };
  }

  // Format top chunks for grading evaluation
  const previewChunks = retrievedChunks.slice(0, 5).map((c, i) => {
    const heading = c.sectionHeading ? ` [Section: ${c.sectionHeading}]` : '';
    const page = c.pageNumber ? ` (p.${c.pageNumber})` : '';
    return `[Excerpt ${i + 1}${page}${heading}]:\n${c.content.slice(0, 800)}`;
  }).join('\n\n');

  const targetQuestion = originalQuery || query;

  const gradePrompt = `You are an evaluation assistant for a study tool.
Your job is to determine whether the provided excerpts from the student's study material contain sufficient information to answer the student's question.

STUDENT QUESTION:
"${targetQuestion}"

RETRIEVED EXCERPTS:
${previewChunks}

TASK:
Determine if the excerpts contain enough relevant factual information to answer the student's question reasonably.
- If the question can be answered from the excerpts, set "sufficient" to true.
- If the excerpts are irrelevant, tangential, or missing crucial information needed to answer, set "sufficient" to false.

Respond ONLY with a JSON object in this exact format:
{
  "sufficient": true,
  "reason": "Brief explanation of why it is sufficient or what specific topic is missing"
}`;

  try {
    const graderLlm = getGraderLlm();
    const response = await graderLlm.invoke([
      new SystemMessage('You evaluate retrieval quality. Output valid JSON only, without markdown code fences or extra text.'),
      new HumanMessage(gradePrompt),
    ]);

    const content = typeof response.content === 'string'
      ? response.content.trim()
      : JSON.stringify(response.content);

    const cleaned = content.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as GradeVerdict;

    return {
      gradeVerdict: {
        sufficient: Boolean(parsed.sufficient),
        reason: parsed.reason || (parsed.sufficient ? 'Context is sufficient' : 'Context is insufficient'),
      },
    };
  } catch (err) {
    console.warn('[RetrieveAndGrade] Grading parsing error, fallback to chunk count check:', err);
    const fallbackSufficient = retrievedChunks.length > 0;
    return {
      gradeVerdict: {
        sufficient: fallbackSufficient,
        reason: fallbackSufficient ? 'Fallback: chunks retrieved' : 'Fallback: no chunks retrieved',
      },
    };
  }
}

async function rewriteQueryNode(state: typeof RetrieveAndGradeState.State) {
  const { originalQuery, gradeVerdict, retryCount } = state;

  const rewritePrompt = `You are a search query optimizer for an academic retrieval system.
A previous search for the student's question did not return sufficient information.

ORIGINAL QUESTION:
"${originalQuery}"

DEFICIENCY REASON:
"${gradeVerdict?.reason || 'Missing relevant details'}"

TASK:
Rewrite the query to better retrieve the missing academic concepts, synonyms, or terminology from course notes.
Respond ONLY with the rewritten query text. Do not include quotes, preamble, or explanation.`;

  try {
    const graderLlm = getGraderLlm();
    const response = await graderLlm.invoke([
      new SystemMessage('You rewrite search queries. Output ONLY the new query string, nothing else.'),
      new HumanMessage(rewritePrompt),
    ]);

    const rewritten = (typeof response.content === 'string' ? response.content : '').trim().replace(/^["']|["']$/g, '');
    const newQuery = rewritten && rewritten.length > 3 ? rewritten : originalQuery;

    console.log(`[RetrieveAndGrade] Rewrote query (retry ${retryCount + 1}): "${originalQuery}" -> "${newQuery}"`);

    return {
      query: newQuery,
      rewrittenQuery: newQuery,
      retryCount: retryCount + 1,
    };
  } catch (err) {
    console.error('[RetrieveAndGrade] Query rewriting error, continuing with original query:', err);
    return {
      retryCount: retryCount + 1,
    };
  }
}

function markSufficientNode() {
  return { status: 'sufficient' as const };
}

function markInsufficientNode() {
  return { status: 'insufficient' as const };
}

// ─── Conditional Routing ─────────────────────────────────

function checkGradeVerdict(state: typeof RetrieveAndGradeState.State): 'sufficient' | 'rewrite' | 'insufficient' {
  const { gradeVerdict, retryCount } = state;

  if (gradeVerdict?.sufficient) {
    return 'sufficient';
  }

  if (retryCount < MAX_GRADE_RETRIES) {
    return 'rewrite';
  }

  return 'insufficient';
}

// ─── Subgraph Construction ───────────────────────────────

const subgraphWorkflow = new StateGraph(RetrieveAndGradeState)
  .addNode('retrieve', retrieveNode)
  .addNode('rerank', rerankNode)
  .addNode('grade', gradeNode)
  .addNode('rewrite', rewriteQueryNode)
  .addNode('markSufficient', markSufficientNode)
  .addNode('markInsufficient', markInsufficientNode)

  .addEdge('__start__', 'retrieve')
  .addEdge('retrieve', 'rerank')
  .addEdge('rerank', 'grade')

  .addConditionalEdges('grade', checkGradeVerdict, {
    sufficient: 'markSufficient',
    rewrite: 'rewrite',
    insufficient: 'markInsufficient',
  })

  .addEdge('rewrite', 'retrieve')
  .addEdge('markSufficient', '__end__')
  .addEdge('markInsufficient', '__end__');

export const retrieveAndGradeSubgraph = subgraphWorkflow.compile();

// ─── Reciprocal Rank Fusion (RRF) Helper ─────────────────

export function fuseRRF(listA: RetrievedChunk[], listB: RetrievedChunk[], k: number = 60): RetrievedChunk[] {
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

  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((item) => item.chunk);
}
