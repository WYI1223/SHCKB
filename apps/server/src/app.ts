import { Hono } from 'hono';
import type { Auth } from './auth';
import type { BlobStore } from './blobstore';
import type { Db } from './db/client';
import { createPep } from './pep';
import { blobRoutes } from './routes/blobs';
import { notepageRoutes, publicHtmlRoutes } from './routes/notepages';

export type AppDeps = {
  db: Db;
  auth: Auth;
  blobStore: BlobStore;
  meta: {
    version: string;
    schemaVersion: number;
  };
};

export function createApp({ db, auth, blobStore, meta }: AppDeps) {
  const app = new Hono();

  app.use('/api/*', createPep(auth));

  // better-auth wire surface (sign-in/sign-out/session); signup is
  // disabled on this instance (bootstrap.ts owns first-admin creation).
  app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  app.get('/api/health', (c) =>
    c.json({ ok: true, version: meta.version, schemaVersion: meta.schemaVersion }),
  );
  app.get('/api/me', (c) => c.json({ user: c.get('user') }));

  app.route('/api', notepageRoutes(db));
  app.route('/api', blobRoutes(db, blobStore));

  // Canonical public read route: static HTML rendered at publish time.
  // Outside /api → no PEP; anonymous by design.
  app.route('/', publicHtmlRoutes(db));

  return app;
}
