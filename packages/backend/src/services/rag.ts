import {
  TOP_K,
  AGENT_ALLOWED_DOMAINS,
} from '@chalk/shared';
import type {
  RetrievedChunk,
  CitationMarker,
  SearchConfirmationPayload,
  PerfMode,
  ChatMode,
} from '@chalk/shared';
import { getLlm, buildFocusSystemPrompt, buildAgentSystemPrompt } from './llm.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StateGraph, Annotation, MemorySaver, interrupt, Command } from '@langchain/langgraph';
import { tavily } from '@tavily/core';
import { getCachedQuery, setCachedQuery } from './redis.js';
import { retrieveAndGradeSubgraph } from './retrieveAndGrade.js';

// ─── Pipeline Parameters ────────────────────────────────

export interface RagPipelineParams {
  chatId: string;
  query: string;
  mode: ChatMode | 'explore';
  perfMode: PerfMode;
  autoSearch?: boolean;
  onToken: (token: string) => void;
  onCitations: (citations: CitationMarker[]) => void;
  onInterrupt?: (payload: SearchConfirmationPayload) => void;
  onComplete: (fullContent: string, chunkIds: string[]) => void;
  onError: (error: string) => void;
}

export interface ResumeParams {
  chatId: string;
  confirmed: boolean;
  onToken: (token: string) => void;
  onCitations: (citations: CitationMarker[]) => void;
  onComplete: (fullContent: string, chunkIds: string[]) => void;
  onError: (error: string) => void;
}

// ─── Shared Checkpointer ────────────────────────────────

export const checkpointer = new MemorySaver();

// ─── Focus Mode Graph ───────────────────────────────────

const FocusGraphState = Annotation.Root({
  chatId: Annotation<string>(),
  query: Annotation<string>(),
  perfMode: Annotation<PerfMode>(),
  retrievedChunks: Annotation<RetrievedChunk[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  status: Annotation<'sufficient' | 'insufficient'>({
    reducer: (_x, y) => y,
    default: () => 'insufficient',
  }),
  contextBlock: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => '',
  }),
  citations: Annotation<CitationMarker[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  generation: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => '',
  }),
  onToken: Annotation<((token: string) => void) | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
  onCitations: Annotation<((citations: CitationMarker[]) => void) | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
});

async function runRetrieveAndGradeFocusNode(state: typeof FocusGraphState.State) {
  const result = await retrieveAndGradeSubgraph.invoke({
    chatId: state.chatId,
    query: state.query,
    originalQuery: state.query,
    perfMode: state.perfMode,
  });

  return {
    retrievedChunks: result.retrievedChunks || [],
    status: result.status,
  };
}

async function focusFastExitNode(state: typeof FocusGraphState.State) {
  const { onToken } = state;
  const noContentMsg =
    "Your notes don't seem to cover this topic sufficiently. Try uploading more material or switch to Agent mode.";
  if (onToken) onToken(noContentMsg);
  return { generation: noContentMsg };
}

async function assembleContextFocusNode(state: typeof FocusGraphState.State) {
  const { retrievedChunks, onCitations } = state;

  if (retrievedChunks.length === 0) {
    return { contextBlock: '', citations: [] };
  }

  const { contextBlock, citations } = buildContext(retrievedChunks);

  if (onCitations) {
    onCitations(citations);
  }

  return { contextBlock, citations };
}

