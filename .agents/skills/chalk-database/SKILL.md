---
name: chalk-database
description: >-
  Use this skill when working on Chalk's database schema, migrations, queries,
  or pgvector/BM25 indexes. Covers the Postgres schema for users, chats, documents,
  chunks (with embedding and tsvector columns), and messages, as well as S3 layout
  and query patterns for chat-scoped retrieval.
---

# Chalk Database Schema & Query Patterns

## S3 Layout
```
s3://chalk-app/{user_id}/{chat_id}/raw/{document_id}.pdf
```
Raw PDFs are stored immutably and versioned. Served via short-lived signed URLs.

---

## Postgres Schema

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### chats
```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'focus',           -- 'focus' | 'explore'
  perf_mode TEXT NOT NULL DEFAULT 'balanced',   -- 'speed' | 'balanced' | 'accuracy'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ                        -- soft delete
);
```

### documents
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) NOT NULL,
  filename TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  doc_type TEXT,                                 -- 'notes' | 'reference_book' | 'other'
  status TEXT NOT NULL DEFAULT 'pending',         -- 'pending' | 'processing' | 'ready' | 'failed'
  page_count INT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
```

### chunks
```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) NOT NULL,
  chat_id UUID REFERENCES chats(id) NOT NULL,    -- denormalized for fast scoping
  content TEXT NOT NULL,
  embedding VECTOR(1024),                         -- pgvector, dimension = embedding model
  token_count INT,
  page_number INT,
  bbox JSONB,                                     -- bounding box for click-to-source citations
  chunk_index INT,                                -- order within document
  section_heading TEXT,                            -- from structure-aware chunking
  tsv TSVECTOR,                                   -- generated column for BM25/full-text
  created_at TIMESTAMPTZ DEFAULT now()
);

-- REQUIRED INDEXES
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_tsv ON chunks USING GIN (tsv);
CREATE INDEX idx_chunks_chat_id ON chunks (chat_id);
CREATE INDEX idx_chunks_document_id ON chunks (document_id);
```

### messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) NOT NULL,
  role TEXT NOT NULL,                              -- 'user' | 'assistant'
  content TEXT NOT NULL,
  mode_used TEXT,                                  -- captured at generation time
  retrieved_chunk_ids UUID[],                      -- for citation + evaluation
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Critical Query Patterns

### Chat-scoped dense retrieval
```sql
SELECT id, content, page_number, section_heading, document_id,
       1 - (embedding <=> $1) AS similarity
FROM chunks
WHERE chat_id = $2
ORDER BY embedding <=> $1
LIMIT $3;
```

### Chat-scoped sparse/BM25 retrieval
```sql
SELECT id, content, page_number, section_heading, document_id,
       ts_rank(tsv, plainto_tsquery($1)) AS rank
FROM chunks
WHERE chat_id = $2 AND tsv @@ plainto_tsquery($1)
ORDER BY rank DESC
LIMIT $3;
```

### CRITICAL: Every retrieval query MUST include `WHERE chat_id = :chat_id`
This enforces chat isolation — one chat's vectors are never visible to another.

### At the API layer: always verify user ownership
```sql
SELECT id FROM chats WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
```
Never trust a client-supplied `chat_id` alone.

---

## Migration Notes
- Use a migration tool (e.g. `node-pg-migrate`, Prisma, or Drizzle)
- pgvector extension must be enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- VECTOR dimension (1024) must match the embedding model — update if switching models
- Consider adding `pg_trgm` extension for fuzzy text search in the command surface
