import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, md } from './fixtures/login';

test('published autofit block clips (overflow:hidden); non-autofit scrolls (auto)', async ({ page }) => {
  await loginViaApi(page);
  const { slug } = await createMarkdownPage(page.request, {
    title: 'autofit publish clip',
    themeId: 'graph-paper',
    blocks: [
      { id: 'A', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, autofit: 'grow', minRowSpan: 2, content: md('## clipped\n\nbody') },
      { id: 'B', kind: 'markdown', col: 6, row: 0, colSpan: 6, rowSpan: 2, autofit: 'off', minRowSpan: null, content: md('## scrolls\n\nbody') },
    ],
  });

  // The clean public share route (standalone, no shell).
  await page.goto(`/notes/${slug}`);

  // Published markup is read-only (no editor-only data-block-id). The host
  // BlockFrameCore renders the overflow-owning content box as
  // `.skb-content-box` (graph-paper's default skin adds no extra class), so
  // target by rendered content.
  const autofitFrame = page.locator('.skb-content-box').filter({ hasText: 'clipped' });
  const plainFrame = page.locator('.skb-content-box').filter({ hasText: 'scrolls' });
  await expect(autofitFrame).toBeVisible();
  await expect(plainFrame).toBeVisible();

  const overflowOf = (el: Element) => getComputedStyle(el).overflowY;
  expect(await autofitFrame.evaluate(overflowOf)).toBe('hidden');
  expect(await plainFrame.evaluate(overflowOf)).toBe('auto');
});
