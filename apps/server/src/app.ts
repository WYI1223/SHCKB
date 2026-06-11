import { Hono } from 'hono';
import pkg from '../package.json';
import type { Auth } from './auth';
import type { Db } from './db/client';
import { createPep } from './pep';
import { notepageRoutes } from './routes/notepages';

export type AppMeta = {
  version: string;
  schemaVersion: number;
};

const DEFAULT_META: AppMeta = {
  version: process.env.SHCKB_VERSION ?? pkg.version,
  schemaVersion: -1,
};

export function createApp(db: Db, auth: Auth, meta: AppMeta = DEFAULT_META) {
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

  return app;
}
