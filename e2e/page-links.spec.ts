/**
 * Cross-surface page-link navigation (MVP-10 §5 / Task 11).
 *
 * Run via the documented two-server procedure (see playwright.config.ts):
 *   terminal 1: SHCKB_DB_PATH=... PORT=3210 bun apps/server/src/index.ts
 *   terminal 2: SHCKB_API_TARGET=http://localhost:3210 bun x vite --port 5173 (cwd apps/web)
 *   then: playwright test e2e/page-links.spec.ts
 * DO NOT run playwright test directly without both servers running.
 *
 * This spec encodes the core MVP-10 bug fix: an internal link click in the
 * editor must client-side navigate (router push to /edit/:id) — NOT full-reload
 * to the published /notes/:slug view. The window.__noreload sentinel proves
 * no document reload occurred across the click.
 *
 * Content strategy: all blocks use `kind: 'markdown'` with `[go](/p/:id)` href.
 * MarkdownRenderView adds `data-skb-page` to any `/p/:id` link, so the delegated
 * click handler in EditorPage / ReadPage intercepts them correctly. No richtext
 * block fixtures are needed (richtext blocks would work identically; markdown is
 * simpler because the fixture helper already carries the `md()` helper and markdown
 * links produce the same `data-skb-page` attribute that the editor handler keys off).
 */
import { expect, test } from '@playwright/test';
import { BASE, createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

// ---------------------------------------------------------------------------
// Test 1 — Editor stays in editor, no full document reload
// ---------------------------------------------------------------------------
test('editor: link click navigates to /edit/:B client-side (no reload)', async ({ page }) => {
  await loginViaApi(page);

  // Page B: the link destination. Publish + make public so the server can serve it.
  const B = await createMarkdownPage(page.request, {
    title: 'page-links target B',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      { id: 'B1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, content: md('# Page B') },
    ],
  });

  // Page A: contains a markdown link to B via the /p/:id permalink.
  const A = await createMarkdownPage(page.request, {
    title: 'page-links source A',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      {
        id: 'A1',
        kind: 'markdown',
        col: 0,
        row: 0,
        colSpan: 6,
        rowSpan: 2,
        content: md(`[go to B](/p/${B.id})`),
      },
    ],
  });

  await page.goto(`/edit/${A.id}`);
  // Wait for the link-bearing block to be in the DOM.
  await expect(page.locator(sel.block('A1'))).toBeVisible();
  // The rendered markdown link gets data-skb-page injected by MarkdownRenderView.
  const link = page.locator(`a[data-skb-page="${B.id}"]`).first();
  await expect(link).toBeVisible();

  // Plant a sentinel: survives client-side navigation, dies on full document reload.
  await page.evaluate(() => { (window as unknown as Record<string, unknown>)['__noreload'] = 1; });

  // Click the internal link — EditorPage's delegated handler intercepts it.
  await link.click();

  // URL must become /edit/:B (same editor surface, different page id).
  await expect(page).toHaveURL(`/edit/${B.id}`);

  // Sentinel survived: no document reload happened.
  const sentinel = await page.evaluate(() => (window as unknown as Record<string, unknown>)['__noreload']);
  expect(sentinel).toBe(1);

  // The shell chrome (the editor header with the title input) is still mounted —
  // a full reload would unmount the React tree momentarily and re-mount it,
  // but the persistent SPA shell never disappears.
  await expect(page.locator('input[aria-label="Notepage title"]')).toBeVisible();
  // And page B's content block is now rendered.
  await expect(page.locator(sel.block('B1'))).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — Cross-page block jump: /edit/:B#blockId scrolls target into view
// ---------------------------------------------------------------------------
test('editor: cross-page link with block id lands on /edit/:B and scrolls block into view', async ({
  page,
}) => {
  await loginViaApi(page);

  // Page B: two blocks. The link targets the SECOND block (B_jump). At
  // 1280x720 (Desktop Chrome) minus the ~80px editor header the visible grid is
  // ~640px, so a target near the top would already be on screen on load — a
  // vacuous toBeInViewport. B_jump sits at row 16 (top = 16*SLOT(60)+pad ≈
  // 960px), WELL below the fold, with a tall (15-row) top block above so the
  // page genuinely scrolls. "In viewport AFTER click" is then a real scroll
  // signal, not the initial render state.
  const B = await createMarkdownPage(page.request, {
    title: 'page-links block-jump target',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      { id: 'B_top', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 15, content: md('## Top block\n\n' + 'filler line\n\n'.repeat(30)) },
      { id: 'B_jump', kind: 'markdown', col: 0, row: 16, colSpan: 6, rowSpan: 2, content: md('## Jump target block') },
    ],
  });

  // Page A: link to B's second block via /p/:B.id#B_jump
  const A = await createMarkdownPage(page.request, {
    title: 'page-links block-jump source',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      {
        id: 'A_src',
        kind: 'markdown',
        col: 0,
        row: 0,
        colSpan: 6,
        rowSpan: 1,
        content: md(`[jump to B#B_jump](/p/${B.id}#B_jump)`),
      },
    ],
  });

  await page.goto(`/edit/${A.id}`);
  await expect(page.locator(sel.block('A_src'))).toBeVisible();

  // The markdown renderer emits data-skb-page + data-skb-block for /p/:id#blockId hrefs.
  const link = page.locator(`a[data-skb-page="${B.id}"][data-skb-block="B_jump"]`).first();
  await expect(link).toBeVisible();

  await link.click();

  // URL = /edit/:B#B_jump. Asserting the FRAGMENT (not just the page id) confirms
  // the hash mechanism actually fired: resolveTarget → navigate('/edit/:B#B_jump')
  // → ReadPage/EditorPage scrollToHashTarget consumes the hash. A regression that
  // dropped the fragment would still reach page B but fail this.
  await expect(page).toHaveURL(new RegExp(`/edit/${B.id}#B_jump`));

  // The jump-target block must scroll into the visible viewport (it starts at
  // row 16 ≈ 960px, off-screen on load — so this is a genuine scroll signal).
  const jumpBlock = page.locator(sel.block('B_jump'));
  await expect(jumpBlock).toBeVisible();
  await expect(jumpBlock).toBeInViewport();
});

