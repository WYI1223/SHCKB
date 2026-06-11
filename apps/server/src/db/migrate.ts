/**
 * Minimal migration applier per [ADR-0020].
 *
 * drizzle-kit generates the SQL files (the hard part: schema diff);
 * this applier owns application semantics that the built-in migrator
 * keeps internal: baseline stamping for pre-migration DBs, refuse-to-
 * start guards (DB newer than app / tampered history), and a journal
 * we fully control.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from 'bun:sqlite';

const JOURNAL_DDL = `
CREATE TABLE IF NOT EXISTS skb_migrations (
  filename TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
`;

/** Marker table proving this is a pre-migration (MVP-1 bootstrap) database. */
const BASELINE_MARKER_TABLE = 'notepages';
/** The migration whose schema equals the MVP-1 bootstrap DDL. */
const BASELINE_MIGRATION = '0000_init.sql';

export type MigrationResult = {
  /** Number of migrations executed in this run (baseline stamps excluded). */
  executed: number;
  /** Highest applied migration index, -1 if none. */
  schemaVersion: number;
};

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function tableExists(db: Database, name: string): boolean {
  const row = db
    .query<{ n: number }, [string]>(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name);
  return (row?.n ?? 0) > 0;
}

export function applyMigrations(db: Database, dir: string): MigrationResult {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const hadJournal = tableExists(db, 'skb_migrations');
  db.exec(JOURNAL_DDL);

  // Baseline stamping: an MVP-1 bootstrap DB has business tables but no
  // journal — record the baseline migration as applied without running it.
  if (!hadJournal && tableExists(db, BASELINE_MARKER_TABLE) && files.includes(BASELINE_MIGRATION)) {
    const sql = readFileSync(join(dir, BASELINE_MIGRATION), 'utf8');
    db.query(`INSERT INTO skb_migrations (filename, hash, applied_at) VALUES (?, ?, ?)`).run(
      BASELINE_MIGRATION,
      sha256(sql),
      Date.now(),
    );
  }

  const applied = new Map<string, string>(
    db
      .query<{ filename: string; hash: string }, []>(`SELECT filename, hash FROM skb_migrations`)
      .all()
      .map((r) => [r.filename, r.hash]),
  );

  // Guard: DB knows migrations this build does not ship → DB is newer
  // than the app (downgrade). Refuse to run rather than risk data.
  for (const filename of applied.keys()) {
    if (!files.includes(filename)) {
      throw new Error(
        `database is newer than this build: applied migration "${filename}" is unknown here. ` +
          `Upgrade the app image instead of downgrading.`,
      );
    }
  }

  let executed = 0;
  for (const filename of files) {
    const sql = readFileSync(join(dir, filename), 'utf8');
    const hash = sha256(sql);
    const appliedHash = applied.get(filename);
    if (appliedHash !== undefined) {
      // Guard: shipped migration content differs from what was applied.
      if (appliedHash !== hash) {
        throw new Error(
          `migration history mismatch: "${filename}" content differs from the applied version. ` +
            `Restore from backup or investigate before starting.`,
        );
      }
      continue;
    }
    // Execute atomically: half-applied schema must never persist.
    db.exec('BEGIN');
    try {
      for (const stmt of sql.split('--> statement-breakpoint')) {
        const trimmed = stmt.trim();
        if (trimmed !== '') db.exec(trimmed);
      }
      db.query(`INSERT INTO skb_migrations (filename, hash, applied_at) VALUES (?, ?, ?)`).run(
        filename,
        hash,
        Date.now(),
      );
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`migration "${filename}" failed (rolled back): ${String(e)}`);
    }
    executed++;
  }

  const last = files.at(-1);
  return {
    executed,
    schemaVersion: last ? Number.parseInt(last.slice(0, 4), 10) : -1,
  };
}
