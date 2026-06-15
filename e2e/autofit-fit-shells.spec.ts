import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

for (const themeId of ['graph-paper', 'ink', 'blueprint', 'workbench', 'galley', 'stationery', 'marginalia'] as const) {
  test(`fit matches live row count on ${themeId} shell (content fits, no clip)`, async ({ page }) => {
    await loginViaApi(page);
    const { id } = await createMarkdownPage(page.request, {
      title: `autofit fit · ${themeId}`,
      themeId,
      blocks: [
        { id: 'G', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, autofit: 'follow', content: md('') },
      ],
    });
    await page.goto(`/edit/${id}`);

    const G = page.locator(sel.block('G'));
    await G.click();
    const ta = page.locator(sel.activeMarkdownTextarea);
    await ta.fill(
      '# Heading\n\n' +
        'A paragraph long enough to wrap across the six-column width of this block, ' +
        'so that the measured fit must account for real wrapping at the real frame width.\n\n' +
        '- item one\n- item two\n- item three\n\n' +
        '> a blockquote line that also contributes a rendered row',
    );

    // Let the debounced reconcile settle, then commit (Escape).
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await expect(G).not.toHaveAttribute('data-pu-active', /.*/);

    // Inactive block shows the measured RenderView inside the real Frame.
    // fit == live row count => the content fits the committed geometry.
    // After the frame-core refactor every block renders as:
    //   .skb-frame-root > .skb-content-box (the overflow/clip owner)
    // The clip container is .skb-content-box, theme-agnostic.
    const clip = page.locator('[data-block-id="G"] .skb-content-box');
    await expect(clip).toBeVisible();
    const fits = await clip.evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
    expect(fits).toBe(true);
  });
}
