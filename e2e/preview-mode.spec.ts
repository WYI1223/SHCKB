/**
 * Preview as a browsing mode (MVP-10 spec §12). The left-chrome edit⇄preview
 * toggle drives a SUSTAINED mode: once in preview, sidebar navigation stays in
 * /view — the whole library browses as a reader — instead of snapping back to
 * /edit. This is the real proof: the sidebar's surface-preservation is React
 * state + a router push that only a real browser exercises (the unit suite is
 * green on this surface and still cannot see it — the same lesson as the
 * stopPropagation bug in page-links.spec).
 *
 * Run via the documented two-server procedure (see playwright.config.ts):
 *   terminal 1: SHCKB_DB_PATH=... PORT=3210 bun apps/server/src/index.ts
 *   terminal 2: SHCKB_API_TARGET=http://localhost:3210 bun x vite --port 5173 (cwd apps/web)
 *   then: playwright test e2e/preview-mode.spec.ts
 * DO NOT run against the dev库 — e2e and dev both use :5173.
 */
import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, md } from './fixtures/login';

test('preview mode: chrome toggle keeps sidebar navigation in /view', async ({ page }) => {
  await loginViaApi(page);

  // Two author pages; both land in the author tree (sidebar lists them).
  const A = await createMarkdownPage(page.request, {
    title: 'preview-mode A',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [{ id: 'pA1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, content: md('# Preview A') }],
  });
  const B = await createMarkdownPage(page.request, {
    title: 'preview-mode B',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [{ id: 'pB1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, content: md('# Preview B') }],
  });

  // Open A in the editor. The chrome toggle + sidebar rows render once me + tree load.
  await page.goto(`/edit/${A.id}`);
  await expect(page.locator('input[aria-label="Notepage title"]')).toBeVisible();

  const previewBtn = page.getByRole('button', { name: 'Preview mode' });
  const editBtn = page.getByRole('button', { name: 'Edit mode' });
  await expect(previewBtn).toBeVisible();

  // Flip to preview → THIS page goes to /view/A; the editor chrome disappears.
  await previewBtn.click();
  await expect(page).toHaveURL(`/view/${A.id}`);
  await expect(page.locator('input[aria-label="Notepage title"]')).toHaveCount(0);

  // The sidebar row for B now points at /view/B (surface-preserving, not /edit/B).
  const bRow = page.locator(`aside a[href="/view/${B.id}"]`);
  await expect(bRow).toBeVisible();
  await bRow.click();

  // Stayed in preview: /view/B, NOT /edit/B. B's content renders; no editor chrome.
  await expect(page).toHaveURL(`/view/${B.id}`);
  await expect(page.locator('.skb-md').filter({ hasText: 'Preview B' })).toBeVisible();
  await expect(page.locator('input[aria-label="Notepage title"]')).toHaveCount(0);

  // Flip back to edit → current page (B) goes to /edit/B; the editor returns.
  await editBtn.click();
  await expect(page).toHaveURL(`/edit/${B.id}`);
  await expect(page.locator('input[aria-label="Notepage title"]')).toBeVisible();
});
