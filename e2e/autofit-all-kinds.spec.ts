import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, sel } from './fixtures/login';

/**
 * T14 — per-kind autofit policy (follow/fix redesign). The "follow
 * content" toggle must appear for any kind that can follow (code, text:
 * `BlockKindModule.autofit.canFollow !== false`) and be ABSENT for a
 * fix-only kind (image, `autofit.canFollow === false`).
 *
 * Scope: this verifies the per-kind AVAILABILITY at the UI. The follow
 * MECHANISM itself is kind-agnostic and already covered by
 * autofit-follow.spec (markdown gesture) + the frame-invariant unit
 * suite (every theme × kind × skin). We deliberately do NOT assert
 * "code grows on load" — an inactive follow block renders at its stored
 * rowSpan; growth happens inside an active edit gesture, not on page load.
 */
test('follow toggle: present for code, absent for image', async ({ page }) => {
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
        autofit: 'follow',
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
        autofit: 'fix',
        // ImageContent: { blobHash: null; alt: string }
        content: { blobHash: null, alt: '' },
      },
    ],
  });

  await page.goto(`/edit/${id}`);

  // code → can follow → the "Fixed height" toggle is in the menu
  await page.locator(sel.block('C')).click({ button: 'right' });
  await expect(page.getByRole('menuitemcheckbox', { name: /fixed height/i })).toBeVisible();
  await page.keyboard.press('Escape');

  // image → fix-only (canFollow:false) → menu opens (edit item present) but no toggle.
  // Target the menu item by role: a bare getByText('edit') would also match the
  // sidebar's edit/preview mode toggle (MVP-10 spec §12), which is always mounted.
  await page.locator(sel.block('I')).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'edit' })).toBeVisible();
  await expect(page.getByRole('menuitemcheckbox', { name: /fixed height/i })).toHaveCount(0);
});
