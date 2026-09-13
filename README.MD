# 🖍️ Chalk — RAG-Powered Study Assistant

> **Chalk** is an intelligent, RAG-powered study assistant designed specifically for students and researchers. Every chat session is scoped to your uploaded course materials (lecture notes, slides, and reference books). Answers are strictly grounded in your materials with exact citations, eliminating hallucinations unless you explicitly switch to **Agent** mode.

[![Docker Image](https://img.shields.io/badge/Docker%20Hub-r0bince%2Fchalk%3Alatest-blue?logo=docker)](https://hub.docker.com/r/r0bince/chalk)

---

## 🚀 Quick Start with Docker

The fastest way to run Chalk is using the official pre-built Docker image from Docker Hub:  
🔗 **Docker Hub Repository:** [`r0bince/chalk:latest`](https://hub.docker.com/r/r0bince/chalk)

### Step 1: Open a terminal and create a folder

Create a dedicated directory on your system and navigate into it:

```bash
# Linux / macOS / Git Bash
mkdir chalk-app && cd chalk-app

# Windows (PowerShell)
mkdir chalk-app; cd chalk-app
```

---

### Step 2: Create a `.env` file

Inside the `chalk-app` folder, create a `.env` file containing your API keys and configuration:

```env
# ─── Database (PostgreSQL with pgvector) ─────────────────
# Example: Neon, Supabase, or self-hosted PostgreSQL
DATABASE_URL=postgresql://username:password@your-db-host:5432/chalk?sslmode=require

# ─── Redis (Job Queue & Cache) ──────────────────────────
# Example: Upstash Redis or local Redis instance
REDIS_URL=rediss://default:your-redis-token@your-redis-host:6379

# ─── Clerk Authentication ────────────────────────────────
# From your Clerk Dashboard (https://dashboard.clerk.com)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# ─── LLM & Search Providers ──────────────────────────────
# Groq API Key (https://console.groq.com)
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
# Grader LLM (Fast model for deterministic evaluation, default: llama-3.1-8b-instant)
GROQ_GRADER_MODEL=llama-3.1-8b-instant

# Tavily API Key for Agent Mode Web Search (https://tavily.com)
TAVILY_API_KEY=tvly_...

# ─── Observability (Optional — LangSmith) ─────────────────
LANGCHAIN_TRACING_V2=false
# LANGCHAIN_API_KEY=lsv2_...
# LANGCHAIN_PROJECT="chalk-production"

# ─── Storage Configuration ───────────────────────────────
# Use 'local' (stores in container /app/uploads) or 's3' for AWS S3
STORAGE_PROVIDER=local

# AWS S3 (Only required if STORAGE_PROVIDER=s3)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key
# S3_BUCKET=your-bucket-name

# ─── Server Configuration ────────────────────────────────
PORT=3001
NODE_ENV=production
```

> [!TIP]
> **Need a free PostgreSQL database with `pgvector`?** You can spin one up in seconds on [Neon](https://neon.tech) or [Supabase](https://supabase.com).  
> **Need a free Redis instance?** Use [Upstash Redis](https://upstash.com).

---

### Step 3: Pull the Docker Image

Pull the latest Chalk monolithic image (bundles frontend, API server, and ingestion worker):

```bash
docker pull r0bince/chalk:latest
```

---

### Step 4: Run the Container

Run Chalk with your `.env` configuration mounted:

#### Linux / macOS:
```bash
docker run -d \
  --name chalk \
  --restart unless-stopped \
  --env-file .env \
  -p 3001:3001 \
  -v $(pwd)/uploads:/app/uploads \
  r0bince/chalk:latest
```

#### Windows (PowerShell):
```powershell
docker run -d `
  --name chalk `
  --restart unless-stopped `
  --env-file .env `
  -p 3001:3001 `
  -v ${PWD}/uploads:/app/uploads `
  r0bince/chalk:latest
```

#### Windows (Command Prompt):
```cmd
docker run -d ^
  --name chalk ^
  --restart unless-stopped ^
  --env-file .env ^
  -p 3001:3001 ^
  -v %cd%/uploads:/app/uploads ^
  r0bince/chalk:latest
```

---

### Step 5: Access Chalk

Open your browser and navigate to:
```
http://localhost:3001
```

To view the live application and worker logs:
```bash
docker logs -f chalk
```

---

## 📖 Application Guide & Overview

Chalk is built around a single guiding principle: **Strict Academic Grounding**. Unlike standard chatbots that hallucinate or mix external web data into coursework, Chalk isolates your study materials into dedicated workspaces and uses a self-correcting evaluation loop before answering.

```
┌──────────────────────────────────────────────────────────────────┐
│                          CHALK PIPELINE                          │
│                                                                  │
│   PDF Uploads ──► Ingestion Worker ──► Dense + Sparse Index      │
│                          │                                       │
│   User Query  ──► Hybrid Retrieval ──► Cross-Reranker            │
│                          │                                       │
│               Fast LLM Grader (Groq Llama 3.1 8B)                │
│                          │                                       │
│                 Sufficient?                                      │
│                 ├── YES ──► Grounded Synthesis (Notes Only)      │
│                 └── NO (Retries < 1) ──► Query Rewrite ──┐       │
│                                              ▲           │       │
│                                              └── Loop ───┘       │
│                                                                  │
│                 Focus Mode  ──► Fast Exit ("Not covered")        │
│                 Agent Mode  ──► Auto-Search ON: Tavily Search    │
│                             ──► Auto-Search OFF: Interrupt &     │
│                                  Prompt Confirmation             │
│                          │                                       │
│             Streaming SSE Response + Dual Citations              │
└──────────────────────────────────────────────────────────────────┘
```

### 🌟 Key Features

#### 1. 📁 Chat-Scoped Knowledge Repositories
- Each chat session has its own isolated document collection.
- Upload lecture slides, syllabi, PDF notes, or textbook chapters.
- Database queries strictly enforce session isolation (`WHERE chat_id = :chat_id`) to prevent cross-subject contamination.

#### 2. 🎯 Focus vs. 🤖 Agent Modes
- **Shared Self-Correcting Loop (`retrieve_and_grade`)**: Both modes utilize a fast LLM evaluation step (`llama-3.1-8b-instant` on Groq, temperature 0). If retrieved notes do not contain sufficient answers, the grader identifies the missing concept and rewrites the search query for a targeted retry.
- **Focus Mode (Default)**: Strictly restricts answers to your uploaded documents. If the material does not cover the topic, Chalk clearly tells you so instead of hallucinating. Never calls external web search.
- **Agent Mode**: Answers from your notes first if they are sufficient. If notes lack coverage:
  - **Auto-Search ON (Default)**: Seamlessly proceeds to Tavily web search (scoped to educational domains: NCERT, OpenStax, Khan Academy, Wikipedia) and synthesizes an answer with both document and web citations.
  - **Auto-Search OFF**: Employs LangGraph's `interrupt()` primitive to pause execution and surface an interactive prompt card. You can preview the suggested search query and choose to either search the web or answer using partial notes only.

#### 3. ⚡ Speed / Balanced / Accuracy Modes
- **Speed (S)**: Fast vector search with low latency for quick concept lookups.
- **Balanced (B)**: Hybrid dense (`pgvector`) + sparse (`tsvector` BM25) retrieval fused via **Reciprocal Rank Fusion (RRF)**.
- **Accuracy (A)**: Hybrid retrieval combined with a neural **Cross-Encoder Reranker** (`Xenova/ms-marco-MiniLM-L-6-v2`) for pinpoint precision on complex questions.

#### 4. 🏷️ Verifiable In-Text Citations
- **Document Citations**: Interactive `📄 [Doc: Chapter 4 Notes, p.12]` chips indicating exact page numbers and source excerpts from your uploaded notes.
- **Web Citations**: Interactive `🌐 [Web: openstax.org]` chips for external material retrieved in Agent mode.
- Clicking a citation displays the exact text chunk extracted from your material.

#### 5. 🤖 Smart Chat Management
- **Auto-Naming**: Chats automatically adopt a clean, concise title from your first question.
- **Project Organization**: Categorize and search past study sessions instantly with the built-in Command Palette (`Ctrl+K` / `Cmd+K`).

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TanStack Query, Vanilla CSS Design System |
| **Backend** | Node.js, Express, Server-Sent Events (SSE) |
| **Orchestration** | LangChain.js & LangGraph.js (State Machine with `interrupt()` & Checkpointing) |
| **Worker & Queue** | BullMQ, Redis, PDF extraction |
| **Database** | PostgreSQL + `pgvector` (HNSW) + `tsvector` (BM25) |
| **Embeddings** | Local ONNX Transformers (`all-MiniLM-L6-v2`) |
| **Reranking** | Hugging Face Transformers (`ms-marco-MiniLM-L-6-v2`) |
| **LLM Engine** | Groq (Llama 3.3 70B generation, Llama 3.1 8B Instant grader) |
| **Web Search** | Tavily Search API (scoped to verified educational domains) |
| **Authentication** | Clerk Auth |
| **Storage** | Local Filesystem or AWS S3 |

---

## 🛑 Managing the Container

```bash
# Stop the container
docker stop chalk

# Start the container again
docker start chalk

# Restart the container
docker restart chalk

# Remove the container
docker rm -f chalk
```


