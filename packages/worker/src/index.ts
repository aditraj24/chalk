import 'dotenv/config';
import { createRequire } from 'module';

// Polyfill sharp in require.cache to avoid native compilation errors when running headless in Docker
try {
  const require = createRequire(import.meta.url);
  const sharpResolved = require.resolve('sharp');
  require.cache[sharpResolved] = {
    id: sharpResolved,
    filename: sharpResolved,
    loaded: true,
    exports: () => ({}),
  } as any;
} catch {
  // Ignored if sharp is not resolvable
}

import { Worker } from 'bullmq';
import { INGESTION_QUEUE_NAME } from '@chalk/shared';
import type { IngestionJob } from '@chalk/shared';
import { processIngestion } from './processors/ingest.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('🖍️  Chalk ingestion worker starting...');
console.log(`   Queue: ${INGESTION_QUEUE_NAME}`);
console.log(`   Redis: ${REDIS_URL}`);

const workerConcurrency = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

const worker = new Worker<IngestionJob>(
  INGESTION_QUEUE_NAME,
  async (job) => {
    console.log(`[Worker] Processing job ${job.id}: ${job.data.filename}`);
    await processIngestion(job);
    console.log(`[Worker] Completed job ${job.id}: ${job.data.filename}`);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: workerConcurrency, 
    limiter: {
      max: workerConcurrency * 3, // dynamically scale rate limiter with concurrency
      duration: 60000, 
    },
  },
);

worker.on('completed', (job) => {
  console.log(`[Worker] ✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] ❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Error:', err);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('🖍️  Chalk ingestion worker ready and listening for jobs');
