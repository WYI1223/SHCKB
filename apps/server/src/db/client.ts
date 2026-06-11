/**
 * SQLite bootstrap. Schema is owned by versioned migrations under
 * apps/server/drizzle/ ([ADR-0020]); the MVP-1 idempotent DDL is
 * retired — pre-migration databases get baseline-stamped by the
 * applier.
 */
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { applyMigrations } from './migrate';
import * as schema from './schema';

const MIGRATIONS_DIR = join(import.meta.dir, '../../drizzle');

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export type DbHandle = {
  db: Db;
  /** Highest applied migration index (operator-visible at /api/health). */
  schemaVersion: number;
};

export function createDb(path: string, migrationsDir: string = MIGRATIONS_DIR): DbHandle {
  const sqlite = new Database(path, { create: true });
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA journal_mode = WAL;');
  const { schemaVersion } = applyMigrations(sqlite, migrationsDir);
  return { db: drizzle(sqlite, { schema }), schemaVersion };
}
