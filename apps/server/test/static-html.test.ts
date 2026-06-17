import { beforeEach, describe, expect, test } from 'bun:test';
import { createTestContext, json, type TestContext } from './helpers';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext();
});

async function setupPublished(title: string, markdown: string): Promise<{ id: string; slug: string }> {
  const created = await json(
    await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title }) }),
  );
  await t.authed(`/api/notepages/${created.id}/working-state`, {
    method: 'PUT',
    body: JSON.stringify({
      title,
      gravityEnabled: true,
      blocks: [
        { id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 2, content: { markdown } },
        {
          id: 'b2',
          kind: 'image',
          col: 0,
          row: 2,
          colSpan: 6,
          rowSpan: 3,
          content: { blobHash: 'a'.repeat(64), alt: 'grid diagram' },
        },
      ],
    }),
  });
  await t.authed(`/api/notepages/${created.id}/publish`, { method: 'POST' });
  await t.authed(`/api/notepages/${created.id}/visibility`, {
    method: 'POST',
    body: JSON.stringify({ visibility: 'public' }),
  });
  return created;
}

describe('publish-time static HTML (phase 4)', () => {
  test('public /notes/:slug serves reader-grade HTML anonymously', async () => {
    const { slug } = await setupPublished('Static Page', '# Heading\n\nSome **bold** text.');
    const res = await t.app.request(`/notes/${slug}`); // anonymous
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain(`alt="grid diagram"`);
    expect(html).toContain(`/api/public/blobs/${'a'.repeat(64)}`);
    expect(html).toContain('<title>Static Page</title>');
  });

  test('html titles and raw markdown html are escaped/dropped', async () => {
    const { slug } = await setupPublished(
      '<script>alert("t")</script>',
      'before <script>alert("md")</script> after',
    );
    const html = await (await t.app.request(`/notes/${slug}`)).text();
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;'); // escaped title visible as text
    expect(html).toContain('before');
    expect(html).toContain('after');
  });

  test('no-leak: missing, private, unpublished get identical 404 html', async () => {
    const priv = await json(
      await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'P' }) }),
    );
    await t.authed(`/api/notepages/${priv.id}/publish`, { method: 'POST' }); // published, still private

    const a = await t.app.request('/notes/never-existed');
    const b = await t.app.request(`/notes/${priv.slug}`);
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.text()).toBe(await b.text());
  });

  test('first publish locks slug to current title; later publishes keep it', async () => {
    const created = await json(
      await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({}) }),
    );
    expect(created.slug).toBe('untitled');
    await t.authed(`/api/notepages/${created.id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Real Title', gravityEnabled: true, blocks: [] }),
    });
    const pub1 = await json(await t.authed(`/api/notepages/${created.id}/publish`, { method: 'POST' }));
    expect(pub1.slug).toBe('real-title');

    // rename + re-publish: published slug must stay stable
    await t.authed(`/api/notepages/${created.id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Renamed Again', gravityEnabled: true, blocks: [] }),
    });
    const pub2 = await json(await t.authed(`/api/notepages/${created.id}/publish`, { method: 'POST' }));
    expect(pub2.slug).toBe('real-title');

    await t.authed(`/api/notepages/${created.id}/visibility`, {
      method: 'POST',
      body: JSON.stringify({ visibility: 'public' }),
    });
    expect((await t.app.request('/notes/real-title')).status).toBe(200);
  });

  test('public internal links are materialized /p/:id → /notes/:slug at publish time (MVP-10)', async () => {
    // target page: public + published, so its id resolves to a slug
    const target = await json(
      await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Target Page' }) }),
    );
    await t.authed(`/api/notepages/${target.id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Target Page', gravityEnabled: true, blocks: [] }),
    });
    await t.authed(`/api/notepages/${target.id}/publish`, { method: 'POST' });
    await t.authed(`/api/notepages/${target.id}/visibility`, {
      method: 'POST',
      body: JSON.stringify({ visibility: 'public' }),
    });

    // source page: a richtext block links to the target (block b9) and to a
    // non-existent page id; publish AFTER the target is public.
    const source = await json(
      await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Source Page' }) }),
    );
    const richtext = (pageId: string, blockId: string | null) => ({
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'go', marks: [{ type: 'pagelink', attrs: { pageId, blockId } }] }],
          },
        ],
      },
    });
    await t.authed(`/api/notepages/${source.id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Source Page',
        gravityEnabled: true,
        blocks: [
          { id: 'r1', kind: 'richtext', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: richtext(target.id, 'b9') },
          { id: 'r2', kind: 'richtext', col: 0, row: 1, colSpan: 12, rowSpan: 1, content: richtext('pg_nope', null) },
        ],
      }),
    });
    await t.authed(`/api/notepages/${source.id}/publish`, { method: 'POST' });
    await t.authed(`/api/notepages/${source.id}/visibility`, {
      method: 'POST',
      body: JSON.stringify({ visibility: 'public' }),
    });

    const html = await (await t.app.request(`/notes/${source.slug}`)).text();
    // resolvable target → /notes/:slug (fragment preserved), data attr kept
    expect(html).toContain(`href="/notes/${target.slug}#b9"`);
    expect(html).toContain(`data-skb-page="${target.id}"`);
    // unresolvable id stays /p/:id (server 302 fallback)
    expect(html).toContain('href="/p/pg_nope"');
  });

  test('re-publish refreshes the static html', async () => {
    const { id, slug } = await setupPublished('Refresh', 'version one');
    await t.authed(`/api/notepages/${id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Refresh',
        gravityEnabled: true,
        blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: { markdown: 'version two' } }],
      }),
    });
    // not yet re-published → old html
    expect(await (await t.app.request(`/notes/${slug}`)).text()).toContain('version one');
    await t.authed(`/api/notepages/${id}/publish`, { method: 'POST' });
    expect(await (await t.app.request(`/notes/${slug}`)).text()).toContain('version two');
  });
});
