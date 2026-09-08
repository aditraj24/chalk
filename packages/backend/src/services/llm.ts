import { ChatGroq } from '@langchain/groq';
import { LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS } from '@chalk/shared';

/**
 * Get a configured Groq LLM instance (Llama 3.3 70B).
 * Uses the LangChain interface so the model is swappable.
 */
export function getLlm(streaming = true) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }

  return new ChatGroq({
    apiKey,
    model: LLM_MODEL,
    temperature: LLM_TEMPERATURE,
    maxTokens: LLM_MAX_TOKENS,
    streaming,
  });
}

/**
 * Build the Focus mode system prompt.
 * Instructs the LLM to answer ONLY from the provided context chunks
 * and cite sources using [Doc: name, p.X] format.
 */
export function buildFocusSystemPrompt(contextBlock: string): string {
  return `You are Chalk, a study assistant. You help students understand their course material by answering questions based STRICTLY on the provided context from their notes and reference books.

## CRITICAL RULES — FOCUS MODE

1. **ONLY use information from the context below.** Do NOT use any outside knowledge, general knowledge, or information not present in the provided chunks.
2. **Cite every claim** using the format [Doc: <document name>, p.<page number>]. Every factual statement in your answer must have a citation.
3. If the context does not contain enough information to answer the question, say: "Your notes don't seem to cover this topic. You can switch to Explore mode for a broader search."
4. Do NOT guess, speculate, or fill in gaps with external knowledge.
5. Organize your answer clearly with headings, bullet points, or numbered lists when appropriate for studying.
6. When multiple sources discuss the same topic, synthesize them and cite all relevant sources.

## PROVIDED CONTEXT

${contextBlock}

## INSTRUCTIONS

Answer the student's question using ONLY the context above. Cite every claim. If the answer isn't in the context, say so honestly.`;
}