// ---------------------------------------------------------------------------
// Test 3 — Same-page block link = pure scroll, URL stays /edit/:A
// ---------------------------------------------------------------------------
test('editor: same-page block link scrolls without navigation', async ({ page }) => {
  await loginViaApi(page);

  // The self-referencing link needs the page's own id, which isn't known until after
  // createMarkdownPage. Strategy: create the page with a placeholder, then issue a
  // second PUT working-state + publish to inject the real self-link. This keeps the
  // fixture helper backward-compatible and avoids any extra abstraction.
  const jsonFetch = async (method: 'PUT' | 'POST', path: string, body: unknown) => {
    const r = await page.request.fetch(`${BASE}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify(body),
    });
    if (!r.ok()) throw new Error(`${method} ${path} -> ${r.status()}: ${await r.text()}`);
    return r.json() as Promise<unknown>;
  };

  // Initial creation with a placeholder link. A_far sits at row 16 (top ≈ 960px)
  // — WELL below the ~640px visible grid at 1280x720, so it starts off-screen. A
  // tall (15-row) source block above keeps the page scrollable. Only then is
  // "A_far in viewport after click" a real scroll signal, not its initial position.
  const A2 = await createMarkdownPage(page.request, {
    title: 'page-links same-page scroll',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      { id: 'A_src2', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 15, content: md('placeholder') },
      { id: 'A_far', kind: 'markdown', col: 0, row: 16, colSpan: 6, rowSpan: 2, content: md('## Far block') },
    ],
  });

  // Patch working-state to inject the self-referencing link now that A2.id is known
  // (same geometry; only A_src2's content gains the /p/:A2.id#A_far link).
  await jsonFetch('PUT', `/api/notepages/${A2.id}/working-state`, {
    title: 'page-links same-page scroll',
    gravityEnabled: false,
    blocks: [
      {
        id: 'A_src2',
        kind: 'markdown',
        col: 0, row: 0, colSpan: 6, rowSpan: 15,
        content: md(`[scroll to far block](/p/${A2.id}#A_far)\n\n` + 'filler line\n\n'.repeat(30)),
      },
      { id: 'A_far', kind: 'markdown', col: 0, row: 16, colSpan: 6, rowSpan: 2, content: md('## Far block') },
    ],
  });
  // Re-publish so the editor's preview reflects the updated working state.
  await jsonFetch('POST', `/api/notepages/${A2.id}/publish`, {});

  await page.goto(`/edit/${A2.id}`);
  await expect(page.locator(sel.block('A_src2'))).toBeVisible();

  // Rendered markdown: /p/:A2.id#A_far → data-skb-page=A2.id + data-skb-block=A_far
  const link = page.locator(`a[data-skb-page="${A2.id}"][data-skb-block="A_far"]`).first();
  await expect(link).toBeVisible();

  // A_far must START off-screen — otherwise the post-click viewport check is vacuous.
  await expect(page.locator(sel.block('A_far'))).not.toBeInViewport();

  await link.click();

  // Let any router commit settle (a broken NAVIGATE path would push the route
  // asynchronously; a synchronous url read could miss it).
  await page.waitForTimeout(400);

  // The TRUE discriminator between scroll and navigate is the URL FRAGMENT:
  // same-page block link → resolveTarget returns kind:'scroll' → scrollToBlock
  // only, the URL is NEVER touched (pathname stays /edit/:A2, NO #A_far hash).
  // A regression that fell through to the navigate branch would instead produce
  // /edit/:A2#A_far. So assert both: exact pathname AND an EMPTY hash.
  const url = new URL(page.url());
  expect(url.pathname).toBe(`/edit/${A2.id}`);
  expect(url.hash).toBe('');

  // And the scroll actually happened: A_far is now in the viewport.
  await expect(page.locator(sel.block('A_far'))).toBeInViewport();
});

