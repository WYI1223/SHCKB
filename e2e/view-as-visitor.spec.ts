/**
 * "View as visitor" — logged-in preview of the public read interface (MVP-10
 * spec §13). The bottom account foot's entry takes a logged-in author into the
 * public read surface; there the sidebar shows the VISITOR's public directory
 * (not the author rack), navigation stays in /read, and the author affordances
 * (mode toggle, create, row menus) are gone. "Exit preview" returns to editing.
 *
 * This is surface-derived chrome + a router round-trip that only a real browser
 * exercises (the unit suite is green on chromeAudience and still cannot see the
 * directory swap or the foot wiring).
 *
 * Run via the documented two-server procedure (see playwright.config.ts).
 */
import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, md } from './fixtures/login';

test('view as visitor: enter public read, browse, exit back to editing', async ({ page }) => {
  await loginViaApi(page);

  // Two published + public pages so the public projection has a library to browse.
  const A = await createMarkdownPage(page.request, {
    title: 'visitor A',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [{ id: 'vA1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, content: md('# Visitor A') }],
  });
  const B = await createMarkdownPage(page.request, {
    title: 'visitor B',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [{ id: 'vB1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, content: md('# Visitor B') }],
  });

  // Open A in the editor. The account foot + "view as visitor" render once me +
  // the public projection load (the entry enables when something is published).
  await page.goto(`/edit/${A.id}`);
  await expect(page.locator('input[aria-label="Notepage title"]')).toBeVisible();

  const viewAsVisitor = page.getByRole('button', { name: 'View as visitor' });
  await expect(viewAsVisitor).toBeEnabled();
  await viewAsVisitor.click();

  // Landed on the public read surface of the current page — no editor chrome.
  await expect(page).toHaveURL(`/read/${A.id}`);
  await expect(page.locator('input[aria-label="Notepage title"]')).toHaveCount(0);
  // The author mode toggle is gone (this is the visitor's chrome now).
  await expect(page.getByRole('button', { name: 'Preview mode' })).toHaveCount(0);
  // The foot now offers the exit, and the directory is the public projection.
  await expect(page.getByRole('button', { name: 'Exit visitor preview' })).toBeVisible();

  // Browse to B via the sidebar — the public rows point at /read, and we stay there.
  const bRow = page.locator(`aside a[href="/read/${B.id}"]`);
  await expect(bRow).toBeVisible();
  await bRow.click();
  await expect(page).toHaveURL(`/read/${B.id}`);
  await expect(page.locator('.skb-md').filter({ hasText: 'Visitor B' })).toBeVisible();
  await expect(page.locator('input[aria-label="Notepage title"]')).toHaveCount(0);

  // Exit preview → back to editing the current page.
  await page.getByRole('button', { name: 'Exit visitor preview' }).click();
  await expect(page).toHaveURL(`/edit/${B.id}`);
  await expect(page.locator('input[aria-label="Notepage title"]')).toBeVisible();
});
