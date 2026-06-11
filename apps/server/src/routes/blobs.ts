/**
 * Blob API (mvp2 M2-D3).
 *
 * Upload is authenticated (author surface); reads are public and
 * immutable-cacheable. A blob URL is a capability URL: content-hash
 * ids are not enumerable, but anyone holding the URL can fetch the
 * bytes — acceptable MVP trade-off, recorded in the scope record.
 *
 * SVG is excluded from the allowlist: navigating directly to a served
 * SVG would execute scripts on our origin.
 */
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { BlobStore } from '../blobstore';
import type { Db } from '../db/client';
import { blobs } from '../db/schema';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);

export function blobRoutes(db: Db, store: BlobStore) {
  const r = new Hono();

  r.post('/blobs', async (c) => {
    const mime = c.req.header('content-type')?.split(';')[0]?.trim() ?? '';
    if (!ALLOWED_MIME.has(mime)) {
      return c.json({ error: `unsupported content-type "${mime}"` }, 415);
    }
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.byteLength === 0) return c.json({ error: 'empty body' }, 400);
    if (bytes.byteLength > MAX_BYTES) {
      return c.json({ error: `blob exceeds ${MAX_BYTES} bytes` }, 413);
    }

    const { hash, size } = store.save(bytes);
    db.insert(blobs)
      .values({ hash, mimeType: mime, size, createdAt: new Date() })
      .onConflictDoNothing()
      .run();
    return c.json({ hash, size, mimeType: mime }, 201);
  });

  // Public read: content-addressed → immutable caching is safe.
  r.get('/public/blobs/:hash', (c) => {
    const hash = c.req.param('hash');
    const row = db.select().from(blobs).where(eq(blobs.hash, hash)).get();
    const path = row ? store.path(hash) : null;
    if (!row || !path) return c.json({ error: 'not found' }, 404);
    return new Response(Bun.file(path), {
      headers: {
        'content-type': row.mimeType,
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  });

  return r;
}
