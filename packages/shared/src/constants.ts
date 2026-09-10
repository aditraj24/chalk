// ─── Embedding ─────────────────────────────────────────

/** Embedding vector dimension — must match the embedding model (BGE-M3 = 1024) */
export const EMBEDDING_DIMENSION = 1024;

/** Embedding model identifier for @xenova/transformers */
export const EMBEDDING_MODEL = 'BAAI/bge-m3';

// ─── Chunking ──────────────────────────────────────────

/** Target chunk size in tokens */
export const CHUNK_SIZE_TOKENS = 400;

/** Overlap between adjacent chunks as a fraction (15%) */
export const CHUNK_OVERLAP_FRACTION = 0.15;

/** Approximate characters per token (rough estimate for splitting) */
export const CHARS_PER_TOKEN = 4;

/** Target chunk size in characters */
export const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;

/** Chunk overlap in characters */
export const CHUNK_OVERLAP_CHARS = Math.round(CHUNK_SIZE_CHARS * CHUNK_OVERLAP_FRACTION);

// ─── Retrieval ─────────────────────────────────────────

/** Top-K candidates to retrieve per performance mode (before reranking) */
export const RETRIEVAL_CANDIDATES = {
  speed: 15,
  balanced: 30,
  accuracy: 50,
} as const;

/** Top-K chunks passed to LLM per performance mode (after reranking/filtering) */
export const TOP_K = {
  speed: 4,
  balanced: 6,
  accuracy: 10,
} as const;

/** RRF fusion constant (standard value) */
export const RRF_K = 60;

// ─── LLM ───────────────────────────────────────────────

/** Groq model identifier */
export const LLM_MODEL = 'openai/gpt-oss-120b';

/** Max tokens for LLM response generation */
export const LLM_MAX_TOKENS = 2048;

/** Temperature for generation */
export const LLM_TEMPERATURE = 0.3;

// ─── Ingestion Queue ───────────────────────────────────

/** BullMQ queue name for document ingestion */
export const INGESTION_QUEUE_NAME = 'chalk-ingestion';

// ─── Explore Mode ──────────────────────────────────────

/** Allowed domains for Tavily web search in Explore mode */
export const EXPLORE_ALLOWED_DOMAINS = [
  'ncert.nic.in',
  'openstax.org',
  'khanacademy.org',
  'wikipedia.org',
  'en.wikipedia.org',
] as const;

// ─── Upload Limits ─────────────────────────────────────

/** Maximum PDF file size in bytes (50MB) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Allowed MIME types for upload */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/plain', // txt
  'text/markdown', // md
] as const;