// ---------------------------------------------------------------------------
// Test 4 — Public surface: link to B eventually lands on /notes/:B
//
// Architecture note: in the e2e setup (Vite dev server), /notes/:slug is a
// React SPA route — the SPA fetches /api/public/notes/:slug and re-renders
// via PublishedCanvas + MarkdownRenderView. MarkdownRenderView emits
// href="/p/:id" (not the materialized href that appears only in the static
// publishedHtml served by the production server). On the public surface,
// resolveTarget returns kind:'permalink' for a data-skb-page link, so
// makeLinkClickHandler calls window.location.assign('/p/:id'), which the
// Vite dev proxy forwards to the real server's 302 → /notes/:B.slug.
//
// The __noreload sentinel does NOT survive this path (it's a real redirect).
// What we can assert: (a) clicking the link lands on /notes/:B.slug, and
// (b) B's content is visible. The "client-side, no reload" path for the
// public surface is the production code path (materialized href in static
// publishedHtml) and is verified by the unit tests in
// apps/server/test/materialize-links.test.ts + nav/__tests__/navigateToPage.
// ---------------------------------------------------------------------------
test('public: /notes/:A link to B resolves to /notes/:B (via /p/:id permalink)', async ({
  page,
}) => {
  // Admin login is needed to call the API to create pages.
  await loginViaApi(page);

  // Page B: the destination. Must be public+published for /p/:id → 302 to work.
  const B = await createMarkdownPage(page.request, {
    title: 'public-nav target B',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      { id: 'pubB1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, content: md('# Public B') },
    ],
  });

  // Page A: links to B via the /p/:id permalink.
  // In the SPA render, MarkdownRenderView preserves href="/p/:B.id" and adds data-skb-page.
  const A = await createMarkdownPage(page.request, {
    title: 'public-nav source A',
    themeId: 'graph-paper',
    gravityEnabled: false,
    blocks: [
      {
        id: 'pubA1',
        kind: 'markdown',
        col: 0,
        row: 0,
        colSpan: 6,
        rowSpan: 1,
        content: md(`[go to public B](/p/${B.id})`),
      },
    ],
  });

  // Visit the published public page of A (SPA route via Vite).
  await page.goto(`/notes/${A.slug}`);
  await expect(page.locator('.skb-md')).toBeVisible();

  // The SPA render emits data-skb-page on the link.
  const link = page.locator(`a[data-skb-page="${B.id}"]`).first();
  await expect(link).toBeVisible();

  // Clicking routes through window.location.assign('/p/:B.id') → Vite proxies to
  // server → 302 → /notes/:B.slug. Allow navigation to happen.
  await link.click();

  // Final URL must be /notes/:B.slug (the public surface, not the editor).
  await expect(page).toHaveURL(`/notes/${B.slug}`);

  // B's content is rendered on arrival.
  await expect(page.locator('.skb-md').filter({ hasText: 'Public B' })).toBeVisible();

  // Surface invariant: the public route never shows the editor chrome.
  await expect(page.locator('input[aria-label="Notepage title"]')).toHaveCount(0);
});
