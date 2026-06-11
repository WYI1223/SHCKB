import { describe, expect, test } from 'bun:test';
import { createTestContext, json } from './helpers';
import { buildExport } from '../src/export/exporter';
import type { BlobStore } from '../src/blobstore';

const OPTS = { appVersion: 'test', schemaVersion: 5, exportedAt: 1_000 };

/** Build a small instance through the API: folder A ( page P1
 * published+public with an image blob ), root page P2 private. */
async function seedInstance(ctx: Awaited<ReturnType<typeof createTestContext>>, _blobStore: BlobStore) {
  const folder = await json(await ctx.authed('/api/folders', { method: 'POST', body: JSON.stringify({ name: 'A' }) }));
  const p1 = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Page One' }) }));
  await ctx.authed(`/api/notepages/${p1.id}/move`, { method: 'POST', body: JSON.stringify({ folderId: folder.id }) });
  const blobBytes = new TextEncoder().encode('fake-image-bytes');
  const up = await ctx.authed('/api/blobs', { method: 'POST', body: blobBytes, headers: { 'content-type': 'image/png' } });
  const { hash } = await json(up);
  await ctx.authed(`/api/notepages/${p1.id}/working-state`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Page One',
      gravityEnabled: true,
      blocks: [
        { id: 'b2', kind: 'image', col: 0, row: 1, colSpan: 4, rowSpan: 3, content: { blobHash: hash, alt: 'x' } },
        { id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: { markdown: '# hi' } },
      ],
    }),
  });
  await ctx.authed(`/api/notepages/${p1.id}/publish`, { method: 'POST' });
  await ctx.authed(`/api/notepages/${p1.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
  const p2 = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Page Two' }) }));
  return { folderId: folder.id, p1: p1.id, p2: p2.id, hash };
}

describe('buildExport', () => {
  test('produces manifest + folder.json + page files + referenced blobs, deterministically', async () => {
    const ctx = await createTestContext();
    const blobStore = ctx.blobStore;
    const seeded = await seedInstance(ctx, blobStore);

    const bundle = buildExport(ctx.db, blobStore, OPTS);
    const paths = [...bundle.files.keys()];
    expect(paths).toContain('manifest.json');
    expect(paths).toContain('tree/A/folder.json');
    expect(paths).toContain('tree/A/page-one.page.json');
    expect(paths).toContain('tree/page-two.page.json');
    expect([...bundle.blobs.keys()]).toEqual([seeded.hash]);

    const manifest = JSON.parse(bundle.files.get('manifest.json')!);
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.counts).toEqual({ folders: 1, pages: 2, blocks: 2, blobs: 1 });
    expect(manifest.pages).toEqual(['tree/A/page-one.page.json', 'tree/page-two.page.json']);

    const page = JSON.parse(bundle.files.get('tree/A/page-one.page.json')!);
    expect(page.blocks.map((b: { id: string }) => b.id)).toEqual(['b1', 'b2']); // sorted by id
    expect(page.published).not.toBeNull();
    expect('publishedHtml' in page).toBe(false);

    // determinism: same instance, second export differs only in exportedAt
    const again = buildExport(ctx.db, blobStore, { ...OPTS, exportedAt: 2_000 });
    for (const [p, text] of bundle.files) {
      if (p === 'manifest.json') continue;
      expect(again.files.get(p)).toBe(text);
    }
    const m2 = JSON.parse(again.files.get('manifest.json')!);
    expect({ ...m2, exportedAt: 0 }).toEqual({ ...manifest, exportedAt: 0 });
  });

  test('sibling folders with colliding sanitized names get deterministic suffixes', async () => {
    const ctx = await createTestContext();
    await ctx.authed('/api/folders', { method: 'POST', body: JSON.stringify({ name: 'a/b' }) });
    await ctx.authed('/api/folders', { method: 'POST', body: JSON.stringify({ name: 'a\\b' }) });
    const bundle = buildExport(ctx.db, ctx.blobStore, OPTS);
    const dirs = [...bundle.files.keys()].filter((p) => p.endsWith('/folder.json')).sort();
    expect(dirs).toEqual(['tree/a_b/folder.json', 'tree/a_b~2/folder.json']);
  });
});

// ----- importer -----

import { importBundle } from '../src/export/importer';

async function freshContext() {
  return createTestContext();
}

describe('importBundle', () => {
  test('round trip: export → import into empty instance → identical re-export', async () => {
    const src = await freshContext();
    await seedInstance(src, src.blobStore);
    const bundle = buildExport(src.db, src.blobStore, OPTS);

    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, bundle);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.counts).toEqual({ folders: 1, pages: 2, blocks: 2, blobs: 1 });

    const again = buildExport(dst.db, dst.blobStore, OPTS);
    expect([...again.files.keys()].sort()).toEqual([...bundle.files.keys()].sort());
    for (const [p, text] of bundle.files) {
      expect(again.files.get(p)).toBe(text); // OPTS pins exportedAt → fully byte-identical
    }
    expect([...again.blobs.keys()]).toEqual([...bundle.blobs.keys()]);

    // published page is live again, HTML re-rendered
    const html = await dst.app.request('http://localhost/notes/page-one');
    expect(html.status).toBe(200);
    expect(await html.text()).toContain('Page One');
  });

  test('rejects non-empty instance', async () => {
    const src = await freshContext();
    await seedInstance(src, src.blobStore);
    const bundle = buildExport(src.db, src.blobStore, OPTS);
    const result = importBundle(src.db, src.blobStore, bundle);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe('instance is not empty');
    }
  });

  test('rejects newer format with downgrade hint', async () => {
    const src = await freshContext();
    const bundle = buildExport(src.db, src.blobStore, OPTS);
    const manifest = JSON.parse(bundle.files.get('manifest.json')!);
    bundle.files.set('manifest.json', JSON.stringify({ ...manifest, formatVersion: 99 }));
    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, bundle);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toContain('newer than this build');
      expect(result.error).toContain('downgrade');
    }
  });

  test('atomic: one invalid page → nothing lands', async () => {
    const src = await freshContext();
    await seedInstance(src, src.blobStore);
    const bundle = buildExport(src.db, src.blobStore, OPTS);
    const path = 'tree/page-two.page.json';
    const page = JSON.parse(bundle.files.get(path)!);
    page.blocks = [{ id: 'bad', kind: 'markdown', col: 10, row: 0, colSpan: 6, rowSpan: 1, content: {} }]; // exceeds 12 cols
    bundle.files.set(path, JSON.stringify(page));

    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, bundle);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.details?.some((d) => d.includes(path))).toBe(true);
    }
    const tree = await json(await dst.authed('/api/tree'));
    expect(tree.folders).toEqual([]);
    expect(tree.notepages).toEqual([]);
  });

  test('blob hash mismatch is rejected before anything lands', async () => {
    const src = await freshContext();
    const seeded = await seedInstance(src, src.blobStore);
    const bundle = buildExport(src.db, src.blobStore, OPTS);
    bundle.blobs.set(seeded.hash, new TextEncoder().encode('tampered'));
    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, bundle);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.details?.some((d) => d.includes('hash mismatch'))).toBe(true);
    const tree = await json(await dst.authed('/api/tree'));
    expect(tree.notepages).toEqual([]);
  });
});

// ----- admin routes (zip export/import, gc, role gate) -----

import { unzipSync } from 'fflate';
import { createAuth } from '../src/auth';
import { TEST_SECRET } from './helpers';

describe('admin routes', () => {
  test('export → import over HTTP round trip; GC reclaims unreferenced blob', async () => {
    const src = await freshContext();
    const seeded = await seedInstance(src, src.blobStore);
    // an orphan blob: uploaded but referenced by nothing
    const orphanUp = await src.authed('/api/blobs', {
      method: 'POST',
      body: new TextEncoder().encode('orphan-bytes'),
      headers: { 'content-type': 'image/png' },
    });
    const orphan = (await json(orphanUp)).hash as string;

    const exportRes = await src.authed('/api/admin/export');
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toBe('application/zip');
    const zipBytes = new Uint8Array(await exportRes.arrayBuffer());
    const entries = unzipSync(zipBytes);
    expect(Object.keys(entries)).toContain('manifest.json');
    expect(Object.keys(entries)).toContain(`blobs/${seeded.hash}`);
    expect(Object.keys(entries)).not.toContain(`blobs/${orphan}`); // unreferenced → not exported

    const dst = await freshContext();
    const importRes = await dst.authed('/api/admin/import', {
      method: 'POST',
      body: zipBytes,
      headers: { 'content-type': 'application/zip' },
    });
    expect(importRes.status).toBe(200);
    expect((await json(importRes)).counts.pages).toBe(2);
    const page = await dst.app.request('http://localhost/notes/page-one');
    expect(page.status).toBe(200);

    // GC on source removes the orphan, keeps the referenced blob
    const gc = await src.authed('/api/admin/blobs/gc', { method: 'POST' });
    const gcBody = await json(gc);
    expect(gcBody.deleted).toBe(1);
    expect(src.blobStore.read(orphan)).toBeNull();
    expect(src.blobStore.read(seeded.hash)).not.toBeNull();
  });

  test('unsupported ?format is rejected with a clear error', async () => {
    const ctx = await freshContext();
    const res = await ctx.authed('/api/admin/export?format=0');
    expect(res.status).toBe(400);
    expect((await json(res)).error).toContain('unsupported format');
  });

  test('import into non-empty instance → 409; garbage body → 400', async () => {
    const ctx = await freshContext();
    await seedInstance(ctx, ctx.blobStore);
    const selfZip = new Uint8Array(await (await ctx.authed('/api/admin/export')).arrayBuffer());
    const res409 = await ctx.authed('/api/admin/import', { method: 'POST', body: selfZip });
    expect(res409.status).toBe(409);
    const dst = await freshContext();
    const res400 = await dst.authed('/api/admin/import', { method: 'POST', body: new Uint8Array([1, 2, 3]) });
    expect(res400.status).toBe(400);
  });

  test('admin gate: anonymous 401, author role 403', async () => {
    const ctx = await freshContext();
    const anon = await ctx.app.request('http://localhost/api/admin/export');
    expect(anon.status).toBe(401);

    // create an author-role user via a transient signup-enabled auth
    // instance on the same db (the bootstrap.ts trick)
    const signup = createAuth(ctx.db, { secret: TEST_SECRET, baseURL: 'http://localhost', allowSignUp: true });
    await signup.api.signUpEmail({ body: { email: 'author@local.test', password: 'author-pass-1', name: 'Author' } });
    const signIn = await ctx.app.request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email: 'author@local.test', password: 'author-pass-1' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get('set-cookie')!
      .split(/,(?=\s*[^\s;=]+=)/)
      .map((c) => c.split(';')[0]!.trim())
      .join('; ');
    const asAuthor = await ctx.app.request('http://localhost/api/admin/export', { headers: { cookie } });
    expect(asAuthor.status).toBe(403);
  });
});

// ----- format v2: theme data in the bundle (MVP-4) -----

import { downgradeToVersion } from '../src/export/migrate-format';
import { strFromU8 } from 'fflate';

describe('format v2 (theme data)', () => {
  test('v2 export carries settings + per-page themeId; round trip preserves them', async () => {
    const src = await freshContext();
    const seeded = await seedInstance(src, src.blobStore);
    await src.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) });
    await src.authed(`/api/notepages/${seeded.p2}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'graph-paper' }) });

    const bundle = buildExport(src.db, src.blobStore, OPTS);
    const manifest = JSON.parse(bundle.files.get('manifest.json')!);
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.settings).toEqual({ theme: 'ink' });
    const p2 = JSON.parse(bundle.files.get('tree/page-two.page.json')!);
    expect(p2.themeId).toBe('graph-paper');

    const dst = await freshContext();
    expect(importBundle(dst.db, dst.blobStore, bundle).ok).toBe(true);
    expect((await json(await dst.authed('/api/settings'))).theme).toBe('ink');
    const again = buildExport(dst.db, dst.blobStore, OPTS);
    for (const [p, text] of bundle.files) expect(again.files.get(p)).toBe(text);
  });

  test('v1 bundle imports via the real upgrade transform (defaults applied)', async () => {
    const src = await freshContext();
    await seedInstance(src, src.blobStore);
    const v2 = buildExport(src.db, src.blobStore, OPTS);
    // produce a v1 bundle through the real down transform
    const parsed = new Map([...v2.files].map(([p, t]) => [p, JSON.parse(t) as unknown]));
    const { files: v1files, losses } = downgradeToVersion(parsed, 1);
    expect(losses).toEqual([]); // default theme + no pins → lossless
    const v1bundle = {
      files: new Map([...v1files].map(([p, v]) => [p, JSON.stringify(v)])),
      blobs: v2.blobs,
    };
    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, v1bundle);
    expect(result.ok).toBe(true);
    expect((await json(await dst.authed('/api/settings'))).theme).toBe('graph-paper');
  });

  test('downgrade is lossy-explicit when theme data is non-default', async () => {
    const src = await freshContext();
    const seeded = await seedInstance(src, src.blobStore);
    await src.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) });
    await src.authed(`/api/notepages/${seeded.p1}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'graph-paper' }) });
    const v2 = buildExport(src.db, src.blobStore, OPTS);
    const parsed = new Map([...v2.files].map(([p, t]) => [p, JSON.parse(t) as unknown]));
    const { losses } = downgradeToVersion(parsed, 1);
    expect(losses.some((l) => l.includes('instance theme "ink"'))).toBe(true);
    expect(losses.some((l) => l.includes('themeId'))).toBe(true);
  });

  test('export route ?format=1 serves a v1 zip; dryRun reports losses', async () => {
    const ctx = await freshContext();
    await seedInstance(ctx, ctx.blobStore);
    await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) });

    const dry = await json(await ctx.authed('/api/admin/export?format=1&dryRun=1'));
    expect(dry.losses.length).toBeGreaterThan(0);

    const res = await ctx.authed('/api/admin/export?format=1');
    expect(res.status).toBe(200);
    const entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const manifest = JSON.parse(strFromU8(entries['manifest.json']!));
    expect(manifest.formatVersion).toBe(1);
    expect('settings' in manifest).toBe(false);
  });
});
