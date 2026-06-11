import { beforeEach, describe, expect, test } from 'bun:test';
import { createTestContext, json, type TestContext } from './helpers';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext();
});

async function mkFolder(name: string, parentId?: string): Promise<string> {
  const res = await t.authed('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ name, parentId }),
  });
  expect(res.status).toBe(201);
  return (await json(res)).id;
}

async function mkPage(title: string): Promise<{ id: string; slug: string }> {
  const res = await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title }) });
  return json(res);
}

async function movePage(id: string, folderId: string | null): Promise<Response> {
  return t.authed(`/api/notepages/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ folderId }),
  });
}

async function publishPublic(id: string): Promise<void> {
  await t.authed(`/api/notepages/${id}/publish`, { method: 'POST' });
  await t.authed(`/api/notepages/${id}/visibility`, {
    method: 'POST',
    body: JSON.stringify({ visibility: 'public' }),
  });
}

describe('workspace forest (author side)', () => {
  test('folders nest; tree returns folders and pages with placement', async () => {
    const root = await mkFolder('Methods');
    const sub = await mkFolder('Zettelkasten', root);
    const page = await mkPage('Card Notes');
    expect((await movePage(page.id, sub)).status).toBe(200);

    const tree = await json(await t.authed('/api/tree'));
    expect(tree.folders).toHaveLength(2);
    expect(tree.folders.find((f: any) => f.id === sub).parentId).toBe(root);
    expect(tree.notepages.find((p: any) => p.id === page.id).folderId).toBe(sub);
  });

  test('folder cycle rejected: cannot move into own subtree or self', async () => {
    const a = await mkFolder('A');
    const b = await mkFolder('B', a);
    const c = await mkFolder('C', b);
    const intoOwnChild = await t.authed(`/api/folders/${a}`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId: c }),
    });
    expect(intoOwnChild.status).toBe(400);
    const intoSelf = await t.authed(`/api/folders/${a}`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId: a }),
    });
    expect(intoSelf.status).toBe(400);
    // legal move still works (C up to top level)
    expect(
      (await t.authed(`/api/folders/${c}`, { method: 'PATCH', body: JSON.stringify({ parentId: null }) })).status,
    ).toBe(200);
  });

  test('only empty folders can be deleted; pages fall back to top level via move', async () => {
    const f = await mkFolder('Trash-candidate');
    const page = await mkPage('Occupant');
    await movePage(page.id, f);
    expect((await t.authed(`/api/folders/${f}`, { method: 'DELETE' })).status).toBe(409);
    await movePage(page.id, null);
    expect((await t.authed(`/api/folders/${f}`, { method: 'DELETE' })).status).toBe(200);
  });

  test('rename folder; move page to unknown folder rejected', async () => {
    const f = await mkFolder('Old Name');
    expect(
      (await t.authed(`/api/folders/${f}`, { method: 'PATCH', body: JSON.stringify({ name: 'New Name' }) })).status,
    ).toBe(200);
    const tree = await json(await t.authed('/api/tree'));
    expect(tree.folders[0].name).toBe('New Name');

    const page = await mkPage('Wanderer');
    expect((await movePage(page.id, 'nonexistent')).status).toBe(404);
  });

  test('mutations require auth', async () => {
    expect((await t.app.request('/api/folders', { method: 'POST' })).status).toBe(401);
    expect((await t.app.request('/api/tree')).status).toBe(401);
  });
});

describe('public tree projection (anonymous, live, pruned)', () => {
  test('keeps only ancestor chains of public+published pages', async () => {
    const pub = await mkFolder('Public Stuff');
    const pubSub = await mkFolder('Deep', pub);
    const privOnly = await mkFolder('Private Stuff');
    const empty = await mkFolder('Empty');

    const visible = await mkPage('Visible');
    await movePage(visible.id, pubSub);
    await publishPublic(visible.id);

    const hidden = await mkPage('Hidden Draft');
    await movePage(hidden.id, privOnly); // stays private

    const tree = await json(await t.app.request('/api/public/tree')); // anonymous
    const folderIds = tree.folders.map((f: any) => f.id);
    expect(folderIds).toContain(pub);
    expect(folderIds).toContain(pubSub);
    expect(folderIds).not.toContain(privOnly); // never leaks
    expect(folderIds).not.toContain(empty); // pruned
    expect(tree.notepages).toHaveLength(1);
    expect(tree.notepages[0]).toMatchObject({ slug: visible.slug, folderId: pubSub });
  });

  test('position is live metadata; existence is gated by explicit actions', async () => {
    const a = await mkFolder('A');
    const b = await mkFolder('B');
    const page = await mkPage('Mover');
    await movePage(page.id, a);
    await publishPublic(page.id);

    // live position: move reflects immediately, no re-publish needed
    await movePage(page.id, b);
    let tree = await json(await t.app.request('/api/public/tree'));
    expect(tree.notepages[0].folderId).toBe(b);
    expect(tree.folders.map((f: any) => f.id)).toEqual([b]);

    // existence: flipping private removes it (and its branch) at once
    await t.authed(`/api/notepages/${page.id}/visibility`, {
      method: 'POST',
      body: JSON.stringify({ visibility: 'private' }),
    });
    tree = await json(await t.app.request('/api/public/tree'));
    expect(tree.notepages).toHaveLength(0);
    expect(tree.folders).toHaveLength(0);
  });

  test('public tree title comes from the published snapshot', async () => {
    const page = await mkPage('Published Title');
    await publishPublic(page.id);
    await t.authed(`/api/notepages/${page.id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Renamed In Working', gravityEnabled: true, blocks: [] }),
    });
    const tree = await json(await t.app.request('/api/public/tree'));
    expect(tree.notepages[0].title).toBe('Published Title');
  });
});
