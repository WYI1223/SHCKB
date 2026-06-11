/**
 * Full-restore importer [ADR-0023]: empty instance only, atomic (the
 * DB transaction is all-or-nothing; blob files are content-addressed
 * and idempotent, so pre-transaction blob writes are harmless — GC
 * sweeps orphans if the transaction fails). publishedHtml is re-
 * rendered here, never read from the bundle.
 */
import { createHash } from 'node:crypto';
import { TOTAL_COLS, validateState } from '@skb/grid-engine';
import type { BlobStore } from '../blobstore';
import type { Db } from '../db/client';
import { blobs, blocks, folders, notepages, type PublishedDoc } from '../db/schema';
import { DEFAULT_THEME_ID, THEMES } from '@skb/theme';
import { renderStaticPage } from '../render/publish-html';
import { settings as settingsTable } from '../db/schema';
import { FORMAT_VERSION, type ExportManifest, type ExportPage } from './format';
import { upgradeToVersion, type JsonFiles } from './migrate-format';

export type ImportInput = {
  files: Map<string, string>; // path → JSON text
  blobs: Map<string, Uint8Array>; // hash → bytes
};

export type ImportResult =
  | { ok: true; counts: { folders: number; pages: number; blocks: number; blobs: number } }
  | { ok: false; status: number; error: string; details?: string[] };

function fail(status: number, error: string, details?: string[]): ImportResult {
  return { ok: false, status, error, details };
}

function parsePage(path: string, value: unknown, errors: string[]): ExportPage | null {
  const e = (msg: string) => {
    errors.push(`${path}: ${msg}`);
    return null;
  };
  if (typeof value !== 'object' || value === null) return e('not an object');
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id === '') return e('missing id');
  if (typeof p.slug !== 'string' || p.slug === '') return e('missing slug');
  if (typeof p.title !== 'string') return e('missing title');
  if (p.visibility !== 'private' && p.visibility !== 'public') return e('visibility must be private|public');
  if (typeof p.gravityEnabled !== 'boolean') return e('missing gravityEnabled');
  if (p.themeId !== null && typeof p.themeId !== 'string') return e('themeId must be a string or null');
  if (typeof p.sortKey !== 'number') return e('missing sortKey');
  if (typeof p.createdAt !== 'number' || typeof p.updatedAt !== 'number') return e('missing timestamps');
  if (p.published !== null) {
    const d = p.published as Record<string, unknown> | null;
    if (
      typeof d !== 'object' ||
      d === null ||
      typeof d.title !== 'string' ||
      !Array.isArray(d.blocks) ||
      typeof d.publishedAt !== 'number'
    ) {
      return e('malformed published snapshot');
    }
  }
  if (!Array.isArray(p.blocks)) return e('missing blocks array');
  for (const raw of p.blocks) {
    const b = raw as Record<string, unknown> | null;
    if (
      typeof b !== 'object' ||
      b === null ||
      typeof b.id !== 'string' ||
      typeof b.kind !== 'string' ||
      typeof b.col !== 'number' ||
      typeof b.row !== 'number' ||
      typeof b.colSpan !== 'number' ||
      typeof b.rowSpan !== 'number' ||
      !('content' in b)
    ) {
      return e('malformed block');
    }
  }
  return value as ExportPage;
}

