import { describe, expect, test } from 'bun:test';
import { createPublicPage, createTestContext, json } from './helpers';

describe('public tree carries id', () => {
  test('each public-tree page has an id', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await t.app.request('http://localhost/api/public/tree');
    expect((await json(res)).notepages.some((n: { id: string }) => n.id === p.id)).toBe(true);
  });
});
