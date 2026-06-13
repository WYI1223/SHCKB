import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

const SLOT = 60; // theme.slot for graph-paper/galley/stationery (verified in packages/theme/src)

test('typing grows G and pushes W down; deleting shrinks G and returns W', async ({ page }) => {
  await loginViaApi(page);
  // G: narrow autofit markdown (cols0-1), floor=1; W: wide block below.
  const { id } = await createMarkdownPage(page.request, {
    title: 'autofit grow/shrink',
    themeId: 'graph-paper',
    gravityEnabled: true,
    blocks: [
      { id: 'G', kind: 'markdown', col: 0, row: 0, colSpan: 2, rowSpan: 1, autofit: 'grow', minRowSpan: 1, content: md('') },
      { id: 'W', kind: 'markdown', col: 0, row: 1, colSpan: 6, rowSpan: 1, autofit: 'off', minRowSpan: null, content: md('below') },
    ],
  });

  await page.goto(`/edit/${id}`);
  const G = page.locator(sel.block('G'));
  const W = page.locator(sel.block('W'));
  await expect(G).toBeVisible();
  await expect(W).toBeVisible();

  const wTopBase = (await W.boundingBox())!.y;

  // Activate G and type enough wrapped lines to force fit > floor.
  await G.click();
  const ta = page.locator(sel.activeMarkdownTextarea);
  await expect(ta).toBeVisible();
  await ta.fill(
    'line one is long enough to wrap inside a two-column block\n\n' +
      'line two paragraph\n\nline three paragraph\n\nline four paragraph',
  );

  // Debounced reconcile (150-300ms) re-pushes W down. Wait for the
  // grow: W's top must increase by at least one full slot.
  await expect
    .poll(async () => (await W.boundingBox())!.y, { timeout: 5_000 })
    .toBeGreaterThan(wTopBase + SLOT - 1);
  const wTopGrown = (await W.boundingBox())!.y;
  const gHeightGrown = (await G.boundingBox())!.height;
  expect(gHeightGrown).toBeGreaterThan(SLOT); // G itself grew past one row

  // Delete the content: G shrinks to floor, W returns to its base row
  // (C5 reconcile re-derives from the gesture base — reversible).
  await ta.fill('');
  await expect
    .poll(async () => (await W.boundingBox())!.y, { timeout: 5_000 })
    .toBeLessThan(wTopGrown - SLOT + 1);
  const wTopReturned = (await W.boundingBox())!.y;
  expect(Math.abs(wTopReturned - wTopBase)).toBeLessThan(2); // returned to base

  // Deactivate to fire the gesture commit (Escape → preview).
  await page.keyboard.press('Escape');
  await expect(G).not.toHaveAttribute('data-pu-active', /.*/);
});