export function importBundle(db: Db, blobStore: BlobStore, input: ImportInput): ImportResult {
  // gate 1: empty instance (auth/users untouched by design — not part of the bundle)
  const havePages = db.select({ id: notepages.id }).from(notepages).limit(1).all();
  const haveFolders = db.select({ id: folders.id }).from(folders).limit(1).all();
  if (havePages.length > 0 || haveFolders.length > 0) return fail(409, 'instance is not empty');

  // gate 2: manifest + format version
  if (!input.files.has('manifest.json')) return fail(400, 'manifest.json missing');
  let parsed: JsonFiles;
  try {
    parsed = new Map([...input.files].map(([p, text]) => [p, JSON.parse(text) as unknown]));
  } catch (err) {
    return fail(400, `bundle contains invalid JSON: ${(err as Error).message}`);
  }
  const rawVersion = (parsed.get('manifest.json') as { formatVersion?: unknown }).formatVersion;
  if (typeof rawVersion !== 'number') return fail(400, 'manifest.json has no numeric formatVersion');
  if (rawVersion > FORMAT_VERSION) {
    return fail(
      409,
      `export format v${rawVersion} is newer than this build (supports ≤ v${FORMAT_VERSION}); ` +
        'use export-side downgrade on the newer instance instead',
    );
  }
  let files: JsonFiles;
  try {
    files = upgradeToVersion(parsed, FORMAT_VERSION);
  } catch (err) {
    return fail(422, `format migration failed: ${(err as Error).message}`);
  }
  const manifest = files.get('manifest.json') as ExportManifest;
  if (!Array.isArray(manifest.blobs)) return fail(400, 'manifest.json has no blobs list');
  if (typeof manifest.settings?.theme !== 'string') return fail(400, 'manifest.json has no settings.theme');

  // gate 3: structural + per-page validation (everything before any write)
  const errors: string[] = [];
  type FolderEntry = { id: string; name: string; sortKey: number; createdAt: number; parentDir: string };
  const foldersByDir = new Map<string, FolderEntry>(); // dir path under tree/ → meta
  const pages: Array<{ path: string; page: ExportPage; dir: string }> = [];

  for (const [path, value] of files) {
    if (path === 'manifest.json') continue;
    if (!path.startsWith('tree/')) {
      errors.push(`${path}: unexpected file outside tree/`);
      continue;
    }
    const rel = path.slice('tree/'.length);
    if (path.endsWith('/folder.json')) {
      const dir = rel.slice(0, -'/folder.json'.length);
      const m = value as Record<string, unknown>;
      if (typeof m.id !== 'string' || typeof m.name !== 'string' || typeof m.sortKey !== 'number' || typeof m.createdAt !== 'number') {
        errors.push(`${path}: malformed folder.json`);
        continue;
      }
      const parentDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
      foldersByDir.set(dir, { id: m.id, name: m.name, sortKey: m.sortKey, createdAt: m.createdAt, parentDir });
    } else if (path.endsWith('.page.json')) {
      const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      const page = parsePage(path, value, errors);
      if (page) pages.push({ path, page, dir });
    } else {
      errors.push(`${path}: unrecognized file`);
    }
  }
  for (const [dir, f] of foldersByDir) {
    if (f.parentDir !== '' && !foldersByDir.has(f.parentDir)) {
      errors.push(`tree/${dir}/folder.json: parent directory has no folder.json`);
    }
  }
  for (const { dir } of pages) {
    if (dir !== '' && !foldersByDir.has(dir)) errors.push(`tree/${dir}: pages present but folder.json missing`);
  }
  const slugs = new Set<string>();
  const ids = new Set<string>();
  for (const { path, page } of pages) {
    if (slugs.has(page.slug)) errors.push(`${path}: duplicate slug "${page.slug}"`);
    if (ids.has(page.id)) errors.push(`${path}: duplicate page id "${page.id}"`);
    slugs.add(page.slug);
    ids.add(page.id);
    const v = validateState(
      { totalCols: TOTAL_COLS, blocks: page.blocks.map(({ content: _c, ...geom }) => geom) },
      { gravity: page.gravityEnabled },
    );
    if (!v.ok) errors.push(`${path}: layout invariant violation — ${v.errors.join('; ')}`);
  }
  // blob integrity: every manifest blob must arrive with matching content
  for (const m of manifest.blobs) {
    const bytes = input.blobs.get(m.hash);
    if (bytes === undefined) {
      errors.push(`blobs/${m.hash}: listed in manifest but missing from bundle`);
      continue;
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== m.hash) errors.push(`blobs/${m.hash}: hash mismatch (content hashes to ${actual})`);
  }
  if (errors.length > 0) return fail(422, 'bundle validation failed', errors);

  // writes: blobs first (content-addressed + idempotent; orphans on a
  // later transaction failure are reclaimed by GC), then one DB txn.
  for (const m of manifest.blobs) blobStore.save(input.blobs.get(m.hash)!);

  // effective theme during import: pin → bundle's instance theme →
  // default; unknown ids degrade (data is preserved, rendering degrades)
  const instanceTheme = THEMES[manifest.settings.theme] ?? THEMES[DEFAULT_THEME_ID]!;
  const themeFor = (themeId: string | null) => (themeId !== null ? (THEMES[themeId] ?? instanceTheme) : instanceTheme);

  const sortedFolderDirs = [...foldersByDir.keys()].sort((a, b) => a.split('/').length - b.split('/').length);
  db.transaction((tx) => {
    tx.insert(settingsTable)
      .values({ key: 'theme', value: manifest.settings.theme })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: manifest.settings.theme } })
      .run();
    for (const m of manifest.blobs) {
      tx.insert(blobs)
        .values({ hash: m.hash, mimeType: m.mimeType, size: m.size, createdAt: new Date(m.createdAt) })
        .onConflictDoNothing()
        .run();
    }
    for (const dir of sortedFolderDirs) {
      const f = foldersByDir.get(dir)!;
      const parent = f.parentDir === '' ? null : foldersByDir.get(f.parentDir)!.id;
      tx.insert(folders)
        .values({ id: f.id, name: f.name, parentId: parent, sortKey: f.sortKey, createdAt: new Date(f.createdAt) })
        .run();
    }
    for (const { page, dir } of pages) {
      const folderId = dir === '' ? null : foldersByDir.get(dir)!.id;
      const published = page.published as PublishedDoc | null;
      tx.insert(notepages)
        .values({
          id: page.id,
          slug: page.slug,
          title: page.title,
          visibility: page.visibility,
          gravityEnabled: page.gravityEnabled,
          themeId: page.themeId,
          folderId,
          sortKey: page.sortKey,
          publishedDoc: published === null ? null : JSON.stringify(published),
          publishedHtml: published === null ? null : renderStaticPage(published, page.slug, themeFor(page.themeId)),
          createdAt: new Date(page.createdAt),
          updatedAt: new Date(page.updatedAt),
        })
        .run();
      for (const b of page.blocks) {
        tx.insert(blocks)
          .values({
            id: b.id,
            notepageId: page.id,
            kind: b.kind,
            col: b.col,
            row: b.row,
            colSpan: b.colSpan,
            rowSpan: b.rowSpan,
            content: JSON.stringify(b.content ?? null),
          })
          .run();
      }
    }
  });

  return {
    ok: true,
    counts: {
      folders: foldersByDir.size,
      pages: pages.length,
      blocks: pages.reduce((n, p) => n + p.page.blocks.length, 0),
      blobs: manifest.blobs.length,
    },
  };
}
