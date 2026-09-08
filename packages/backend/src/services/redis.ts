import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: Redis.Redis | null = null;

export function getRedisClient(): Redis.Redis {
  if (!redisClient) {
    redisClient = new Redis.default(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return redisClient;
}

export async function getCachedQuery(chatId: string, query: string, mode: string, perfMode: string) {
  const client = getRedisClient();
  const key = `cache:${chatId}:${mode}:${perfMode}:${Buffer.from(query).toString('base64')}`;
  const result = await client.get(key);
  if (result) {
    try {
      return JSON.parse(result);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function setCachedQuery(chatId: string, query: string, mode: string, perfMode: string, generation: string, chunkIds: string[]) {
  const client = getRedisClient();
  const key = `cache:${chatId}:${mode}:${perfMode}:${Buffer.from(query).toString('base64')}`;
  const data = JSON.stringify({ generation, chunkIds });
  // Cache for 1 hour
  await client.set(key, data, 'EX', 3600);
}
