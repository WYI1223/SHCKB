import { describe, expect, test } from 'bun:test';
import { createTestContext, json } from './helpers';

/** MVP-6 author appearance: block shells + page background (M6-D3/D4). */
describe('author appearance', () => {
  test('block shell round-trips working state and enters the publish snapshot', async () => {
    const ctx = await createTestContext();
    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'S' }) }));
    // 'flat' is curated by workbench (shells are theme-curated) — pin it
    await ctx.authed(`/api/notepages/${p.id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'workbench' }) });
    await ctx.authed(`/api/notepages/${p.id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'S',
        gravityEnabled: true,
        blocks: [
          { id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, shell: 'flat', content: { markdown: 'x' } },
          { id: 'b2', kind: 'markdown', col: 6, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'y' } },
        ],
      }),
    });

    const detail = await json(await ctx.authed(`/api/notepages/${p.id}`));
    expect(detail.blocks.find((b: { id: string }) => b.id === 'b1').shell).toBe('flat');
    expect(detail.blocks.find((b: { id: string }) => b.id === 'b2').shell).toBeNull();

    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
    const note = await json(await ctx.app.request('http://localhost/api/public/notes/s'));
    expect(note.doc.blocks.find((b: { id: string }) => b.id === 'b1').shell).toBe('flat');
    const html = await (await ctx.app.request('http://localhost/notes/s')).text();
    expect(html).toContain('data-shell="flat"');

    // malformed shell rejected
    const bad = await ctx.authed(`/api/notepages/${p.id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'S',
        gravityEnabled: true,
        blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, shell: 42, content: {} }],
      }),
    });
    expect(bad.status).toBe(400);
  });

  test('page background: validation, two-state promotion, blob gating', async () => {
    const ctx = await createTestContext();
    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'B' }) }));
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });

    // unknown blob refused; junk shapes refused
    expect(
      (
        await ctx.authed(`/api/notepages/${p.id}/background`, {
          method: 'POST',
          body: JSON.stringify({ background: { blobHash: 'f'.repeat(64) } }),
        })
      ).status,
    ).toBe(422);
    expect(
      (await ctx.authed(`/api/notepages/${p.id}/background`, { method: 'POST', body: JSON.stringify({ background: {} }) }))
        .status,
    ).toBe(400);

    // set a color: working state only — the public page must NOT change yet
    const ok = await ctx.authed(`/api/notepages/${p.id}/background`, {
      method: 'POST',
      body: JSON.stringify({ background: { color: 'oklch(90% 0.05 200)' } }),
    });
    expect(ok.status).toBe(200);
    const before = await (await ctx.app.request('http://localhost/notes/b')).text();
    expect(before).not.toContain('oklch(90% 0.05 200)');

    // publish promotes it
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    const after = await (await ctx.app.request('http://localhost/notes/b')).text();
    expect(after).toContain('oklch(90% 0.05 200)');

    // clear
    await ctx.authed(`/api/notepages/${p.id}/background`, { method: 'POST', body: JSON.stringify({ background: null }) });
    const detail = await json(await ctx.authed(`/api/notepages/${p.id}`));
    expect(detail.page.background).toBeNull();
  });

  test('background blob is kept by GC and exported (reference contract)', async () => {
    const ctx = await createTestContext();
    // upload a real blob
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const up = await ctx.authed('/api/blobs', { method: 'POST', body: png, headers: { 'content-type': 'image/png' } });
    const { hash } = await json(up);

    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'G' }) }));
    await ctx.authed(`/api/notepages/${p.id}/background`, {
      method: 'POST',
      body: JSON.stringify({ background: { blobHash: hash } }),
    });

    // GC must keep it: referenced only by the page background
    const gc = await json(await ctx.authed('/api/admin/blobs/gc', { method: 'POST' }));
    expect(gc.deleted).toBe(0);
    const blob = await ctx.app.request(`http://localhost/api/public/blobs/${hash}`);
    expect(blob.status).toBe(200);
  });
});
