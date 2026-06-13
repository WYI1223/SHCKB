import { beforeEach, describe, expect, test } from 'bun:test';
import { createTestContext, json, type TestContext } from './helpers';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext();
});

async function createPage(title = 'Autofit Note'): Promise<{ id: string; slug: string }> {
  const res = await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title }) });
  expect(res.status).toBe(201);
  return json(res);
}

// A geometrically valid, gravity-on-legal markdown block at the given row.
function block(id: string, row: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'markdown',
    col: 0,
    row,
    colSpan: 12,
    rowSpan: 2,
    content: { markdown: 'hello' },
    ...extra,
  };
}

async function putWorking(id: string, body: object): Promise<Response> {
  return t.authed(`/api/notepages/${id}/working-state`, { method: 'PUT', body: JSON.stringify(body) });
}

describe('working-state: autofit + minRowSpan parsing', () => {
  test('legacy body without the fields still saves (200) and reads back null/null', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, { title: 'T', gravityEnabled: true, blocks: [block('b1', 0)] });
    expect(res.status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBeNull();
    expect(got.blocks[0].minRowSpan).toBeNull();
  });

  test('autofit "grow" + integer minRowSpan round-trip through working-state', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: 'grow', minRowSpan: 2 })],
    });
    expect(res.status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBe('grow');
    expect(got.blocks[0].minRowSpan).toBe(2);
  });

  test('explicit null fields are accepted as off/legacy', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: null, minRowSpan: null })],
    });
    expect(res.status).toBe(200);
    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBeNull();
    expect(got.blocks[0].minRowSpan).toBeNull();
  });

  test('malformed autofit type (number) → 400 malformed working state', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: 5 })],
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('malformed working state');
  });

  test('malformed minRowSpan type (string) → 400 malformed working state', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { minRowSpan: '3' })],
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('malformed working state');
  });
});

describe('working-state: floor invariant guard', () => {
  test('rowSpan < minRowSpan → 422 floor invariant violation, no partial apply', async () => {
    const { id } = await createPage();
    // seed a known-good state first, to prove the rejected PUT does not land
    expect(
      (await putWorking(id, { title: 'T', gravityEnabled: true, blocks: [block('seed', 0)] })).status,
    ).toBe(200);

    // rowSpan 2 < minRowSpan 4 — geometrically valid (passes validateState),
    // but violates the floor invariant the engine cannot see.
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 2, minRowSpan: 4 })],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe('floor invariant violation');

    // state unchanged: the seed block is still there, b1 never landed
    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks.map((b: any) => b.id)).toEqual(['seed']);
  });

  test('minRowSpan < 1 → 422 floor invariant violation', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 2, minRowSpan: 0 })],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe('floor invariant violation');
  });

  test('non-integer minRowSpan → 422 floor invariant violation', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 3, minRowSpan: 1.5 })],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe('floor invariant violation');
  });

  test('rowSpan == minRowSpan (boundary) → 200', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 2, minRowSpan: 2 })],
    });
    expect(res.status).toBe(200);
  });

  test('rowSpan > minRowSpan (grown by content) → 200', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 5, minRowSpan: 2 })],
    });
    expect(res.status).toBe(200);
  });

  test('minRowSpan null (autofit off) → guard skipped, 200', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 2, minRowSpan: null })],
    });
    expect(res.status).toBe(200);
  });

  test('floor 422 is checked AFTER validateState: overlap still reports overlap not floor', async () => {
    const { id } = await createPage();
    // two overlapping blocks AND a bad floor — validateState fires first
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [
        { id: 'a', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'x' }, minRowSpan: 9 },
        { id: 'b', kind: 'markdown', col: 2, row: 1, colSpan: 6, rowSpan: 2, content: { markdown: 'y' } },
      ],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe('layout invariant violation');
  });
});
