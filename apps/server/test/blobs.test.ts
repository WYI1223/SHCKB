import { beforeEach, describe, expect, test } from 'bun:test';
import { createTestContext, json, type TestContext } from './helpers';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext();
});

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function upload(bytes: Uint8Array, mime = 'image/png'): Promise<Response> {
  return t.authed('/api/blobs', {
    method: 'POST',
    body: bytes,
    headers: { 'content-type': mime },
  });
}

describe('blob store (content-addressed, M2-D3)', () => {
  test('upload → public fetch roundtrip with immutable caching', async () => {
    const up = await json(await upload(PNG_BYTES));
    expect(up.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(up.size).toBe(PNG_BYTES.byteLength);

    const res = await t.app.request(`/api/public/blobs/${up.hash}`); // anonymous
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES);
  });

  test('same content deduplicates to the same hash', async () => {
    const a = await json(await upload(PNG_BYTES));
    const b = await json(await upload(PNG_BYTES));
    expect(a.hash).toBe(b.hash);
  });

  test('upload requires auth; disallowed mime and oversize rejected', async () => {
    const anon = await t.app.request('/api/blobs', {
      method: 'POST',
      body: PNG_BYTES,
      headers: { 'content-type': 'image/png' },
    });
    expect(anon.status).toBe(401);

    expect((await upload(PNG_BYTES, 'image/svg+xml')).status).toBe(415);
    expect((await upload(PNG_BYTES, 'application/octet-stream')).status).toBe(415);
    expect((await upload(new Uint8Array(0))).status).toBe(400);
    expect((await upload(new Uint8Array(10 * 1024 * 1024 + 1))).status).toBe(413);
  });

  test('unknown or malformed hash → 404', async () => {
    expect((await t.app.request(`/api/public/blobs/${'a'.repeat(64)}`)).status).toBe(404);
    // encoded traversal reaches the route as a param and must fail hash validation
    expect(
      (await t.app.request(`/api/public/blobs/${encodeURIComponent('../../etc/passwd')}`)).status,
    ).toBe(404);
  });
});

// ----- MVP-3: store-level read/list/delete (export & GC substrate) -----

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlobStore } from '../src/blobstore';

describe('BlobStore read/list/delete', () => {
  test('read returns stored bytes, null for missing/invalid', () => {
    const store = new BlobStore(mkdtempSync(join(tmpdir(), 'skb-bs-')));
    const bytes = new TextEncoder().encode('hello blob');
    const { hash } = store.save(bytes);
    expect(store.read(hash)).toEqual(bytes);
    expect(store.read('0'.repeat(64))).toBeNull();
    expect(store.read('../etc/passwd')).toBeNull();
  });

  test('list returns sorted hashes; delete removes', () => {
    const store = new BlobStore(mkdtempSync(join(tmpdir(), 'skb-bs-')));
    const a = store.save(new TextEncoder().encode('aaa')).hash;
    const b = store.save(new TextEncoder().encode('bbb')).hash;
    expect(store.list()).toEqual([a, b].sort());
    expect(store.delete(a)).toBe(true);
    expect(store.list()).toEqual([b]);
    expect(store.delete(a)).toBe(false);
  });
});
