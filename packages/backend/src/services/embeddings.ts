import { EMBEDDING_DIMENSION } from '@chalk/shared';

/**
 * Embedding service using @xenova/transformers (ONNX runtime).
 * Runs BGE-M3 locally in Node.js — no external API, zero cost.
 *
 * NOTE: The model is loaded lazily on first call and cached.
 * First call will take a few seconds to download and load the model.
 */

// Dynamic import for @xenova/transformers (ESM-only)
let pipeline: any = null;
let extractor: any = null;

async function getExtractor() {
  if (extractor) return extractor;

  // Dynamically import to avoid top-level await issues
  const { pipeline: transformersPipeline } = await import('@xenova/transformers');
  extractor = await transformersPipeline('feature-extraction', 'Xenova/bge-m3', {
    quantized: true, // Use quantized model for faster CPU inference
  });

  return extractor;
}

/**
 * Embed a single text string into a vector.
 * Returns a float32 array of dimension 1024.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: 'cls', normalize: true });
  const embedding = Array.from(output.data as Float32Array).slice(0, EMBEDDING_DIMENSION);
  return embedding;
}

/**
 * Batch embed multiple texts.
 * Processes sequentially to avoid OOM on CPU.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  const ext = await getExtractor();

  for (const text of texts) {
    const output = await ext(text, { pooling: 'cls', normalize: true });
    const embedding = Array.from(output.data as Float32Array).slice(0, EMBEDDING_DIMENSION);
    embeddings.push(embedding);
  }

  return embeddings;
}
