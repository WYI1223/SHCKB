import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, test } from 'bun:test';
import { applyMigrations } from '../src/db/migrate';
import { createDb } from '../src/db/client';

/** The retired MVP-1 bootstrap DDL — used to fabricate a pre-migration DB. */
const MVP1_DDL = `
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

const tempDirs: string[] = [];
function makeMigrationsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'skb-mig-'));
  tempDirs.push(dir);
  for (const [name, sql] of Object.entries(files)) {
    writeFileSync(join(dir, name), sql);
  }
  return dir;
}

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('migration applier (ADR-0020)', () => {
  test('fresh DB: applies real migrations, reports schemaVersion', () => {
    const { db, schemaVersion } = createDb(':memory:');
    expect(schemaVersion).toBeGreaterThanOrEqual(0);
    // tables exist and are usable
    expect(() => db.$client.query('SELECT * FROM notepages').all()).not.toThrow();
    expect(() => db.$client.query('SELECT * FROM blocks').all()).not.toThrow();
  });

  test('idempotent: second run executes nothing', () => {
    const dir = makeMigrationsDir({ '0000_init.sql': 'CREATE TABLE t1 (id TEXT);' });
    const db = new Database(':memory:');
    expect(applyMigrations(db, dir).executed).toBe(1);
    expect(applyMigrations(db, dir).executed).toBe(0);
  });

  test('baseline: MVP-1 bootstrap DB gets 0000 stamped without execution, later migrations run', () => {
    const db = new Database(':memory:');
    db.exec(MVP1_DDL); // pre-migration database with live data
    db.exec(`INSERT INTO notepages (id, slug, created_at, updated_at) VALUES ('p1', 's1', 1, 1)`);

    const dir = makeMigrationsDir({
      // re-running this against the existing DB would throw "table exists";
      // baseline stamping must skip execution
      '0000_init.sql': 'CREATE TABLE notepages (id TEXT PRIMARY KEY);',
      '0001_add_widgets.sql': 'CREATE TABLE widgets (id TEXT PRIMARY KEY);',
    });
    const result = applyMigrations(db, dir);
    expect(result.executed).toBe(1); // only 0001
    expect(result.schemaVersion).toBe(1);
    // existing data untouched, new table present
    expect(db.query(`SELECT COUNT(*) AS n FROM notepages`).get()).toEqual({ n: 1 });
    expect(() => db.query('SELECT * FROM widgets').all()).not.toThrow();
  });

  test('downgrade guard: journal knows a migration this build does not ship', () => {
    const dirNew = makeMigrationsDir({
      '0000_init.sql': 'CREATE TABLE a (id TEXT);',
      '0001_future.sql': 'CREATE TABLE b (id TEXT);',
    });
    const db = new Database(':memory:');
    applyMigrations(db, dirNew);
    const dirOld = makeMigrationsDir({ '0000_init.sql': 'CREATE TABLE a (id TEXT);' });
    expect(() => applyMigrations(db, dirOld)).toThrow(/newer than this build/);
  });

  test('tamper guard: applied migration content changed on disk', () => {
    const dir = makeMigrationsDir({ '0000_init.sql': 'CREATE TABLE a (id TEXT);' });
    const db = new Database(':memory:');
    applyMigrations(db, dir);
    writeFileSync(join(dir, '0000_init.sql'), 'CREATE TABLE a (id TEXT, evil TEXT);');
    expect(() => applyMigrations(db, dir)).toThrow(/history mismatch/);
  });

  test('failed migration rolls back atomically and aborts', () => {
    const dir = makeMigrationsDir({
      '0000_ok.sql': 'CREATE TABLE good (id TEXT);',
      '0001_bad.sql': 'CREATE TABLE half (id TEXT);--> statement-breakpoint\nTHIS IS NOT SQL;',
    });
    const db = new Database(':memory:');
    expect(() => applyMigrations(db, dir)).toThrow(/0001_bad\.sql.*failed/);
    // 0000 applied, 0001 fully rolled back (no half table, no journal row)
    expect(() => db.query('SELECT * FROM good').all()).not.toThrow();
    expect(() => db.query('SELECT * FROM half').all()).toThrow();
    expect(db.query(`SELECT COUNT(*) AS n FROM skb_migrations`).get()).toEqual({ n: 1 });
  });
});
