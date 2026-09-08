// ─── Enums ─────────────────────────────────────────────

export type ChatMode = 'focus' | 'explore';
export type PerfMode = 'speed' | 'balanced' | 'accuracy';
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type DocType = 'notes' | 'reference_book' | 'other';
export type MessageRole = 'user' | 'assistant';

// ─── Entity Types ──────────────────────────────────────

export interface User {
  id: string;
  email: string;
  clerkId: string;
  createdAt: Date;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  mode: ChatMode;
  perfMode: PerfMode;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Document {
  id: string;
  chatId: string;
  filename: string;
  s3Key: string;
  docType: DocType | null;
  status: DocumentStatus;
  pageCount: number | null;
  uploadedAt: Date;
}

export interface Chunk {
  id: string;
  documentId: string;
  chatId: string;
  content: string;
  embedding: number[] | null;
  tokenCount: number | null;
  pageNumber: number | null;
  bbox: Record<string, unknown> | null;
  chunkIndex: number | null;
  sectionHeading: string | null;
  createdAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  modeUsed: string | null;
  retrievedChunkIds: string | null; // JSON string of UUID[]
  createdAt: Date;
}

// ─── API Request/Response Types ────────────────────────

export interface CreateChatRequest {
  title: string;
  mode?: ChatMode;
  perfMode?: PerfMode;
}

export interface UpdateChatRequest {
  title?: string;
  mode?: ChatMode;
  perfMode?: PerfMode;
}

export interface SendMessageRequest {
  content: string;
}

export interface UploadDocumentRequest {
  docType?: DocType;
}

// ─── RAG Types ─────────────────────────────────────────

export interface RetrievedChunk {
  id: string;
  content: string;
  documentId: string;
  pageNumber: number | null;
  sectionHeading: string | null;
  similarity: number;
  filename: string;
}

export interface CitationMarker {
  chunkId: string;
  documentName: string;
  pageNumber: number | null;
  label: string; // e.g. "[Doc: Chapter 4 Notes, p.12]"
}

export interface IngestionJob {
  documentId: string;
  chatId: string;
  userId: string;
  s3Key: string;
  filename: string;
}

export interface IngestionProgress {
  documentId: string;
  stage: 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'ready' | 'failed';
  progress?: number; // 0-100
  error?: string;
}
