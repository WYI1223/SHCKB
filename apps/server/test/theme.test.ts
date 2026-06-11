import { describe, expect, test } from 'bun:test';
import { createTestContext, json } from './helpers';

describe('theme settings', () => {
  test('default instance theme; admin can change; full re-render happens', async () => {
    const ctx = await createTestContext();
    expect((await json(await ctx.authed('/api/settings'))).theme).toBe('graph-paper');

    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'T' }) }));
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
    const before = await (await ctx.app.request('http://localhost/notes/t')).text();
    expect(before).toContain('oklch(98% 0.005 80)'); // graph-paper canvasBg

    const res = await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) });
    expect((await json(res)).rerendered).toBe(1);
    const after = await (await ctx.app.request('http://localhost/notes/t')).text();
    expect(after).not.toBe(before);
    expect(after).toContain('background: white'); // ink canvasBg in document shell

    expect((await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'nope' }) })).status).toBe(400);
  });

  test('per-page pin overrides instance theme and survives instance switch', async () => {
    const ctx = await createTestContext();
    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Pinned' }) }));
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });

    const pin = await ctx.authed(`/api/notepages/${p.id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'ink' }) });
    expect(pin.status).toBe(200);
    const pinned = await (await ctx.app.request('http://localhost/notes/pinned')).text();
    expect(pinned).toContain('background: white');

    await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'graph-paper' }) });
    const still = await (await ctx.app.request('http://localhost/notes/pinned')).text();
    expect(still).toContain('background: white'); // pin holds

    await ctx.authed(`/api/notepages/${p.id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: null }) });
    const unpinned = await (await ctx.app.request('http://localhost/notes/pinned')).text();
    expect(unpinned).toContain('oklch(98% 0.005 80)');

    // unknown pin id rejected
    expect((await ctx.authed(`/api/notepages/${p.id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'bogus' }) })).status).toBe(400);
  });

  test('public instance endpoint exposes theme anonymously; pin reflected in public note payload', async () => {
    const ctx = await createTestContext();
    const anon = await ctx.app.request('http://localhost/api/public/instance');
    expect((await json(anon)).theme).toBe('graph-paper');

    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Pub' }) }));
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
    await ctx.authed(`/api/notepages/${p.id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'ink' }) });
    const note = await json(await ctx.app.request('http://localhost/api/public/notes/pub'));
    expect(note.theme).toBe('ink');

    const detail = await json(await ctx.authed(`/api/notepages/${p.id}`));
    expect(detail.page.themeId).toBe('ink');
  });
});
