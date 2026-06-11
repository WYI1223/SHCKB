/**
 * Admin-only surface (MVP-3): logical export/import + blob GC. The
 * role gate lives here (PEP authenticates; this is the first
 * role-differentiated authorization point).
 */
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { eq } from 'drizzle-orm';
import type { BlobStore } from '../blobstore';
import type { Db } from '../db/client';
import { blobs } from '../db/schema';
import { referencedBlobHashes } from '../export/blob-refs';
import { buildExport } from '../export/exporter';
import { FORMAT_VERSION, canonicalJson } from '../export/format';
import { downgradeToVersion } from '../export/migrate-format';
import { importBundle, type ImportInput } from '../export/importer';
import { instanceThemeId, rerenderAllPublished, setSetting } from '../settings';
import { THEMES } from '@skb/theme';

const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') return c.json({ error: 'admin role required' }, 403);
  await next();
};

export function adminRoutes(db: Db, blobStore: BlobStore, meta: { version: string; schemaVersion: number }) {
  const r = new Hono();
  r.use('/admin/*', requireAdmin);

  // Instance settings: any authenticated user may read; only admin
  // writes (theme switch re-renders every published page [ADR-0024]).
  r.get('/settings', (c) => c.json({ theme: instanceThemeId(db) }));
  r.put('/settings/theme', requireAdmin, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { theme?: unknown };
    if (typeof body.theme !== 'string' || !(body.theme in THEMES)) {
      return c.json({ error: `unknown theme; available: ${Object.keys(THEMES).join(', ')}` }, 400);
    }
    setSetting(db, 'theme', body.theme);
    const rerendered = rerenderAllPublished(db);
    return c.json({ ok: true, rerendered });
  });

  r.get('/admin/export', (c) => {
    const formatParam = c.req.query('format');
    const target = formatParam === undefined ? FORMAT_VERSION : Number(formatParam);
    if (!Number.isInteger(target) || target < 1 || target > FORMAT_VERSION) {
      return c.json(
        { error: `unsupported format v${formatParam}; this build exports v1..v${FORMAT_VERSION} [ADR-0023]` },
        400,
      );
    }
    const bundle = buildExport(db, blobStore, {
      appVersion: meta.version,
      schemaVersion: meta.schemaVersion,
      exportedAt: Date.now(),
    });

    // export-side downgrade [ADR-0023]: the newer build produces the
    // older format; losses are explicit, never silent.
    let files = bundle.files;
    let losses: string[] = [];
    if (target < FORMAT_VERSION) {
      const parsed = new Map([...bundle.files].map(([p, text]) => [p, JSON.parse(text) as unknown]));
      const down = downgradeToVersion(parsed, target);
      losses = down.losses;
      files = new Map([...down.files].map(([p, v]) => [p, canonicalJson(v)]));
    }
    if (c.req.query('dryRun') !== undefined) {
      return c.json({ formatVersion: target, losses });
    }

    // fixed mtime (DOS epoch — zip cannot express earlier): zip bytes
    // stay deterministic modulo manifest.exportedAt
    const DOS_EPOCH = new Date('1980-01-01T00:00:00Z');
    const entries: Zippable = {};
    for (const [path, text] of files) entries[path] = [strToU8(text), { mtime: DOS_EPOCH }];
    for (const [hash, bytes] of bundle.blobs) entries[`blobs/${hash}`] = [bytes, { mtime: DOS_EPOCH }];
    return c.body(zipSync(entries), 200, {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="shckb-export.zip"',
      'x-downgrade-loss-count': String(losses.length),
    });
  });

  r.post('/admin/import', async (c) => {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await c.req.arrayBuffer()));
    } catch {
      return c.json({ error: 'body is not a valid zip archive' }, 400);
    }
    const input: ImportInput = { files: new Map(), blobs: new Map() };
    for (const [path, bytes] of Object.entries(entries)) {
      if (path.endsWith('/')) continue; // directory entries
      if (path.startsWith('blobs/')) input.blobs.set(path.slice('blobs/'.length), bytes);
      else input.files.set(path, strFromU8(bytes));
    }
    const result = importBundle(db, blobStore, input);
    if (!result.ok) return c.json({ error: result.error, details: result.details }, result.status as 400 | 409 | 422);
    return c.json({ ok: true, counts: result.counts });
  });

  r.post('/admin/blobs/gc', (c) => {
    const referenced = referencedBlobHashes(db);
    let deleted = 0;
    let freedBytes = 0;
    for (const row of db.select().from(blobs).all()) {
      if (referenced.has(row.hash)) continue;
      db.delete(blobs).where(eq(blobs.hash, row.hash)).run();
      blobStore.delete(row.hash);
      deleted++;
      freedBytes += row.size;
    }
    // orphan files with no table row (e.g. failed import leftovers)
    const registered = new Set(db.select({ hash: blobs.hash }).from(blobs).all().map((b) => b.hash));
    for (const hash of blobStore.list()) {
      if (registered.has(hash) || referenced.has(hash)) continue;
      blobStore.delete(hash);
      deleted++;
    }
    return c.json({ deleted, freedBytes });
  });

  return r;
}
