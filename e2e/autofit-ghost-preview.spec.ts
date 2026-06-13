import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

test('ghost preview shows rendered markdown while the block stays active', async ({ page }) => {
  await loginViaApi(page);
  const { id } = await createMarkdownPage(page.request, {
    title: 'autofit ghost preview',
    themeId: 'graph-paper',
    blocks: [
      { id: 'G', kind: 'markdown', col: 0, row: 0, colSpan: 5, rowSpan: 2, autofit: 'grow', minRowSpan: 2, content: md('') },
    ],
  });
  await page.goto(`/edit/${id}`);

  const G = page.locator(sel.block('G'));
  await G.click();
  await expect(G).toHaveAttribute('data-pu-active', /.*/);

  const ta = page.locator(sel.activeMarkdownTextarea);
  await ta.fill('## Ghost Heading\n\nrendered body text');

  // The visible floating ghost preview renders the heading; the block
  // is still active (textarea focused) — author sees rendered output
  // without deactivating (spec §7 acceptance criterion). Scope to the
  // pinned [data-skb-ghost-preview] hook (markdown-publish phase) so the
  // assertion is precise, not a loose page-wide heading match.
  const ghost = page.locator('[data-skb-ghost-preview]');
  await expect(ghost).toBeVisible();
  await expect(ghost.getByRole('heading', { name: 'Ghost Heading' })).toBeVisible();
  await expect(ta).toBeFocused();
});
