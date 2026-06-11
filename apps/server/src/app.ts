import { Hono } from 'hono';
import pkg from '../package.json';
import type { Db } from './db/client';
import { pep } from './pep';
import { notepageRoutes } from './routes/notepages';

export type AppMeta = {
  version: string;
  schemaVersion: number;
};

const DEFAULT_META: AppMeta = {
  version: process.env.SHCKB_VERSION ?? pkg.version,
  schemaVersion: -1,
};

export function createApp(db: Db, meta: AppMeta = DEFAULT_META) {
  const app = new Hono();

  app.use('/api/*', pep);

  app.get('/api/health', (c) =>
    c.json({ ok: true, version: meta.version, schemaVersion: meta.schemaVersion }),
  );
  app.get('/api/me', (c) => c.json({ user: c.get('user') }));

  app.route('/api', notepageRoutes(db));

  return app;
}
