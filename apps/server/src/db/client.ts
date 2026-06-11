/**
 * SQLite bootstrap. MVP uses idempotent DDL instead of migration
 * tooling (single-schema phase; revisit before any released upgrade
 * path per self-host-deploy setup-time PRD).
 */
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const DDL = `
CREATE TABLE IF NOT EXISTS notepages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  visibility TEXT NOT NULL DEFAULT 'private',
  gravity_enabled INTEGER NOT NULL DEFAULT 1,
  published_doc TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  notepage_id TEXT NOT NULL REFERENCES notepages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  col INTEGER NOT NULL,
  row INTEGER NOT NULL,
  col_span INTEGER NOT NULL,
  row_span INTEGER NOT NULL,
  content TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocks_notepage ON blocks(notepage_id);
`;

export type Db = ReturnType<typeof createDb>;

export function createDb(path: string) {
  const sqlite = new Database(path, { create: true });
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}
