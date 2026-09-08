import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core';

// ─── Custom pgvector type ──────────────────────────────
// Drizzle doesn't have built-in pgvector support, so we define a custom type.
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // Postgres returns vector as '[0.1,0.2,...]'
    return value
      .slice(1, -1)
      .split(',')
      .map(Number);
  },
});

// ─── Custom tsvector type ──────────────────────────────
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: string): string {
    return value;
  },
});

// ─── Users ─────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  clerkId: text('clerk_id').unique().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Chats ─────────────────────────────────────────────
export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  mode: text('mode').notNull().default('focus'), // 'focus' | 'explore'
  perfMode: text('perf_mode').notNull().default('balanced'), // 'speed' | 'balanced' | 'accuracy'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // soft delete
}, (table) => [
  index('idx_chats_user_id').on(table.userId),
]);

// ─── Documents ─────────────────────────────────────────
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id')
    .references(() => chats.id)
    .notNull(),
  filename: text('filename').notNull(),
  s3Key: text('s3_key').notNull(),
  docType: text('doc_type'), // 'notes' | 'reference_book' | 'other'
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'ready' | 'failed'
  pageCount: integer('page_count'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_documents_chat_id').on(table.chatId),
]);

// ─── Chunks ────────────────────────────────────────────
export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .references(() => documents.id)
    .notNull(),
  chatId: uuid('chat_id')
    .references(() => chats.id)
    .notNull(), // denormalized for fast scoping
  content: text('content').notNull(),
  embedding: vector('embedding'),
  tokenCount: integer('token_count'),
  pageNumber: integer('page_number'),
  bbox: jsonb('bbox'), // bounding box for click-to-source citations
  chunkIndex: integer('chunk_index'), // order within document
  sectionHeading: text('section_heading'), // from structure-aware chunking
  tsv: tsvector('tsv'), // generated column for BM25/full-text
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_chunks_chat_id').on(table.chatId),
  index('idx_chunks_document_id').on(table.documentId),
  // NOTE: HNSW and GIN indexes are created in the raw SQL migration
  // because Drizzle doesn't support pgvector/tsvector index types natively.
]);

// ─── Messages ──────────────────────────────────────────
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id')
    .references(() => chats.id)
    .notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  modeUsed: text('mode_used'), // captured at generation time
  retrievedChunkIds: text('retrieved_chunk_ids'), // JSON array of UUIDs, stored as text for simplicity
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_messages_chat_id').on(table.chatId),
]);
