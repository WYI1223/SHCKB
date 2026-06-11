import { Hono } from 'hono';
import type { Db } from './db/client';
import { pep } from './pep';
import { notepageRoutes } from './routes/notepages';

export function createApp(db: Db) {
  const app = new Hono();

  app.use('/api/*', pep);

  app.get('/api/health', (c) => c.json({ ok: true }));
  app.get('/api/me', (c) => c.json({ user: c.get('user') }));

  app.route('/api', notepageRoutes(db));

  return app;
}
