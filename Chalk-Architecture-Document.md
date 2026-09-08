# Chalk — Production Architecture & Design Document

*A RAG-powered study assistant grounded strictly in your professor's notes and reference material.*

## 1. Problem Statement

Students preparing for exams face a grounding problem: their professor's notes and prescribed reference book are often the *only* source of truth for that course (especially where multiple textbooks disagree, e.g. conflicting explanations of the same Physics concept). A generic LLM, or an LLM given raw unstructured PDFs the night before an exam, either:

- Pulls in outside knowledge that isn't part of the syllabus, or contradicts what the professor teaches, or
- Hallucinates when the provided context is too large, poorly chunked, or poorly retrieved, or
- Loses relevant content buried inside long PDFs because retrieval is naive (e.g. simple top-k cosine search with no re-ranking).

**Goal:** Build a RAG-native study assistant where every chat session is scoped to a specific set of ingested documents (notes + reference book), and answers are strictly grounded in that material unless the student explicitly opts into a broader "Explore" mode.

---

## 2. Core Product Requirements (from your spec)

- Auth: user accounts (signup/login).
- Chats are the unit of isolation: each chat has its own ingested document set. Starting a new chat requires ingesting documents first (enforced onboarding step, not optional).
- Within an existing chat, the user can ingest *additional* PDFs later (incremental ingestion into the same chat's namespace).
- Chat management: rename, delete, list/revisit previous chats.
- Two per-chat modes:
  - **Focus mode** — answers must come only from retrieved chunks; no external knowledge, no web search.
  - **Explore mode** — LLM may supplement with general knowledge / web search, but should still prioritize and clearly distinguish grounded content from external content.
- A global (or per-chat) **Speed vs Accuracy** toggle affecting retrieval depth, reranking, and model choice.
- Advanced RAG pipeline: hybrid (dense + sparse) retrieval, re-ranking, context window management, smart/semantic chunking, grounded context assembly.
- Storage split: raw PDFs in object storage (S3), text/embeddings/metadata in a relational store (Postgres).
- Orchestration via LangChain + LangGraph (explicit state machine, not a linear chain).

---

## 3. Recommended Tech Stack

You asked for a recommendation on the three open decisions — here's what I'd pick and why, but all three are swappable later since they sit behind interfaces.

### 3.1 Vector storage: **Postgres + pgvector (with pg_bm25/tsvector for sparse), not a separate vector DB**
- At your scale (single-institution / early-stage product, not billions of vectors), pgvector comfortably handles hybrid search with the `pgvector` HNSW/IVFFlat index for dense vectors and Postgres full-text search (`tsvector` + `ts_rank`, or the `pg_search`/`ParadeDB` extension for real BM25) for sparse/lexical search.
- One database instead of two removes an entire class of consistency and ops problems (you already store metadata in Postgres, so co-locating vectors avoids dual-write bugs between systems).
- Migration path: if you outgrow it (many millions of chunks, need for approximate search at very low latency), the interface (LangChain `VectorStore`) makes swapping to Qdrant/Milvus later a config change, not a rewrite — so start simple.
- **Recommendation: pgvector now, design the retrieval layer behind an interface so Qdrant is a drop-in later if you scale past a single institution.**

### 3.2 LLM + embeddings: **Groq (free tier, Llama 3.3 70B) for generation, self-hosted BGE-M3 for embeddings — a fully free stack**
- **Generation — Groq API, free tier, serving Llama 3.3 70B**: Groq's free tier is one of the most generous of any first-party provider (thousands of requests/day) and Llama 3.3 70B is a strong open-weight model that follows strict system-prompt instructions well — important for Focus mode's "only answer from retrieved chunks" constraint. It's also OpenAI-SDK-compatible, so it drops into the same LangChain chat-model interface with no custom integration work.
- **Embeddings — BGE-M3, self-hosted (MIT license, genuinely free at any volume)**: BGE-M3 is a leading open-source embedding model (strong on the MTEB retrieval benchmark, native hybrid dense+sparse output, 8K context) that you run yourself via a small inference server (`sentence-transformers` or Hugging Face's Text Embeddings Inference) — no per-token cost, no rate limits, and no dependency on a third party staying free. This matters more for embeddings than generation: ingestion is bursty (a student uploads 10 PDFs at once) and a rate-limited free-tier embedding API would stall exactly when you need throughput.
- **Reranking — bge-reranker-v2-m3, self-hosted (also free)**: same open-source family as the embedding model, keeps the whole retrieval stack free and consistent.
- Keep both generation and embeddings behind the same swappable interfaces (LangChain chat model / `VectorStore` embedding interface) mentioned elsewhere in this doc — if you ever want to upgrade quality later (e.g. add Claude as a paid "Accuracy mode" option, self-funded once you have paying users), it's a config change, not a rewrite.
- **Trade-off to know going in**: self-hosted embeddings/reranking need a small GPU (or a slower CPU box) to run on — this shifts cost from "per-API-call" to "a small always-on server," which is cheaper at your projected scale (Section 15) but is a real infra piece to provision (e.g. a modest GPU instance, or even CPU-only for BGE-M3 at moderate latency since ingestion isn't real-time-critical). Groq's free tier has request-rate limits too (still generous, but not unlimited) — worth monitoring once you have real users, with a paid Groq tier or a second free provider (Google AI Studio's Gemini Flash free tier is a solid backup) as a fallback if you hit them.
- **Recommendation: Groq/Llama 3.3 70B (generation) + self-hosted BGE-M3 (embeddings) + self-hosted bge-reranker-v2-m3 (reranking) — $0 in per-token API cost, only the GPU/CPU hosting cost for the self-hosted pieces.**

### 3.3 Deployment: **Docker Compose for MVP → Kubernetes (or AWS ECS) once you have real usage**
- Don't start with Kubernetes — it's operational overhead you don't need yet. Start with Dockerized services (API, worker, frontend) deployed via a simple platform (AWS ECS Fargate, or Render/Railway for a true MVP) fronted by a managed Postgres (RDS) and S3.
- Design services to be stateless from the start (session state and job state live in Postgres/Redis, not in-process) so the *same containers* move to ECS/Kubernetes later without rearchitecting.
- **Recommendation: AWS ECS Fargate for MVP (you're already using S3, so staying in AWS avoids cross-cloud egress costs), with a clear path to EKS if/when you need more control over autoscaling and multi-region.**

### 3.4 Full stack summary

| Layer | Choice |
|---|---|
| Frontend | React.js (Vite), TanStack Query for server state, WebSocket/SSE for streaming responses |
| Backend API | Node.js (Express or Fastify) |
| Orchestration | LangChain.js + LangGraph.js (state machine per chat turn) |
| LLM | Llama 3.3 70B via Groq (free tier), swappable via LangChain interface |
| Embeddings | BGE-M3, self-hosted (free, MIT license) |
| Dense retrieval | pgvector (HNSW index) |
| Sparse retrieval | Postgres full-text search / ParadeDB BM25 extension |
| Reranking | bge-reranker-v2-m3, self-hosted (free, open source) |
| Relational + vector + metadata DB | PostgreSQL (RDS) |
| Object storage | AWS S3 |
| Job queue (ingestion is async) | BullMQ + Redis |
| Auth | Auth.js / Clerk / Supabase Auth (pick one — don't hand-roll) |
| Deployment | Docker → AWS ECS Fargate (MVP) → EKS (scale) |
| Observability | OpenTelemetry + LangSmith (LangChain's native tracing — very useful for debugging RAG pipelines) |
| Web search (Explore mode) | Tavily API (free tier: ~1,000 searches/month) |

---

## 4. System Architecture (Five Layers, per your notes)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DATA LAYER                                                │
│    - Raw PDFs → S3 (immutable, versioned)                    │
│    - Documents/Chats/Users metadata → Postgres               │
│    - APIs: upload, list, delete document                     │
├─────────────────────────────────────────────────────────────┤
│ 2. RETRIEVAL LAYER                                            │
│    - Dense vector search (pgvector, HNSW)                    │
│    - Sparse/lexical search (BM25 / full-text)                │
│    - Fusion of both (Reciprocal Rank Fusion)                 │
├─────────────────────────────────────────────────────────────┤
│ 3. INTELLIGENCE LAYER                                         │
│    - Re-ranking (self-hosted cross-encoder, bge-reranker-v2-m3) │
│    - Top-K limiting post-rerank                               │
│    - Context assembly + smart context-window packing          │
│    - Mode logic: Focus (chunks only) vs Explore (chunks + web)│
├─────────────────────────────────────────────────────────────┤
│ 4. SERVING LAYER                                               │
│    - LangGraph state machine per turn                         │
│    - LLM inference via Groq API (Llama 3.3 70B, streamed to client)│
│    - Citation/grounding-check pass before returning answer    │
├─────────────────────────────────────────────────────────────┤
│ 5. MONITORING LAYER                                             │
│    - Logs, latency & cost metrics, retrieval quality metrics  │
│    - Faithfulness/hallucination evaluation (sampled)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Data Model

### 5.1 S3 layout
```
s3://chalk-app/
  {user_id}/
    {chat_id}/
      raw/{document_id}.pdf
```

### 5.2 Postgres schema (core tables)

```sql
-- Users
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,          -- if not using a managed auth provider
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Chats: the isolation boundary
chats (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,               -- user-renameable
  mode TEXT NOT NULL DEFAULT 'focus',        -- 'focus' | 'explore'
  perf_mode TEXT NOT NULL DEFAULT 'balanced', -- 'speed' | 'balanced' | 'accuracy'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ            -- soft delete
)

-- Documents ingested into a chat
documents (
  id UUID PRIMARY KEY,
  chat_id UUID REFERENCES chats(id),
  filename TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  doc_type TEXT,                    -- 'notes' | 'reference_book' | 'other'
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | ready | failed
  page_count INT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
)

-- Chunks (the retrievable units)
chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  chat_id UUID REFERENCES chats(id),   -- denormalized for fast scoping
  content TEXT NOT NULL,
  embedding VECTOR(1024),               -- pgvector column, dim depends on embedding model
  token_count INT,
  page_number INT,
  bbox JSONB,                           -- bounding box on the page, for click-to-source citations
  chunk_index INT,                      -- order within document
  section_heading TEXT,                 -- from structure-aware chunking, if detected
  tsv TSVECTOR,                         -- generated column for BM25/full-text
  created_at TIMESTAMPTZ DEFAULT now()
)
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON chunks USING GIN (tsv);

-- Chat messages
messages (
  id UUID PRIMARY KEY,
  chat_id UUID REFERENCES chats(id),
  role TEXT NOT NULL,               -- 'user' | 'assistant'
  content TEXT NOT NULL,
  mode_used TEXT,                   -- captured at time of generation
  retrieved_chunk_ids UUID[],       -- for citation + evaluation/debugging
  created_at TIMESTAMPTZ DEFAULT now()
)
```

Chat isolation is enforced simply: every retrieval query filters `WHERE chat_id = :chat_id`, so one chat's vectors are never visible to another — no cross-tenant leakage risk even though all chats share one table.

---

## 6. Ingestion Pipeline

1. **Upload** — PDF goes to S3 first (raw, immutable); a `documents` row is created with `status = pending`; an ingestion job is queued (BullMQ).
2. **Extraction** — worker pulls the PDF from S3, extracts text (layout-aware extraction, e.g. `pdf-parse`/`unstructured.io`, preserving page numbers, bounding-box positions, and headings — required for clickable, page-linked citations, per the finalized decision in Section 15).
3. **Smart/semantic chunking** (from your notes):
   - Don't chunk by fixed character count alone — chunk at semantic boundaries (paragraph/section) using a splitter that respects headings and sentence boundaries (e.g. LangChain's `RecursiveCharacterTextSplitter` seeded with markdown/heading-aware separators, or a semantic chunker that splits where embedding similarity between adjacent sentences drops).
   - Target chunk size ~300–500 tokens with ~15% overlap, adjusted per document type (dense textbook prose vs bullet-point lecture notes need different sizes).
   - Attach metadata to every chunk: `document_id`, `page_number`, `section_heading`, `doc_type` — this metadata powers citations and filtering.
4. **Embedding** — batch-embed chunks (self-hosted BGE-M3), write embedding + tsvector into `chunks`.
5. **Status update** — `documents.status = ready`; chat becomes usable for that document. Ingestion progress is streamed to the frontend (SSE/WebSocket) so the student sees "3/5 documents ready."
6. **Incremental ingestion** — adding a new PDF to an existing chat just repeats steps 1–5 scoped to the same `chat_id`; no need to re-embed existing documents.

---

## 7. Retrieval Pipeline (Hybrid + Re-ranking)

For each user query, within a chat:

1. **Query understanding** — light preprocessing: expand abbreviations, optionally use the LLM to rewrite the query for retrieval (helps with short/vague student questions like "explain that diagram again").
2. **Hybrid retrieval**:
   - Dense: cosine similarity search over `embedding` (top ~30).
   - Sparse: BM25/full-text search over `tsv` (top ~30).
   - **Fusion**: combine both result sets via Reciprocal Rank Fusion (RRF) rather than a naive weighted average — RRF is robust without needing to tune weights per query type.
3. **Re-ranking**: pass the fused candidate set (~20–30 chunks) through a self-hosted cross-encoder re-ranker (`bge-reranker-v2-m3`, free/open source), which scores query-chunk relevance far more precisely than embedding similarity alone.
4. **Top-K limiting**: keep only the top N after re-ranking (N tunable — see Speed/Accuracy below), preventing context bloat.
5. **Context window management**: assemble the final context by:
   - De-duplicating near-identical chunks.
   - Grouping chunks by source document with citation markers.
   - Enforcing a hard token budget for the context block, leaving headroom for conversation history + system prompt.
6. **Grounded context assembly**: build the final prompt so that the LLM is instructed to answer *only* from the provided chunks (Focus mode) and to cite `[Doc: name, p.X]` for each claim.

### Speed vs Accuracy toggle — what it actually changes

| Setting | Speed | Balanced | Accuracy |
|---|---|---|---|
| Retrieval candidates before rerank | 15 | 30 | 50 |
| Reranking | skipped | cross-encoder | cross-encoder + larger candidate pool |
| Top-K passed to LLM | 4 | 6 | 10 |
| LLM | smaller/faster model | mid-tier | strongest available model |
| Query rewriting | off | on | on + multi-query expansion (generate 2-3 query variants, retrieve for each, fuse) |

### Focus vs Explore mode — what it actually changes

- **Focus**: system prompt strictly forbids answering beyond retrieved chunks; if retrieval confidence is low (e.g. top rerank score below a threshold), the assistant should say "Your notes don't seem to cover this" rather than guess.
- **Explore**: same retrieval pipeline runs first (still prioritizes prof material), but the LLM is permitted to add general knowledge or trigger a web search (Tavily) tool call when the retrieved chunks are insufficient — and the response should visually/structurally distinguish "From your notes" vs "Additional context" so the student always knows what's grounded.

---

## 8. LangGraph State Machine (per chat turn)

Model each turn as an explicit graph rather than a linear chain — this is what makes the mode/perf toggles and grounding checks tractable:

```
[User Query]
     │
     ▼
[Query Rewrite Node] (conditional: balanced/accuracy modes only)
     │
     ▼
[Hybrid Retrieve Node] ──► (dense + sparse, scoped to chat_id)
     │
     ▼
[Rerank Node] (conditional: skipped in Speed mode)
     │
     ▼
[Confidence Check Node] ──low confidence──► [Focus: "not in notes" response]
     │ sufficient                             └─(Explore: → Web Search Node)─┐
     ▼                                                                        │
[Context Assembly Node]  ◄────────────────────────────────────────────────────┘
     │
     ▼
[Generation Node] (Llama 3.3 70B via Groq, streamed)
     │
     ▼
[Citation/Grounding Verification Node] (checks claims map to retrieved chunks)
     │
     ▼
[Persist Message + Metrics Node] → messages table, monitoring pipeline
```

LangGraph's persistence (checkpointing) also gives you conversation-level state for free — useful for multi-turn context (e.g. "explain that again more simply") without re-engineering session memory separately.

---

## 9. Ingestion → Study Flow (matches your note diagram)

```
Ingestion → Retrieval → Re-ranking → Contextualization → Generation (by LLM)
```
This is exactly the pipeline in Section 7–8, with ingestion (Section 6) as the prerequisite step gating whether a chat is usable.

---

## 10. API Design (high level)

```
POST   /auth/signup | /auth/login
GET    /chats                          list user's chats
POST   /chats                          create chat (title, mode, perf_mode)
PATCH  /chats/:id                      rename / change mode / perf_mode
DELETE /chats/:id                      soft-delete
POST   /chats/:id/documents            upload PDF(s) → triggers ingestion job
GET    /chats/:id/documents            list documents + status
DELETE /chats/:id/documents/:docId
POST   /chats/:id/messages             send a query → streamed response (SSE)
GET    /chats/:id/messages             message history
```

---

## 11. Monitoring & Evaluation (Layer 5)

- **Operational metrics**: latency per pipeline stage (retrieval, rerank, generation), token usage/cost per chat, error rates on ingestion jobs.
- **Retrieval quality**: log retrieved chunk IDs per query; periodically sample and manually/LLM-grade relevance (precision@k).
- **Faithfulness/hallucination checks**: sampled evaluation where an LLM judge checks whether generated claims are supported by the cited chunks (RAGAS framework is a good fit here — it has built-in metrics for faithfulness, answer relevance, and context precision/recall).
- **Tracing**: LangSmith gives per-node traces of the LangGraph execution, which is invaluable for debugging why a specific answer went wrong (bad retrieval vs bad generation vs bad rerank).

---

## 12. Best Practices Checklist (from your notes, mapped to this design)

- [x] Hybrid retrieval + reranking for accuracy → Section 7
- [x] Limit Top-K and manage context window size → Section 7 (perf table)
- [x] Cache embeddings and retrieval results → embeddings cached at ingestion time (never recomputed); consider a query-result cache (Redis) for repeated/common questions within a chat
- [x] Monitor latency, cost, and answer faithfulness → Section 11
- [x] Add citations / context grounding checks → Section 8 (Citation/Grounding Verification Node)

---

## 13. Security & Multi-tenancy

- All retrieval and document queries scoped by `chat_id` **and** verified `user_id` ownership at the API layer — never trust a client-supplied `chat_id` alone.
- S3 objects private by default, served via short-lived signed URLs only when the owning user requests the original PDF.
- PDF upload validation (file type, size limits, malware scanning if budget allows — e.g. ClamAV in the ingestion worker) before processing.
- Rate limiting on ingestion (compute-expensive) and generation (token-expensive) endpoints per user.

---

## 14. Suggested Build Phases

1. **MVP**: auth, single-mode ingestion (PDF → chunks → pgvector), basic dense-only retrieval, Focus mode only, one LLM, no rerank. Get the core loop working end-to-end.
2. **Retrieval quality**: add sparse search + RRF fusion + reranking; add citations.
3. **Modes**: add Explore mode + web search tool; add Speed/Accuracy toggle.
4. **Chat management UX**: rename/delete, incremental ingestion into existing chats, ingestion progress streaming.
5. **Production hardening**: monitoring/tracing (LangSmith), RAGAS evaluation harness, rate limiting, move from Docker Compose to ECS.
6. **Scale**: revisit pgvector vs dedicated vector DB decision based on real chunk-count/QPS data; consider read replicas for Postgres.

---

## 15. Finalized Decisions

- **Target scale**: design for ~500–2,000 students at launch, ~5–10 chats per student, ~5–10 documents per chat (~10,000–50,000 documents, ~2–5M chunks steady state). Well within pgvector's comfortable range — no need to revisit the vector DB decision for at least 1–2 years of real growth.
- **Citations**: clickable, page-linked citations back to the source PDF (not just plain text). This means the extraction step (Section 6) must reliably preserve page numbers and, ideally, bounding-box/position data per chunk so the frontend can deep-link into the PDF viewer at the right page.
- **Explore mode web search**: scoped, not open web. Use an allowlist of reference/educational domains (NCERT, OpenStax, Khan Academy, Wikipedia, standard university course pages) passed to the Tavily search call, and the UI must visually separate "From your notes" content from "From the web" content so grounding is never ambiguous to the student.
- **LLM/embedding budget**: switched to a fully free stack — Llama 3.3 70B via Groq's free tier (generation) + self-hosted BGE-M3 (embeddings) + self-hosted bge-reranker-v2-m3 (reranking). Zero per-token API cost; the only real infra spend is a small server to host the embedding/reranking models. Groq's free tier has request-rate limits worth monitoring once usage grows, with Google AI Studio's free Gemini Flash tier as a backup generation path if needed. Revisit paid models (e.g. Claude) later, self-funded, as an optional "Accuracy mode" upgrade once there's real usage/revenue to justify it — the LangChain-based interfaces already make that a config change, not a rewrite.
