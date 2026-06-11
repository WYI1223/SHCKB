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
    expect(manifest.formatVersion).toBe(1);
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
