import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, sel } from './fixtures/login';

/**
 * T14 — autofit across block kinds (frame-core refactor).
 *
 * Asserts:
 * 1. A `code` block with autofit:'grow' and ~12 lines of source grows
 *    taller than a single row (boundingBox height > 60 px).
 * 2. An `image` block (autofit unavailable) shows NO "auto height" item
 *    in its right-click context menu.
 *
 * Content shapes match the kind modules exactly:
 *   code  → { language: string; source: string }   (code.ts createContent)
 *   image → { blobHash: null; alt: string }         (image.ts createContent)
 *
 * Richtext is omitted here — its ProseMirror doc shape is tested in
 * unit tests; the core assertions (code grows, image no toggle) are
 * kind-coverage-complete for this slice.
 */
test('autofit grows code block; image block has no auto-height toggle', async ({ page }) => {
  await loginViaApi(page);

  // ~12 lines of TypeScript source — enough to require multiple rows at
  // any reasonable grid row height, so boundingBox.height > 60 px is safe.
  const codeSource = [
    'function fibonacci(n: number): number {',
    '  if (n <= 1) return n;',
    '  let a = 0;',
    '  let b = 1;',
    '  for (let i = 2; i <= n; i++) {',
    '    const tmp = a + b;',
    '    a = b;',
    '    b = tmp;',
    '  }',
    '  return b;',
    '}',
    '',
    'console.log(fibonacci(10));',
  ].join('\n');

  const { id } = await createMarkdownPage(page.request, {
    title: 'autofit-all-kinds',
    themeId: 'graph-paper',
    blocks: [
      {
        id: 'C',
        kind: 'code',
        col: 0,
        row: 0,
        colSpan: 6,
        rowSpan: 1,
        autofit: 'grow',
        minRowSpan: 1,
        // CodeContent: { language: string; source: string }
        content: { language: 'typescript', source: codeSource },
      },
      {
        id: 'I',
        kind: 'image',
        col: 0,
        row: 4,
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

  // --- assertion 1: code block grew beyond a single row ---
  const C = page.locator(sel.block('C'));
  await expect(C).toBeVisible();
  const cBox = await C.boundingBox();
  expect(cBox).not.toBeNull();
  expect(cBox!.height).toBeGreaterThan(60);

  // --- assertion 2: image block has no "auto height" in its context menu ---
  await page.locator(sel.block('I')).click({ button: 'right' });
  await expect(page.getByText('auto height')).toHaveCount(0);
});
