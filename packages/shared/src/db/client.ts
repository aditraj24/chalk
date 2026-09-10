import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let readPool: pg.Pool | null = null;

/**
 * Get or create a singleton Postgres connection pool for Writes/Primary.
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      max: 10,
    });
    pool.on('error', (err) => {
      console.warn('[DB Pool] Warning on idle client:', err.message);
    });
  }
  return pool;
}

/**
 * Get or create a singleton Postgres connection pool for Reads/Replica.
 * Falls back to primary if DATABASE_READ_URL is not set.
 */
export function getReadPool(): pg.Pool {
  if (!readPool) {
    const connectionString = process.env.DATABASE_READ_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    readPool = new Pool({
      connectionString,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      max: 10,
    });
    readPool.on('error', (err) => {
      console.warn('[DB ReadPool] Warning on idle client:', err.message);
    });
  }
  return readPool;
}

/**
 * Get a Drizzle ORM instance connected to Postgres (Primary).
 */
export function getDb() {
  return drizzle(getPool(), { schema });
}

/**
 * Get a Drizzle ORM instance connected to Postgres (Replica).
 */
export function getReadDb() {
  return drizzle(getReadPool(), { schema });
}

export type Database = ReturnType<typeof getDb>;

/**
 * Close the connection pool gracefully.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
