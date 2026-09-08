---
name: chalk-architecture
description: >-
  Use this skill when working on Chalk's backend, database schema, API endpoints,
  RAG pipeline, ingestion pipeline, LangGraph orchestration, or system architecture.
  Covers the five-layer architecture (Data, Retrieval, Intelligence, Serving, Monitoring),
  Postgres schema, S3 layout, hybrid retrieval + reranking, Focus/Explore modes,
  Speed/Accuracy toggle, and deployment strategy.
---

# Chalk Architecture & RAG Pipeline

## Five-Layer Architecture

```
1. DATA LAYER         → S3 (raw PDFs), Postgres (metadata, chunks, embeddings)
2. RETRIEVAL LAYER    → Dense (pgvector HNSW) + Sparse (BM25/tsvector) + RRF fusion
3. INTELLIGENCE LAYER → Reranking, Top-K limiting, context assembly, mode logic
4. SERVING LAYER      → LangGraph state machine, Claude inference (streamed), citation check
5. MONITORING LAYER   → Latency/cost metrics, retrieval quality, hallucination eval
```

---

## Data Model

### S3 Layout
```
s3://chalk-app/{user_id}/{chat_id}/raw/{document_id}.pdf
```

### Postgres Schema (Core Tables)

Refer to: [Chalk-Architecture-Document.md](../../Chalk-Architecture-Document.md) Section 5.2

Key tables: `users`, `chats`, `documents`, `chunks`, `messages`

Critical columns on `chunks`:
- `embedding VECTOR(1024)` — pgvector, dimension depends on embedding model
- `tsv TSVECTOR` — generated column for BM25/full-text
- `page_number`, `bbox JSONB`, `section_heading` — metadata for citations
- `chat_id` — denormalized for fast scoping

Required indexes:
```sql
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON chunks USING GIN (tsv);
```

---

## Ingestion Pipeline

1. **Upload** → PDF to S3, `documents` row with `status = pending`, BullMQ job queued
2. **Extraction** → Worker pulls PDF from S3, layout-aware extraction preserving page numbers, bounding boxes, headings
3. **Smart Chunking** → Semantic boundary splitting (not fixed char count). Target ~300–500 tokens, ~15% overlap. Attach metadata: `document_id`, `page_number`, `section_heading`, `doc_type`
4. **Embedding** → Batch embed chunks (Voyage/OpenAI), write embedding + tsvector
5. **Status Update** → `documents.status = ready`, stream progress to frontend via SSE/WebSocket
6. **Incremental** → Adding a new PDF repeats steps 1–5 scoped to same `chat_id`

---

## Retrieval Pipeline (Hybrid + Reranking)

Per user query, scoped to `chat_id`:

1. **Query Understanding** → Expand abbreviations, optionally LLM-rewrite the query
2. **Hybrid Retrieval**:
   - Dense: cosine similarity over `embedding` (top ~30)
   - Sparse: BM25/full-text over `tsv` (top ~30)
   - Fusion: Reciprocal Rank Fusion (RRF)
3. **Reranking** → Cross-encoder (Cohere Rerank or `bge-reranker`) on fused candidates
4. **Top-K Limiting** → Keep top N post-rerank (N varies by perf mode)
5. **Context Window Management** → De-duplicate, group by source doc with citation markers, enforce token budget
6. **Grounded Context Assembly** → Build prompt instructing LLM to answer only from chunks (Focus) and cite `[Doc: name, p.X]`

### Speed vs Accuracy Toggle

| Setting | Speed | Balanced | Accuracy |
|---|---|---|---|
| Retrieval candidates before rerank | 15 | 30 | 50 |
| Reranking | skipped | cross-encoder | cross-encoder + larger pool |
| Top-K to LLM | 4 | 6 | 10 |
| LLM | smaller/faster | mid-tier | strongest available |
| Query rewriting | off | on | on + multi-query expansion |

### Focus vs Explore Mode

- **Focus**: System prompt forbids answering beyond retrieved chunks. If low confidence → "Your notes don't seem to cover this"
- **Explore**: Same retrieval runs first. LLM may add general knowledge or trigger web search (Tavily, scoped to educational domains). Response visually separates "From your notes" vs "Additional context"

---

## LangGraph State Machine (Per Turn)

```
[User Query]
     → [Query Rewrite Node] (conditional: balanced/accuracy only)
     → [Hybrid Retrieve Node] (dense + sparse, scoped to chat_id)
     → [Rerank Node] (conditional: skipped in Speed mode)
     → [Confidence Check Node]
          ├── low confidence + Focus → "not in notes" response
          └── low confidence + Explore → Web Search Node
     → [Context Assembly Node]
     → [Generation Node] (Claude, streamed)
     → [Citation/Grounding Verification Node]
     → [Persist Message + Metrics Node]
```

---

## API Endpoints

```
POST   /auth/signup | /auth/login
GET    /chats
POST   /chats                          (title, mode, perf_mode)
PATCH  /chats/:id                      (rename, change mode/perf_mode)
DELETE /chats/:id                      (soft-delete)
POST   /chats/:id/documents            (upload PDFs → triggers ingestion)
GET    /chats/:id/documents            (list documents + status)
DELETE /chats/:id/documents/:docId
POST   /chats/:id/messages             (send query → streamed SSE response)
GET    /chats/:id/messages             (message history)
```

---

## Security

- All queries scoped by `chat_id` AND verified `user_id` at API layer
- S3 objects private, served via short-lived signed URLs
- PDF upload validation: file type, size limits, optional malware scanning
- Rate limiting on ingestion and generation endpoints per user

---

## Build Phases

1. **MVP**: Auth, PDF ingestion → chunks → pgvector, dense-only retrieval, Focus mode, one LLM
2. **Retrieval Quality**: Sparse search + RRF + reranking + citations
3. **Modes**: Explore mode + web search, Speed/Accuracy toggle
4. **Chat UX**: Rename/delete, incremental ingestion, progress streaming
5. **Production**: Monitoring/tracing, RAGAS evaluation, rate limiting, Docker → ECS
6. **Scale**: Revisit pgvector vs dedicated vector DB based on real data
