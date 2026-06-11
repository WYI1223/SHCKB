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

  const signIn = await app.request('http://localhost/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    headers: { 'content-type': 'application/json' },
  });
  expect(signIn.status).toBe(200);
  const setCookie = signIn.headers.get('set-cookie');
  if (!setCookie) throw new Error('sign-in returned no session cookie');
  const cookie = setCookie
    .split(/,(?=\s*[^\s;=]+=)/)
    .map((c) => c.split(';')[0]!.trim())
    .join('; ');

  const authed = async (path: string, init?: RequestInit) =>
    app.request(`http://localhost${path}`, {
      ...init,
      headers: { cookie, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });

  return { db: handle.db, app, blobStore, cookie, authed };
}

export async function json(res: Response) {
  expect(res.headers.get('content-type')).toContain('application/json');
  return res.json() as Promise<any>;
}
