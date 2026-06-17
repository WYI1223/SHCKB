import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

const SLOT = 60; // theme.slot for graph-paper (verified in packages/theme/src)

/**
 * Fix-mode behaviors that are genuinely new under the follow/fix redesign
 * (design spec §3). follow blocks track content and clip; fix blocks hold
 * a fixed manual height, scroll their overflow, and expose a vertical
 * resize handle. DOM hooks grounded in GridCanvas.tsx (the geometry box
 * `[data-block-id]` whose height = rowSpan*SLOT - 2*pad, the overflow-
 * owning `.skb-content-box`), overlays.tsx (`ResizeHandle` renders one
 * `[aria-label="Resize <axis>"]` div per axis, vertical/corner axes only
 * when `canResizeVertical` i.e. fix), and chrome/overlays.tsx (the
 * `menuitemcheckbox` named "Fixed height").
 */

test('fix block overflow scrolls inside the frame (published + editor)', async ({ page }) => {
  await loginViaApi(page);
  // F: a fix markdown block sized to 2 rows but holding far more content
  // than 2 rows can show → its content box must scroll, not grow.
  const tall = '## fixed and overflowing\n\n' + Array.from({ length: 20 }, (_, i) => `paragraph line number ${i + 1}`).join('\n\n');
  const { id, slug } = await createMarkdownPage(page.request, {
    title: 'autofit fix overflow',
    themeId: 'graph-paper',
    // layout-only fixture; gravity stability is not what this checks.
    gravityEnabled: false,
    blocks: [
      { id: 'F', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, autofit: 'fix', content: md(tall) },
    ],
  });

  // Published page: the host frame's `.skb-content-box` owns overflow.
  // fix → overflowY 'auto' and the content genuinely exceeds the box.
  await page.goto(`/notes/${slug}`);
  const pubBox = page.locator('.skb-content-box').filter({ hasText: 'fixed and overflowing' });
  await expect(pubBox).toBeVisible();
  expect(await pubBox.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  const pubOverflows = await pubBox.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(pubOverflows).toBe(true);

  // Editor: the inactive fix block scrolls inside the same `.skb-content-box`
  // (new behavior — only the published path handled overflow before).
  await page.goto(`/edit/${id}`);
  const F = page.locator(sel.block('F'));
  await expect(F).toBeVisible();
  const editBox = page.locator('[data-block-id="F"] .skb-content-box');
  await expect(editBox).toBeVisible();
  expect(await editBox.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  const editOverflows = await editBox.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(editOverflows).toBe(true);
});

test('follow → fix freezes at the current displayed height', async ({ page }) => {
  await loginViaApi(page);
  // G: a follow markdown block (1 row). Grow it by typing, commit, then
  // toggle to fix and assert its frozen rowSpan == the followed height.
  const { id } = await createMarkdownPage(page.request, {
    title: 'autofit freeze on switch',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      { id: 'G', kind: 'markdown', col: 0, row: 0, colSpan: 4, rowSpan: 1, autofit: 'follow', content: md('') },
    ],
  });

  await page.goto(`/edit/${id}`);
  const G = page.locator(sel.block('G'));
  await expect(G).toBeVisible();

  // Activate G and type enough wrapped lines to grow it past one row.
  await G.click();
  const ta = page.locator(sel.activeMarkdownTextarea);
  await expect(ta).toBeVisible();
  await ta.fill(
    'line one is long enough to wrap inside a four-column block\n\n' +
      'line two paragraph\n\nline three paragraph\n\nline four paragraph',
  );
  // Poll the live follow height until it grows past one row (absorbs the
  // debounced reconcile), THEN commit (Escape) — never snapshot a pre-grow frame.
  await expect
    .poll(async () => (await G.boundingBox())!.height, { timeout: 3_000 })
    .toBeGreaterThan(SLOT);
  await page.keyboard.press('Escape');
  await expect(G).not.toHaveAttribute('data-pu-active', /.*/);

  // The committed follow height (geometry box height = rowSpan*SLOT - 2*pad).
  const grownHeight = (await G.boundingBox())!.height;
  expect(grownHeight).toBeGreaterThan(SLOT); // it grew past one row while following

  // Toggle follow → fix via the inactive context menu. "Fixed height" is the
  // opt-in checkbox, so a following block shows it UNCHECKED; clicking it
  // switches to fix and must FREEZE the rowSpan at the displayed height
  // (no shrink-to-default, no re-measure).
  await G.click({ button: 'right' });
  const toggle = page.getByRole('menuitemcheckbox', { name: /fixed height/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();

  // rowSpan unchanged: the frozen fix height equals the followed height.
  // poll to absorb any re-layout frame; it must stay equal (not shrink).
  await expect
    .poll(async () => (await G.boundingBox())!.height, { timeout: 3_000 })
    .toBe(grownHeight);

  // Confirm the mode actually flipped: reopen the menu, "Fixed height" now checked.
  await G.click({ button: 'right' });
  const after = page.getByRole('menuitemcheckbox', { name: /fixed height/i });
  await expect(after).toBeVisible();
  await expect(after).toHaveAttribute('aria-checked', 'true');
});

test('fix exposes a bottom resize handle; follow does not', async ({ page }) => {
  await loginViaApi(page);
  // X = fix block (resizable on all axes), Y = follow block (height is
  // content-owned → no vertical/corner handles). Resize handles render
  // only on INACTIVE blocks, so neither is activated.
  const { id } = await createMarkdownPage(page.request, {
    title: 'autofit per-mode resize handle',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      { id: 'X', kind: 'markdown', col: 0, row: 0, colSpan: 4, rowSpan: 2, autofit: 'fix', content: md('fixed block') },
      { id: 'Y', kind: 'markdown', col: 0, row: 3, colSpan: 4, rowSpan: 2, autofit: 'follow', content: md('follow block') },
    ],
  });

  await page.goto(`/edit/${id}`);
  const X = page.locator(sel.block('X'));
  const Y = page.locator(sel.block('Y'));
  await expect(X).toBeVisible();
  await expect(Y).toBeVisible();

  // Horizontal handles exist for BOTH modes (width is resizable either way).
  await expect(X.locator('[aria-label="Resize right"]')).toHaveCount(1);
  await expect(Y.locator('[aria-label="Resize right"]')).toHaveCount(1);

  // The vertical/corner handles are the per-mode discriminator:
  // fix has them, follow omits them entirely.
  await expect(X.locator('[aria-label="Resize bottom"]')).toHaveCount(1);
  await expect(X.locator('[aria-label="Resize corner"]')).toHaveCount(1);
  await expect(Y.locator('[aria-label="Resize bottom"]')).toHaveCount(0);
  await expect(Y.locator('[aria-label="Resize corner"]')).toHaveCount(0);
});
