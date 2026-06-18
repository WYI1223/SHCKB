import { describe, expect, test } from 'bun:test';
import { createTestContext, json, type TestContext } from './helpers';

async function createPublicPage(t: TestContext, opts: { title: string; body: string }) {
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

describe('public tree carries id', () => {
  test('each public-tree page has an id', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await t.app.request('http://localhost/api/public/tree');
    expect((await json(res)).notepages.some((n: { id: string }) => n.id === p.id)).toBe(true);
  });
});