async function generateFocusNode(state: typeof FocusGraphState.State) {
  const { query, contextBlock, onToken } = state;

  const llm = getLlm(true);
  const systemPrompt = buildFocusSystemPrompt(contextBlock);

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

function routeFocusStatus(state: typeof FocusGraphState.State): 'assembleContext' | 'fastExit' {
  return state.status === 'sufficient' ? 'assembleContext' : 'fastExit';
}

const focusWorkflow = new StateGraph(FocusGraphState)
  .addNode('retrieveAndGrade', runRetrieveAndGradeFocusNode)
  .addNode('assembleContext', assembleContextFocusNode)
  .addNode('fastExit', focusFastExitNode)
  .addNode('generate', generateFocusNode)

  .addEdge('__start__', 'retrieveAndGrade')
  .addConditionalEdges('retrieveAndGrade', routeFocusStatus, {
    assembleContext: 'assembleContext',
    fastExit: 'fastExit',
  })
  .addEdge('assembleContext', 'generate')
  .addEdge('generate', '__end__')
  .addEdge('fastExit', '__end__');

export const compiledFocusGraph = focusWorkflow.compile();

// ─── Agent Mode Graph ───────────────────────────────────

const AgentGraphState = Annotation.Root({
  chatId: Annotation<string>(),
  query: Annotation<string>(),
  originalQuery: Annotation<string>(),
  perfMode: Annotation<PerfMode>(),
  autoSearch: Annotation<boolean>({
    reducer: (_x, y) => y,
    default: () => true,
  }),
  retrievedChunks: Annotation<RetrievedChunk[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  status: Annotation<'sufficient' | 'insufficient'>({
    reducer: (_x, y) => y,
    default: () => 'insufficient',
  }),
  rewrittenQuery: Annotation<string | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  gradeReason: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => '',
  }),
  searchConfirmed: Annotation<boolean | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  contextBlock: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => '',
  }),
  citations: Annotation<CitationMarker[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  generation: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => '',
  }),
  onToken: Annotation<((token: string) => void) | undefined>({
    reducer: (_x, y) => y ?? _x,
    default: () => undefined,
  }),
  onCitations: Annotation<((citations: CitationMarker[]) => void) | undefined>({
    reducer: (_x, y) => y ?? _x,
    default: () => undefined,
  }),
});

async function runRetrieveAndGradeAgentNode(state: typeof AgentGraphState.State) {
  const result = await retrieveAndGradeSubgraph.invoke({
    chatId: state.chatId,
    query: state.query,
    originalQuery: state.query,
    perfMode: state.perfMode,
  });

  return {
    retrievedChunks: result.retrievedChunks || [],
    status: result.status,
    rewrittenQuery: result.rewrittenQuery || null,
    gradeReason: result.gradeVerdict?.reason || '',
  };
}

function routeAgentStatus(
  state: typeof AgentGraphState.State,
): 'assembleContext' | 'webSearch' | 'askConfirmation' {
  if (state.status === 'sufficient') {
    return 'assembleContext';
  }

  if (state.autoSearch) {
    return 'webSearch';
  }

  return 'askConfirmation';
}

async function askConfirmationNode(state: typeof AgentGraphState.State) {
  const payload: SearchConfirmationPayload = {
    type: 'search_confirmation',
    reason: state.gradeReason || "Your notes don't fully cover this topic.",
    originalQuery: state.originalQuery || state.query,
    rewrittenQuery: state.rewrittenQuery || null,
  };

  // Interrupt execution and wait for user confirmation
  const confirmed = interrupt(payload);
  return { searchConfirmed: Boolean(confirmed) };
}

function routeConfirmation(state: typeof AgentGraphState.State): 'webSearch' | 'assembleContextNotesOnly' {
  return state.searchConfirmed ? 'webSearch' : 'assembleContextNotesOnly';
}

async function webSearchNode(state: typeof AgentGraphState.State) {
  const { originalQuery, query, rewrittenQuery, retrievedChunks } = state;
  const apiKey = process.env.TAVILY_API_KEY;
  const searchQuery = rewrittenQuery || originalQuery || query;

  if (!apiKey) {
    console.warn('[WebSearch] TAVILY_API_KEY is missing. Skipping web search.');
    return { retrievedChunks };
  }

  try {
    const tvly = tavily({ apiKey });
    const response = await tvly.search(searchQuery, {
      searchDepth: 'basic',
      includeDomains: [...AGENT_ALLOWED_DOMAINS],
      maxResults: 3,
    });

    const webChunks: RetrievedChunk[] = response.results.map((r, i) => ({
      id: `web-${i}-${Date.now()}`,
      documentId: `web-${i}`,
      filename: r.url,
      content: r.content,
      pageNumber: null,
      sectionHeading: r.title,
      similarity: 1.0,
    }));

    // Combine web results with existing note chunks
    return { retrievedChunks: [...webChunks, ...retrievedChunks] };
  } catch (error) {
    console.error('[WebSearch] Failed:', error);
    return { retrievedChunks };
  }
}

