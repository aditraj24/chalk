-- Chalk initial schema migration
-- Creates all core tables, pgvector extension, and indexes

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  clerk_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Chats ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'focus',
  perf_mode TEXT NOT NULL DEFAULT 'balanced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);

-- ─── Documents ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  filename TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  doc_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  page_count INT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_chat_id ON documents(chat_id);

-- ─── Chunks ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  chat_id UUID NOT NULL REFERENCES chats(id),
  content TEXT NOT NULL,
  embedding VECTOR(1024),
  token_count INT,
  page_number INT,
  bbox JSONB,
  chunk_index INT,
  section_heading TEXT,
  tsv TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pgvector HNSW index for dense retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);

-- GIN index for BM25/full-text sparse retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON chunks USING GIN (tsv);

-- Chat scoping indexes
CREATE INDEX IF NOT EXISTS idx_chunks_chat_id ON chunks(chat_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);

-- Auto-generate tsvector from content on INSERT/UPDATE
CREATE OR REPLACE FUNCTION chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('english', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chunks_tsv
  BEFORE INSERT OR UPDATE OF content ON chunks
  FOR EACH ROW
  EXECUTE FUNCTION chunks_tsv_trigger();

-- ─── Messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  mode_used TEXT,
  retrieved_chunk_ids TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
