import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, sel } from './fixtures/login';

/**
 * T14 — per-kind autofit policy (frame-core refactor). After un-gating
 * autofit from markdown, the "auto height" toggle must appear for any kind
 * whose module is autofit-available (code, text) and be ABSENT for an
 * autofit-unavailable kind (image, `BlockKindModule.autofit === false`).
 *
 * Scope: this verifies the per-kind AVAILABILITY at the UI. The grow
 * MECHANISM itself is kind-agnostic and already covered by
 * autofit-grow-shrink.spec (markdown gesture) + the frame-invariant unit
 * suite (every theme × kind × skin). We deliberately do NOT assert
 * "code grows on load" — an inactive autofit block renders at its stored
 * rowSpan; growth happens inside an active edit gesture, not on page load.
 */
test('autofit toggle: present for code, absent for image', async ({ page }) => {
  await loginViaApi(page);
  const { id } = await createMarkdownPage(page.request, {
    title: 'autofit-all-kinds',
    themeId: 'graph-paper',
    // Layout-only fixture; gravity stability is not what this test checks.
    gravityEnabled: false,
    blocks: [
      {
        id: 'C',
        kind: 'code',
        col: 0,
        row: 0,
        colSpan: 6,
        rowSpan: 2,
        autofit: 'grow',
        minRowSpan: 1,
        // CodeContent: { language: string; source: string }
        content: { language: 'typescript', source: 'const x = 1;\n'.repeat(8) },
      },
      {
        id: 'I',
        kind: 'image',
        col: 0,
        row: 3,
        colSpan: 4,
        rowSpan: 3,
        autofit: 'off',
        minRowSpan: null,
        // ImageContent: { blobHash: null; alt: string }
        content: { blobHash: null, alt: '' },
      },
    ],
  });

  await page.goto(`/edit/${id}`);

  // code → autofit available → the "auto height" toggle is in the menu
  await page.locator(sel.block('C')).click({ button: 'right' });
  await expect(page.getByRole('menuitemcheckbox', { name: /auto height/i })).toBeVisible();
  await page.keyboard.press('Escape');

  // image → autofit unavailable → menu opens (edit item present) but no toggle
  await page.locator(sel.block('I')).click({ button: 'right' });
  await expect(page.getByText('edit', { exact: true })).toBeVisible();
  await expect(page.getByRole('menuitemcheckbox', { name: /auto height/i })).toHaveCount(0);
});