async function assembleContextAgentNode(state: typeof AgentGraphState.State) {
  const { retrievedChunks, onCitations } = state;

  if (retrievedChunks.length === 0) {
    return { contextBlock: '', citations: [] };
  }

  const { contextBlock, citations } = buildContext(retrievedChunks);

  if (onCitations) {
    onCitations(citations);
  }

  return { contextBlock, citations };
}

async function assembleContextNotesOnlyNode(state: typeof AgentGraphState.State) {
  const { retrievedChunks, onCitations } = state;

  const { contextBlock, citations } = buildContext(retrievedChunks);

  if (onCitations) {
    onCitations(citations);
  }

  return { contextBlock, citations };
}

async function generateAgentNode(state: typeof AgentGraphState.State) {
  const { originalQuery, query, contextBlock, onToken } = state;

  const llm = getLlm(true);
  const systemPrompt = buildAgentSystemPrompt(contextBlock);

  const stream = await llm.stream([
    new SystemMessage(systemPrompt),
    new HumanMessage(originalQuery || query),
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

async function generateAgentNotesOnlyNode(state: typeof AgentGraphState.State) {
  const { originalQuery, query, contextBlock, onToken } = state;

  const llm = getLlm(true);
  const notesOnlyBlock = contextBlock
    ? `${contextBlock}\n\n[INSTRUCTION]: The student chose not to search the web. Answer using ONLY what was found in their notes above, acknowledging gaps with: "Based only on your notes, here's what I found..."`
    : `[INSTRUCTION]: The student chose not to search the web and no relevant material was found in their uploaded notes. Clearly state: "Based only on your notes, I couldn't find information on this topic."`;

  const systemPrompt = buildAgentSystemPrompt(notesOnlyBlock);

  const stream = await llm.stream([
    new SystemMessage(systemPrompt),
    new HumanMessage(originalQuery || query),
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

const agentWorkflow = new StateGraph(AgentGraphState)
  .addNode('retrieveAndGrade', runRetrieveAndGradeAgentNode)
  .addNode('askConfirmation', askConfirmationNode)
  .addNode('webSearch', webSearchNode)
  .addNode('assembleContext', assembleContextAgentNode)
  .addNode('assembleContextNotesOnly', assembleContextNotesOnlyNode)
  .addNode('generate', generateAgentNode)
  .addNode('generateNotesOnly', generateAgentNotesOnlyNode)

  .addEdge('__start__', 'retrieveAndGrade')
  .addConditionalEdges('retrieveAndGrade', routeAgentStatus, {
    assembleContext: 'assembleContext',
    webSearch: 'webSearch',
    askConfirmation: 'askConfirmation',
  })
  .addConditionalEdges('askConfirmation', routeConfirmation, {
    webSearch: 'webSearch',
    assembleContextNotesOnly: 'assembleContextNotesOnly',
  })
  .addEdge('webSearch', 'assembleContext')
  .addEdge('assembleContext', 'generate')
  .addEdge('assembleContextNotesOnly', 'generateNotesOnly')
  .addEdge('generate', '__end__')
  .addEdge('generateNotesOnly', '__end__');

export const compiledAgentGraph = agentWorkflow.compile({ checkpointer });

// ─── RAG Pipeline Entry Points ─────────────────────────

export async function ragPipeline(params: RagPipelineParams): Promise<void> {
  const {
    chatId,
    query,
    mode,
    perfMode,
    autoSearch = true,
    onToken,
    onCitations,
    onInterrupt,
    onComplete,
    onError,
  } = params;

  try {
    const normalizedMode: ChatMode = mode === 'explore' ? 'agent' : (mode as ChatMode);

    // 0. Check cache
    const cached = await getCachedQuery(chatId, query, normalizedMode, perfMode);
    if (cached) {
      console.log('[RAG] Cache hit for query');
      if (onToken) onToken(cached.generation);
      onComplete(cached.generation, cached.chunkIds);
      return;
    }

    if (normalizedMode === 'focus') {
      const initialState = {
        chatId,
        query,
        perfMode,
        onToken,
        onCitations,
        retrievedChunks: [],
        contextBlock: '',
        citations: [],
        generation: '',
      };

      const finalState = await compiledFocusGraph.invoke(initialState);
      const chunkIds = finalState.retrievedChunks.map((c: RetrievedChunk) => c.id);

      await setCachedQuery(chatId, query, 'focus', perfMode, finalState.generation, chunkIds);
      onComplete(finalState.generation, chunkIds);
    } else {
      // Agent mode
      const initialState = {
        chatId,
        query,
        originalQuery: query,
        perfMode,
        autoSearch,
        onToken,
        onCitations,
        retrievedChunks: [],
        contextBlock: '',
        citations: [],
        generation: '',
      };

      const config = { configurable: { thread_id: chatId } };
      const rawResult = await compiledAgentGraph.invoke(initialState, config);
      const interruptList = (rawResult as any)?.__interrupt__;

      // Check if graph was interrupted for user confirmation
      if (Array.isArray(interruptList) && interruptList.length > 0) {
        const interruptPayload = interruptList[0]?.value as SearchConfirmationPayload;
        console.log(`[RAG] Agent mode interrupted for confirmation in chat ${chatId}`);
        if (onInterrupt && interruptPayload) {
          onInterrupt(interruptPayload);
        }
        return;
      }

      const finalState = rawResult as typeof AgentGraphState.State;
      const chunkIds = (finalState.retrievedChunks || []).map((c: RetrievedChunk) => c.id);
      await setCachedQuery(chatId, query, 'agent', perfMode, finalState.generation || '', chunkIds);
      onComplete(finalState.generation || '', chunkIds);
    }
  } catch (error) {
    console.error('[RAG] Pipeline error:', error);
    onError(error instanceof Error ? error.message : 'RAG pipeline failed');
  }
}

/**
 * Resume an interrupted Agent mode search after user confirms or declines web search.
 */
export async function resumeRagPipeline(params: ResumeParams): Promise<void> {
  const { chatId, confirmed, onToken, onCitations, onComplete, onError } = params;

  try {
    const config = { configurable: { thread_id: chatId } };
    const threadState = await compiledAgentGraph.getState(config);

    if (!threadState || !threadState.next || threadState.next.length === 0) {
      throw new Error('No active search confirmation pending for this chat session.');
    }

    console.log(`[RAG] Resuming search for chat ${chatId}, confirmed: ${confirmed}`);

    const finalState = await compiledAgentGraph.invoke(
      new Command({
        resume: confirmed,
        update: {
          onToken,
          onCitations,
        },
      }),
      config,
    );

    const chunkIds = finalState.retrievedChunks?.map((c: RetrievedChunk) => c.id) || [];
    onComplete(finalState.generation || '', chunkIds);
  } catch (error) {
    console.error('[RAG] Resume error:', error);
    onError(error instanceof Error ? error.message : 'Failed to resume search');
  }
}

// ─── Context Assembly Helper ────────────────────────────

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
    const docName = isWeb ? docChunks[0].filename : docChunks[0].filename.replace(/\.pdf$/i, '');
    contextParts.push(`\n--- Source: ${docName} ---\n`);

    for (const chunk of docChunks) {
      let citationLabel: string;
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
