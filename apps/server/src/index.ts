import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import pkg from '../package.json';
import { createApp } from './app';
import { ensureFirstAdmin } from './bootstrap';
import { createAuth } from './auth';
import { BlobStore } from './blobstore';
import { createDb } from './db/client';

const dbPath = resolve(process.env.SHCKB_DB_PATH ?? './data/shckb.db');
mkdirSync(dirname(dbPath), { recursive: true });
const blobDir = resolve(process.env.SHCKB_BLOB_DIR ?? join(dirname(dbPath), 'blobs'));

const secret = process.env.SHCKB_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    'SHCKB_AUTH_SECRET must be set (>= 32 chars). Generate one with: openssl rand -base64 32',
  );
}

const { db, schemaVersion } = createDb(dbPath);
const auth = createAuth(db, { secret, baseURL: process.env.SHCKB_BASE_URL });

await ensureFirstAdmin(db, {
  adminEmail: process.env.SHCKB_ADMIN_EMAIL,
  adminPassword: process.env.SHCKB_ADMIN_PASSWORD,
  secret,
});

const version = process.env.SHCKB_VERSION ?? pkg.version;
const app = createApp({
  db,
  auth,
  blobStore: new BlobStore(blobDir),
  meta: { version, schemaVersion },
});
const port = Number(process.env.PORT ?? 3000);

// Compose path: serve the built web app when present (single artifact
// shape); dev inner loop uses the Vite dev server instead.
const webDist = process.env.SHCKB_WEB_DIST;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/notes/')) {
      return app.fetch(req);
    }
    if (webDist) {
      const file = Bun.file(
        url.pathname === '/' || !url.pathname.includes('.')
          ? `${webDist}/index.html` // SPA fallback
          : `${webDist}${url.pathname}`,
      );
      if (await file.exists()) return new Response(file);
      return new Response(Bun.file(`${webDist}/index.html`));
    }
    return app.fetch(req);
  },
});

console.log(`shckb server v${version} (schema ${schemaVersion}) listening on :${port} (db: ${dbPath})`);
