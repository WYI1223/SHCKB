import { describe, expect, test } from 'bun:test';
import { createTestContext } from './helpers';
import { notepages } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function createPublicPage(t: Awaited<ReturnType<typeof createTestContext>>, opts: { title: string; body: string }) {
  const { id } = await (await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: opts.title }) })).json();
  await t.authed(`/api/notepages/${id}/working-state`, { method: 'PUT', body: JSON.stringify({
    title: opts.title, gravityEnabled: false,
    blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, shell: null, content: { markdown: opts.body } }],
  }) });
  await t.authed(`/api/notepages/${id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'graph-paper' }) });
  const { slug } = await (await t.authed(`/api/notepages/${id}/publish`, { method: 'POST' })).json();
  await t.authed(`/api/notepages/${id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
  return { id, slug };
}

describe('published HTML keeps /p/:id (no slug-materialization)', () => {
  test('publish leaves internal /p/:id content hrefs intact', async () => {
    const t = await createTestContext();
    const B = await createPublicPage(t, { title: 'B', body: '# B' });
    const A = await createPublicPage(t, { title: 'A', body: `[go](/p/${B.id})` });
    const row = t.db.select().from(notepages).where(eq(notepages.id, A.id)).get()!;
    expect(row.publishedHtml).toContain(`href="/p/${B.id}"`); // content link NOT rewritten to a slug
  });
});
