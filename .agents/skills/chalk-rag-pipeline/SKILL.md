---
name: chalk-rag-pipeline
description: >-
  Use this skill when implementing or debugging the RAG pipeline: document ingestion
  (PDF extraction, semantic chunking, embedding), hybrid retrieval (dense + sparse + RRF),
  cross-encoder reranking, context window management, grounded context assembly,
  the LangGraph state machine, or the Speed/Accuracy and Focus/Explore mode logic.
---

# Chalk RAG Pipeline Implementation Guide

## Ingestion Pipeline Steps

### 1. PDF Upload
- Store raw PDF in S3: `s3://chalk-app/{user_id}/{chat_id}/raw/{document_id}.pdf`
- Create `documents` row with `status = 'pending'`
- Queue BullMQ job for async processing

### 2. Text Extraction
- Use layout-aware extraction (e.g. `pdf-parse`, `unstructured.io`)
- **Must preserve**: page numbers, bounding-box positions, headings
- Page/bbox data is critical for clickable, page-linked citations

### 3. Semantic Chunking
- **Do NOT** chunk by fixed character count alone
- Split at semantic boundaries (paragraphs, sections, heading breaks)
- Use heading-aware separators or a semantic chunker that splits where embedding similarity between adjacent sentences drops
- Target: ~300–500 tokens per chunk, ~15% overlap
- Adjust chunk size per document type (dense textbook prose vs bullet-point lecture notes)
- Attach metadata per chunk:
  - `document_id`, `chat_id` (denormalized)
  - `page_number`, `section_heading`
  - `doc_type` ('notes' | 'reference_book' | 'other')
  - `bbox` (bounding box JSON for click-to-source)
  - `chunk_index` (order within document)

### 4. Embedding
- Batch embed chunks using Voyage AI (primary) or OpenAI `text-embedding-3` (fallback)
- Write `embedding` (VECTOR(1024)) and auto-generated `tsv` (TSVECTOR) columns
- Embedding dimension depends on model — update VECTOR dimension if switching models

### 5. Status & Progress
- Update `documents.status = 'ready'` on completion (`'failed'` on error)
- Stream ingestion progress to frontend via SSE/WebSocket
- Show per-document stage: Uploading → Extracting → Chunking → Embedding → Ready

---

## Retrieval Pipeline

All retrieval is scoped: `WHERE chat_id = :chat_id`

### Step 1: Query Understanding
```
User query → abbreviation expansion → (optional) LLM query rewrite
```
- Query rewrite helps with short/vague queries ("explain that diagram again")
- Rewrite is conditional: OFF in Speed mode, ON in Balanced/Accuracy

### Step 2: Hybrid Retrieval
```
                    ┌── Dense search (pgvector cosine, top ~30) ──┐
User query (rewritten) ─┤                                            ├─ RRF fusion
                    └── Sparse search (BM25/tsvector, top ~30) ──┘
```
- Use Reciprocal Rank Fusion (RRF), not weighted average — RRF is robust without per-query weight tuning
- RRF formula: `score(d) = Σ 1/(k + rank_i(d))` where k is typically 60

### Step 3: Reranking
- Pass fused candidates (~20–30 chunks) through cross-encoder reranker
- Options: Cohere Rerank API or self-hosted `bge-reranker`
- Reranking is **skipped** in Speed mode
- In Accuracy mode: larger candidate pool (50) before reranking

### Step 4: Top-K Limiting
| Mode | Top-K |
|---|---|
| Speed | 4 |
| Balanced | 6 |
| Accuracy | 10 |

### Step 5: Context Window Management
- De-duplicate near-identical chunks
- Group chunks by source document with citation markers
- Enforce hard token budget, leaving headroom for conversation history + system prompt

### Step 6: Grounded Context Assembly
- **Focus mode**: instruct LLM to answer ONLY from provided chunks, cite `[Doc: name, p.X]` for each claim
- **Explore mode**: same retrieval first (prioritize prof material), but LLM may add general knowledge or call Tavily web search (scoped to educational domains: NCERT, OpenStax, Khan Academy, Wikipedia)
- Response must visually separate "From your notes" vs "Additional context"

---

## LangGraph State Machine

Each chat turn is modeled as an explicit graph:

```
[User Query]
     │
     ▼
[Query Rewrite Node]       ← conditional: balanced/accuracy modes only
     │
     ▼
[Hybrid Retrieve Node]     ← dense + sparse, scoped to chat_id
     │
     ▼
[Rerank Node]              ← conditional: skipped in Speed mode
     │
     ▼
[Confidence Check Node]
     │
     ├── sufficient ──────────────────────────┐
     │                                         │
     └── low confidence                        │
          ├── Focus → "not in notes" response  │
          └── Explore → [Web Search Node] ─────┤
                                               │
                                               ▼
                                    [Context Assembly Node]
                                               │
                                               ▼
                                    [Generation Node] (Claude, streamed)
                                               │
                                               ▼
                                    [Citation/Grounding Verification Node]
                                               │
                                               ▼
                                    [Persist Message + Metrics Node]
```

### Node Implementation Notes
- Use LangGraph's persistence (checkpointing) for conversation-level state
- Streaming: use Claude's streaming API, forward chunks to client via SSE
- Citation verification: post-generation pass checking that claims map to retrieved chunks
- Metrics: log latency per node, token usage, retrieved chunk IDs (for evaluation)

---

## Multi-Query Expansion (Accuracy Mode)

In Accuracy mode, query rewriting also generates 2–3 query variants:
1. Original query (cleaned)
2. Rephrased for broader concept matching
3. Rephrased focusing on specific terms/formulas

Each variant retrieves independently, results are fused via RRF before reranking.

---

## Error Handling
- If extraction fails → `documents.status = 'failed'`, notify user, allow retry
- If embedding API is down → queue retry with exponential backoff
- If reranker is unavailable → fall back to RRF-fused ranking (skip rerank node)
- If LLM API is down → return error with retry option, don't serve stale/cached answers
