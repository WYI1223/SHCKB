import { describe, expect, test } from 'bun:test';
import { createPublicPage, createTestContext } from './helpers';
import { notepages } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('published HTML keeps /p/:id (no slug-materialization)', () => {
  test('publish leaves internal /p/:id content hrefs intact', async () => {
    const t = await createTestContext();
    const B = await createPublicPage(t, { title: 'B', body: '# B' });
    const A = await createPublicPage(t, { title: 'A', body: `[go](/p/${B.id})` });
    const row = t.db.select().from(notepages).where(eq(notepages.id, A.id)).get()!;
    expect(row.publishedHtml).toContain(`href="/p/${B.id}"`); // content link NOT rewritten to a slug
  });
});
