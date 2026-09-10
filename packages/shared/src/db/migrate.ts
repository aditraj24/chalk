import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, closeDb } from './client.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(customFolder?: string): Promise<void> {
  const candidatePaths = [
    customFolder,
    path.join(__dirname, 'migrations'),
    path.resolve(__dirname, '../../src/db/migrations'),
    '/app/packages/shared/src/db/migrations',
    '/app/packages/shared/dist/db/migrations',
  ].filter(Boolean) as string[];

  const migrationsFolder = candidatePaths.find(
    (p) => fs.existsSync(p) && fs.existsSync(path.join(p, 'meta', '_journal.json'))
  ) || candidatePaths[0];

  console.log(`📦 Running database migrations from ${migrationsFolder}...`);
  const db = getDb();
  await migrate(db, { migrationsFolder });
  console.log('✅ Database migrations completed successfully.');
}

// Allow direct execution via node
if (process.argv[1] === __filename) {
  runMigrations()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
