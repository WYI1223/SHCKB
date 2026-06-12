/**
 * Deterministic export bundle builder [ADR-0023]. Pure read of DB +
 * blob store → in-memory file map; zipping is the route's concern.
 * Iteration orders are pinned (sortKey, then id; lexicographic in the
 * manifest) so identical instances always serialize identically.
 */
import type { BlobStore } from '../blobstore';
import type { Db } from '../db/client';
import { blobs, blocks, folders, notepages, type PublishedDoc } from '../db/schema';
import { safeParse } from '../json';
import { instanceThemeId, themeCustomizations } from '../settings';
import { referencedBlobHashes } from './blob-refs';
import {
  FORMAT_VERSION,
  canonicalJson,
  sanitizeDirName,
  type ExportFolderMeta,
  type ExportManifest,
  type ExportPage,
} from './format';

export type ExportBundle = {
  files: Map<string, string>; // path → canonical JSON text
  blobs: Map<string, Uint8Array>; // hash → bytes
};

type FolderRow = typeof folders.$inferSelect;

/** folder id → directory path under tree/ (no prefix). Sibling name
 * collisions (post-sanitize, case-insensitive for Windows/macOS) get
 * deterministic ~2, ~3… suffixes in (sortKey, id) order. */
export function computeFolderPaths(rows: FolderRow[]): Map<string, string> {
  const byParent = new Map<string | null, FolderRow[]>();
  for (const f of rows) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  const paths = new Map<string, string>();
  const walk = (parentId: string | null, prefix: string) => {
    const siblings = (byParent.get(parentId) ?? []).sort(
      (a, b) => a.sortKey - b.sortKey || a.id.localeCompare(b.id),
    );
    const used = new Set<string>();
    for (const f of siblings) {
      const base = sanitizeDirName(f.name);
      let dir = base;
      for (let n = 2; used.has(dir.toLowerCase()); n++) dir = `${base}~${n}`;
      used.add(dir.toLowerCase());
      const full = prefix === '' ? dir : `${prefix}/${dir}`;
      paths.set(f.id, full);
      walk(f.id, full);
    }
  };
  walk(null, '');
  return paths;
}

export function buildExport(
  db: Db,
  blobStore: BlobStore,
  opts: { appVersion: string; schemaVersion: number; exportedAt: number },
): ExportBundle {
  const folderRows = db.select().from(folders).all();
  const pageRows = db.select().from(notepages).all();
  const blockRows = db.select().from(blocks).all();
  const blobRows = db.select().from(blobs).all();

  const files = new Map<string, string>();
  const folderPaths = computeFolderPaths(folderRows);

  for (const f of folderRows) {
    const meta: ExportFolderMeta = {
      id: f.id,
      name: f.name,
      sortKey: f.sortKey,
      createdAt: f.createdAt.getTime(),
    };
    files.set(`tree/${folderPaths.get(f.id)!}/folder.json`, canonicalJson(meta));
  }

  const blocksByPage = new Map<string, typeof blockRows>();
  for (const b of blockRows) {
    const list = blocksByPage.get(b.notepageId) ?? [];
    list.push(b);
    blocksByPage.set(b.notepageId, list);
  }

  const pagePaths: string[] = [];
  const sortedPages = [...pageRows].sort((a, b) => a.sortKey - b.sortKey || a.id.localeCompare(b.id));
  for (const p of sortedPages) {
    const dir = p.folderId === null ? '' : `${folderPaths.get(p.folderId)!}/`;
    const path = `tree/${dir}${p.slug}.page.json`;
    const page: ExportPage = {
      id: p.id,
      slug: p.slug,
      title: p.title,
      visibility: p.visibility,
      gravityEnabled: p.gravityEnabled,
      themeId: p.themeId,
      background: p.background === null ? null : safeParse<ExportPage['background']>(p.background, null),
      sortKey: p.sortKey,
      createdAt: p.createdAt.getTime(),
      updatedAt: p.updatedAt.getTime(),
      // corrupt stored JSON exports as null/absent rather than failing
      // the whole backup — one bad row must not make an instance
      // un-exportable (the data was already unreadable)
      published: p.publishedDoc === null ? null : safeParse<PublishedDoc | null>(p.publishedDoc, null),
      blocks: (blocksByPage.get(p.id) ?? [])
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((b) => ({
          id: b.id,
          kind: b.kind,
          col: b.col,
          row: b.row,
          colSpan: b.colSpan,
          rowSpan: b.rowSpan,
          shell: b.shell,
          content: safeParse<unknown>(b.content, null),
        })),
    };
    files.set(path, canonicalJson(page));
    pagePaths.push(path);
  }

  // referenced ∩ blobs table: the scan may over-collect hash-like
  // strings; only registered blobs are real. Missing files fail loudly.
  const referenced = referencedBlobHashes(db);
  const blobOut = new Map<string, Uint8Array>();
  const manifestBlobs: ExportManifest['blobs'] = [];
  for (const row of [...blobRows].sort((a, b) => a.hash.localeCompare(b.hash))) {
    if (!referenced.has(row.hash)) continue;
    const bytes = blobStore.read(row.hash);
    if (bytes === null) throw new Error(`blob ${row.hash} is registered and referenced but missing on disk`);
    blobOut.set(row.hash, bytes);
    manifestBlobs.push({ hash: row.hash, mimeType: row.mimeType, size: row.size, createdAt: row.createdAt.getTime() });
  }

  const manifest: ExportManifest = {
    formatVersion: FORMAT_VERSION,
    schemaVersion: opts.schemaVersion,
    appVersion: opts.appVersion,
    exportedAt: opts.exportedAt,
    counts: { folders: folderRows.length, pages: pageRows.length, blocks: blockRows.length, blobs: blobOut.size },
    settings: (() => {
      // themeId keys sorted: settings storage order must not leak into
      // the canonical bytes (determinism invariant).
      const custom = themeCustomizations(db);
      const keys = Object.keys(custom).sort();
      return keys.length === 0
        ? { theme: instanceThemeId(db) }
        : {
            theme: instanceThemeId(db),
            themeCustomization: Object.fromEntries(keys.map((k) => [k, custom[k]!])),
          };
    })(),
    pages: [...pagePaths].sort(),
    blobs: manifestBlobs,
  };
  files.set('manifest.json', canonicalJson(manifest));

  return { files, blobs: blobOut };
}
