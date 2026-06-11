import { beforeEach, describe, expect, test } from 'bun:test';
import { createTestContext, json, type TestContext } from './helpers';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext();
});

async function createPage(title = 'My Note'): Promise<{ id: string; slug: string }> {
  const res = await t.authed('/api/notepages', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  expect(res.status).toBe(201);
  return json(res);
}

function mdBlock(id: string, row: number, content = 'hello', col = 0, colSpan = 12, rowSpan = 1) {
  return { id, kind: 'markdown', col, row, colSpan, rowSpan, content: { markdown: content } };
}

async function putWorking(id: string, body: object): Promise<Response> {
  return t.authed(`/api/notepages/${id}/working-state`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function setVisibility(id: string, visibility: string): Promise<Response> {
  return t.authed(`/api/notepages/${id}/visibility`, {
    method: 'POST',
    body: JSON.stringify({ visibility }),
  });
}

describe('scaffold', () => {
  test('health is open and exposes version + schemaVersion', async () => {
    const res = await t.app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.ok).toBe(true);
    expect(body.version).toBe('test');
    expect(body.schemaVersion).toBeGreaterThanOrEqual(1);
  });

  test('me returns admin principal when authed, 401 anonymous', async () => {
    const me = await json(await t.authed('/api/me'));
    expect(me.user).toMatchObject({ role: 'admin', email: 'admin@local.test' });
    expect(me.user.token).toBeUndefined();
    expect((await t.app.request('/api/me')).status).toBe(401);
  });
});

describe('notepage crud + working state', () => {
  test('create → list → get roundtrip, private by default', async () => {
    const { id, slug } = await createPage('Hello World');
    expect(slug).toBe('hello-world');

    const list = await json(await t.authed('/api/notepages'));
    expect(list.notepages).toHaveLength(1);
    expect(list.notepages[0]).toMatchObject({
      id,
      title: 'Hello World',
      visibility: 'private',
      hasPublished: false,
    });

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.page.gravityEnabled).toBe(true);
    expect(got.blocks).toEqual([]);
  });

  test('slug collision gets numeric suffix', async () => {
    const a = await createPage('Same Title');
    const b = await createPage('Same Title');
    expect(a.slug).toBe('same-title');
    expect(b.slug).toBe('same-title-2');
  });

  test('working-state save roundtrip', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'Renamed',
      gravityEnabled: true,
      blocks: [mdBlock('b1', 0), mdBlock('b2', 1, 'second')],
    });
    expect(res.status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.page.title).toBe('Renamed');
    expect(got.blocks).toHaveLength(2);
    expect(got.blocks.find((b: any) => b.id === 'b2').content).toEqual({ markdown: 'second' });
  });

  test('overlapping blocks rejected 422, state unchanged', async () => {
    const { id } = await createPage();
    expect((await putWorking(id, { title: 'T', gravityEnabled: true, blocks: [mdBlock('ok', 0)] })).status).toBe(200);

    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [mdBlock('a', 0, 'x', 0, 6, 2), mdBlock('b', 1, 'y', 2, 6, 2)],
    });
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(body.details.some((e: string) => e.includes('overlap'))).toBe(true);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks.map((b: any) => b.id)).toEqual(['ok']);
  });

  test('floating blocks: 422 with gravity on, 200 with gravity off (D7)', async () => {
    const { id } = await createPage();
    const floating = [mdBlock('f', 5)];
    expect((await putWorking(id, { title: 'T', gravityEnabled: true, blocks: floating })).status).toBe(422);
    expect((await putWorking(id, { title: 'T', gravityEnabled: false, blocks: floating })).status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.page.gravityEnabled).toBe(false);
    expect(got.blocks[0].row).toBe(5);
  });

  test('malformed body → 400; unknown page → 404; delete works', async () => {
    const { id } = await createPage();
    expect((await putWorking(id, { nope: true })).status).toBe(400);
    expect((await putWorking('missing', { title: 'T', gravityEnabled: true, blocks: [] })).status).toBe(404);
    expect((await t.authed(`/api/notepages/${id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await t.authed(`/api/notepages/${id}`)).status).toBe(404);
  });
});

describe('two-state publish + public read', () => {
  test('publish snapshots working state; public route gated on visibility', async () => {
    const { id, slug } = await createPage('Pub');
    await putWorking(id, { title: 'Pub', gravityEnabled: true, blocks: [mdBlock('b1', 0, 'published text')] });

    // private + unpublished → 404 (anonymous request)
    expect((await t.app.request(`/api/public/notes/${slug}`)).status).toBe(404);

    // publish but still private → still 404
    expect((await t.authed(`/api/notepages/${id}/publish`, { method: 'POST' })).status).toBe(200);
    expect((await t.app.request(`/api/public/notes/${slug}`)).status).toBe(404);

    // public + published → 200 with snapshot
    await setVisibility(id, 'public');
    const pub = await json(await t.app.request(`/api/public/notes/${slug}`));
    expect(pub.doc.blocks[0].content).toEqual({ markdown: 'published text' });
  });

  test('working edits invisible to readers until re-publish', async () => {
    const { id, slug } = await createPage('Two State');
    await putWorking(id, { title: 'Two State', gravityEnabled: true, blocks: [mdBlock('b1', 0, 'v1')] });
    await t.authed(`/api/notepages/${id}/publish`, { method: 'POST' });
    await setVisibility(id, 'public');

    await putWorking(id, { title: 'Two State', gravityEnabled: true, blocks: [mdBlock('b1', 0, 'v2 working')] });

    let pub = await json(await t.app.request(`/api/public/notes/${slug}`));
    expect(pub.doc.blocks[0].content).toEqual({ markdown: 'v1' });

    await t.authed(`/api/notepages/${id}/publish`, { method: 'POST' });
    pub = await json(await t.app.request(`/api/public/notes/${slug}`));
    expect(pub.doc.blocks[0].content).toEqual({ markdown: 'v2 working' });
  });

  test('no-leak: missing, private, and unpublished slugs return identical 404 bodies', async () => {
    const a = await createPage('Private Page');
    await t.authed(`/api/notepages/${a.id}/publish`, { method: 'POST' }); // published but private
    const b = await createPage('Unpublished Page');
    await setVisibility(b.id, 'public'); // public but unpublished

    const missing = await t.app.request('/api/public/notes/never-existed');
    const priv = await t.app.request(`/api/public/notes/${a.slug}`);
    const unpub = await t.app.request(`/api/public/notes/${b.slug}`);
    expect(missing.status).toBe(404);
    expect(priv.status).toBe(404);
    expect(unpub.status).toBe(404);
    const bodies = [await missing.text(), await priv.text(), await unpub.text()];
    expect(new Set(bodies).size).toBe(1);
  });
});
