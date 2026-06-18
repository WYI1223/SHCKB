import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'bun:test';
import { createApp } from '../src/app';
import { ensureFirstAdmin } from '../src/bootstrap';
import { createAuth } from '../src/auth';
import { BlobStore } from '../src/blobstore';
import { createDb, type Db } from '../src/db/client';

export const TEST_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
export const ADMIN_EMAIL = 'admin@local.test';
export const ADMIN_PASSWORD = 'admin-password-1';

export type TestContext = {
  db: Db;
  app: ReturnType<typeof createApp>;
  blobStore: BlobStore;
  cookie: string;
  /** request with the admin session cookie attached */
  authed: (path: string, init?: RequestInit) => Promise<Response>;
};

export async function createTestContext(): Promise<TestContext> {
  const handle = createDb(':memory:');
  const auth = createAuth(handle.db, { secret: TEST_SECRET, baseURL: 'http://localhost' });
  await ensureFirstAdmin(handle.db, {
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    secret: TEST_SECRET,
  });
  const blobStore = new BlobStore(mkdtempSync(join(tmpdir(), 'skb-blobs-')));
  const app = createApp({
    db: handle.db,
    auth,
    blobStore,
    meta: { version: 'test', schemaVersion: handle.schemaVersion },
  });

  const cookie = await signIn(app, ADMIN_EMAIL, ADMIN_PASSWORD);

  const authed = async (path: string, init?: RequestInit) =>
    app.request(`http://localhost${path}`, {
      ...init,
      headers: { cookie, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });

  return { db: handle.db, app, blobStore, cookie, authed };
}

/** Sign in through the mounted wire surface; returns the session cookie. */
export async function signIn(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
): Promise<string> {
  const res = await app.request('http://localhost/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'content-type': 'application/json' },
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('sign-in returned no session cookie');
  return setCookie
    .split(/,(?=\s*[^\s;=]+=)/)
    .map((c) => c.split(';')[0]!.trim())
    .join('; ');
}

export async function json(res: Response) {
  expect(res.headers.get('content-type')).toContain('application/json');
  return res.json() as Promise<any>;
}

/** Create → publish → make public a single-markdown-block page; returns its id + slug.
 * Shared by the public-surface tests (no-materialize / public-by-id / public-tree-id). */
export async function createPublicPage(
  t: TestContext,
  opts: { title: string; body: string },
): Promise<{ id: string; slug: string }> {
  const { id } = await json(await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: opts.title }) }));
  await t.authed(`/api/notepages/${id}/working-state`, {
    method: 'PUT',
    body: JSON.stringify({
      title: opts.title,
      gravityEnabled: false,
      blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, shell: null, content: { markdown: opts.body } }],
    }),
  });
  await t.authed(`/api/notepages/${id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'graph-paper' }) });
  const { slug } = await json(await t.authed(`/api/notepages/${id}/publish`, { method: 'POST' }));
  await t.authed(`/api/notepages/${id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
  return { id, slug };
}
