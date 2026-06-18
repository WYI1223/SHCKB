import { describe, expect, test } from 'bun:test';
import { createTestContext, json } from './helpers';

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

const REQ = (t: Awaited<ReturnType<typeof createTestContext>>, path: string) =>
  t.app.request(`http://localhost${path}`); // public routes: full origin, no auth

describe('public read by id', () => {
  test('GET /api/public/notes/:id returns the published doc', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await REQ(t, `/api/public/notes/${p.id}`);
    expect(res.status).toBe(200);
    expect((await json(res)).doc.title).toBe('P');
  });
  test('GET /notes/:id serves published HTML', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await REQ(t, `/notes/${p.id}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('canonical');
  });
  test('GET /p/:id 302s to /notes/:id', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await REQ(t, `/p/${p.id}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`/notes/${encodeURIComponent(p.id)}`);
  });
  test('unpublished id → 404 (no-leak)', async () => {
    const t = await createTestContext();
    const { id } = await json(await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'D' }) }));
    expect((await REQ(t, `/api/public/notes/${id}`)).status).toBe(404);
    expect((await REQ(t, `/p/${id}`)).status).toBe(404);
  });
});
