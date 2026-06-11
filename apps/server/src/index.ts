import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createApp } from './app';
import { createDb } from './db/client';

const dbPath = resolve(process.env.SHCKB_DB_PATH ?? './data/shckb.db');
mkdirSync(dirname(dbPath), { recursive: true });

const { db, schemaVersion } = createDb(dbPath);
const version = process.env.SHCKB_VERSION ?? (await import('../package.json')).version;
const app = createApp(db, { version, schemaVersion });
const port = Number(process.env.PORT ?? 3000);

// Compose path: serve the built web app when present (single artifact
// shape); dev inner loop uses the Vite dev server instead.
const webDist = process.env.SHCKB_WEB_DIST;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
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

console.log(`shckb server listening on :${port} (db: ${dbPath})`);
