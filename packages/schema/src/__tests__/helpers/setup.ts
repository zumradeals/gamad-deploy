// Helpers partagés entre les tests d'intégration de P-01.
// Nécessite DATABASE_URL ou la base gamad_test locale.

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

export const TEST_DB_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://gamad:gamad@localhost:5432/gamad_test';

export async function createTestPool(): Promise<Pool> {
  const pool = new Pool({ connectionString: TEST_DB_URL });
  return pool;
}

export async function applyMigrations(pool: Pool): Promise<void> {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

export function createDb(pool: Pool) {
  return drizzle(pool);
}
