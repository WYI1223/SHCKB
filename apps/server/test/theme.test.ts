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

describe('theme customization (MVP-5 M5-D3)', () => {
  test('palette variant applies to published HTML; clearing restores base', async () => {
    const ctx = await createTestContext();
    await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'workbench' }) });
    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'C' }) }));
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });

    const res = await ctx.authed('/api/settings/theme-customization', {
      method: 'PUT',
      body: JSON.stringify({ themeId: 'workbench', customization: { paletteId: 'warm' } }),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.rerendered).toBe(1);
    const warm = await (await ctx.app.request('http://localhost/notes/c')).text();
    expect(warm).toContain('oklch(98.5% 0.006 80)'); // warm canvasBg

    // settings echo + clear restores base tokens
    expect((await json(await ctx.authed('/api/settings'))).customizations.workbench).toEqual({ paletteId: 'warm' });
    await ctx.authed('/api/settings/theme-customization', {
      method: 'PUT',
      body: JSON.stringify({ themeId: 'workbench', customization: null }),
    });
    const base = await (await ctx.app.request('http://localhost/notes/c')).text();
    expect(base).toContain('oklch(98.5% 0.002 260)'); // workbench base canvasBg
  });

  test('whitelist filtering is enforced at the write boundary', async () => {
    const ctx = await createTestContext();
    // canvasBg is NOT whitelisted on graph-paper → nothing valid → 422
    const bad = await ctx.authed('/api/settings/theme-customization', {
      method: 'PUT',
      body: JSON.stringify({ themeId: 'graph-paper', customization: { overrides: { canvasBg: 'red' } } }),
    });
    expect(bad.status).toBe(422);

    // accent IS whitelisted; canvasBg rider is silently dropped
    const ok = await json(
      await ctx.authed('/api/settings/theme-customization', {
        method: 'PUT',
        body: JSON.stringify({
          themeId: 'graph-paper',
          customization: { overrides: { accent: 'oklch(50% 0.2 0)', canvasBg: 'red' } },
        }),
      }),
    );
    expect(ok.customizations['graph-paper']).toEqual({ overrides: { accent: 'oklch(50% 0.2 0)' } });

    // unknown theme id
    const nope = await ctx.authed('/api/settings/theme-customization', {
      method: 'PUT',
      body: JSON.stringify({ themeId: 'nope', customization: { paletteId: 'x' } }),
    });
    expect(nope.status).toBe(400);
  });

  test('customization keyed per theme: pin and instance resolve independently; public payloads carry it', async () => {
    const ctx = await createTestContext();
    await ctx.authed('/api/settings/theme-customization', {
      method: 'PUT',
      body: JSON.stringify({ themeId: 'blueprint', customization: { paletteId: 'sepia' } }),
    });

    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Pinned2' }) }));
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
    await ctx.authed(`/api/notepages/${p.id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'blueprint' }) });

    // pinned page renders blueprint WITH sepia customization
    const html = await (await ctx.app.request('http://localhost/notes/pinned2')).text();
    expect(html).toContain('oklch(30% 0.035 70)'); // sepia canvasBg

    const note = await json(await ctx.app.request('http://localhost/api/public/notes/pinned2'));
    expect(note.theme).toBe('blueprint');
    expect(note.customization).toEqual({ paletteId: 'sepia' });

    // instance (graph-paper) untouched by blueprint's customization
    const inst = await json(await ctx.app.request('http://localhost/api/public/instance'));
    expect(inst.theme).toBe('graph-paper');
    expect(inst.customization).toBeNull();
  });
});
