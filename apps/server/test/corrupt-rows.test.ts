/**
 * E1 (mvp7 review): corrupt stored JSON must degrade locally — one bad
 * row never takes down a whole response, a re-render pass, or a backup.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { blocks, notepages } from '../src/db/schema';
import { rerenderAllPublished } from '../src/settings';
import { createTestContext, json, type TestContext } from './helpers';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext();
});

async function createPublishedPublicPage(title: string): Promise<{ id: string; slug: string }> {
  const created = await json(
    await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title }) }),
  );
  await t.authed(`/api/notepages/${created.id}/working-state`, {
    method: 'PUT',
    body: JSON.stringify({
      title,
      gravityEnabled: true,
      blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: { markdown: 'hi' } }],
    }),
  });
  const pub = await json(await t.authed(`/api/notepages/${created.id}/publish`, { method: 'POST' }));
  await t.authed(`/api/notepages/${created.id}/visibility`, {
    method: 'POST',
    body: JSON.stringify({ visibility: 'public' }),
  });
  return { id: created.id, slug: pub.slug };
}

describe('corrupt stored rows degrade locally (E1)', () => {
  test('corrupt publishedDoc: directory and tree skip/degrade, the good page survives', async () => {
    const good = await createPublishedPublicPage('Good Page');
    const bad = await createPublishedPublicPage('Bad Page');
    t.db.update(notepages).set({ publishedDoc: '{not json' }).where(eq(notepages.id, bad.id)).run();

    const dir = await json(await t.app.request('/api/public/notes'));
    expect(dir.notes.map((n: { slug: string }) => n.slug)).toEqual([good.slug]);

    // public tree keeps the page, falls back to the working title
    const tree = await json(await t.app.request('/api/public/tree'));
    const slugs = tree.notepages.map((p: { slug: string }) => p.slug).sort();
    expect(slugs).toEqual([bad.slug, good.slug].sort());
    const badEntry = tree.notepages.find((p: { slug: string }) => p.slug === bad.slug);
    expect(badEntry.title).toBe('Bad Page'); // working-title fallback

    // single-page JSON read reports the corruption explicitly
    const single = await t.app.request(`/api/public/notes/${bad.slug}`);
    expect(single.status).toBe(500);
    expect((await json(single)).error).toContain('re-publish');
  });

  test('corrupt block content / background: page GET still answers', async () => {
    const page = await createPublishedPublicPage('Edit Me');
    t.db.update(blocks).set({ content: '{boom' }).where(eq(blocks.id, 'b1')).run();
    t.db.update(notepages).set({ background: 'nope}' }).where(eq(notepages.id, page.id)).run();

    const got = await json(await t.authed(`/api/notepages/${page.id}`));
    expect(got.blocks[0].content).toBeNull();
    expect(got.page.background).toBeNull();
  });

  test('rerenderAllPublished skips the corrupt row, renders the rest', async () => {
    await createPublishedPublicPage('Render A');
    const bad = await createPublishedPublicPage('Render B');
    t.db.update(notepages).set({ publishedDoc: '{not json' }).where(eq(notepages.id, bad.id)).run();
    expect(rerenderAllPublished(t.db)).toBe(1);
  });

  test('export still succeeds with corrupt rows (published degrades to null)', async () => {
    const bad = await createPublishedPublicPage('Backup Me');
    t.db.update(notepages).set({ publishedDoc: '{not json' }).where(eq(notepages.id, bad.id)).run();
    t.db.update(blocks).set({ content: '{boom' }).where(eq(blocks.id, 'b1')).run();

    const res = await t.authed('/api/admin/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/zip');
  });
});
