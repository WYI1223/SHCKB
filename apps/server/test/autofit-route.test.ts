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

describe('working-state: autofit follow/fix parsing', () => {
  test('legacy body without autofit still saves (200) and reads back null', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, { title: 'T', gravityEnabled: true, blocks: [block('b1', 0)] });
    expect(res.status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBeNull();
    // the floor column is gone — the wire shape no longer carries it
    expect('minRowSpan' in got.blocks[0]).toBe(false);
  });

  test("autofit 'follow' round-trips through working-state", async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: 'follow' })],
    });
    expect(res.status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBe('follow');
  });

  test("autofit 'fix' round-trips through working-state", async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: 'fix' })],
    });
    expect(res.status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBe('fix');
  });

  test('explicit null autofit is accepted (resolves to kind default on read)', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: null })],
    });
    expect(res.status).toBe(200);
    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBeNull();
  });

  test("unknown autofit string (legacy 'grow') is coerced to null, still saves (200)", async () => {
    const { id } = await createPage();
    // any value outside {follow, fix} is not a valid mode — the route
    // coerces it to null rather than rejecting (spec §4.4).
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: 'grow' })],
    });
    expect(res.status).toBe(200);
    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBeNull();
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
});
