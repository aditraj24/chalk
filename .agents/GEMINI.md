# Chalk — Project Rules

## Project Overview
Chalk is a RAG-powered study assistant where every chat session is scoped to a specific set of ingested documents (professor's notes + reference books). Answers are strictly grounded in that material unless the student explicitly opts into Explore mode.

## Tech Stack (Enforced)
- **Frontend**: React.js (Vite), TanStack Query, WebSocket/SSE for streaming
- **Backend**: Node.js (Express or Fastify)
- **Orchestration**: LangChain.js + LangGraph.js (explicit state machine per chat turn)
- **LLM**: Anthropic Claude (generation), swappable via LangChain interface
- **Embeddings**: Voyage AI (or OpenAI `text-embedding-3` as fallback)
- **Database**: PostgreSQL with pgvector (HNSW) for dense retrieval, tsvector/BM25 for sparse retrieval
- **Object Storage**: AWS S3
- **Job Queue**: BullMQ + Redis
- **Auth**: Auth.js / Clerk / Supabase Auth (no hand-rolled auth)
- **Observability**: OpenTelemetry + LangSmith
- **Web Search (Explore mode)**: Tavily API

## Architectural Constraints
- Chat isolation: all retrieval queries MUST filter `WHERE chat_id = :chat_id`. Never allow cross-chat data leakage.
- All document queries MUST verify `user_id` ownership at the API layer — never trust client-supplied `chat_id` alone.
- Services must be stateless — session/job state lives in Postgres/Redis, not in-process.
- Raw PDFs go to S3 (immutable, versioned). Text, embeddings, and metadata go to Postgres.
- Ingestion is async via BullMQ job queue, never synchronous in the request handler.
- LLM and embedding providers sit behind LangChain interfaces so they are swappable.

## Coding Standards
- Use TypeScript for all backend and frontend code.
- Use UUID for all primary keys.
- Use `TIMESTAMPTZ` for all timestamps in Postgres.
- Soft-delete for chats (use `deleted_at` column).
- All API endpoints follow RESTful conventions per the API design in the architecture doc.
- Environment-specific config via environment variables, never hardcoded secrets.

## Design System
- Follow the Chalk UI Design System (`chalk-ui.md`) for all frontend work.
- Both light and dark themes are first-class — never treat dark mode as an inverted afterthought.
- Use CSS custom properties (`--bg-base`, `--text-primary`, etc.) for all colors.
- Typography: Plus Jakarta Sans (headings/UI) + Inter (body/messages) + JetBrains Mono (code blocks only).
