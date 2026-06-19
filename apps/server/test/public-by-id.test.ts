import { describe, expect, test } from 'bun:test';
import { createPublicPage, createTestContext, json } from './helpers';

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
    expect(await res.text()).toContain('<link rel="canonical" href="/notes/');
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
