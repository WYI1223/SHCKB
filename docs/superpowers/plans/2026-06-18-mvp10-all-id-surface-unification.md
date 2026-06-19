# MVP-10 All-id Surface Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify the view surfaces into 4 (edit / view / read / note) addressed uniformly **by id (SSOT)**, make link navigation surface-preserving (read→read, no escape to the bare share), and retire the publish-time slug-materialization that all-id makes redundant.

**Architecture:** Two axes — audience (author·live {edit,view} / public·published {read,note}) × scope (read = whole-library in-Shell browse / note = single-page bare). All surface URLs become `/<surface>/:id`. `/p/:id` stays the surface-neutral in-content link string; the web delegated handler resolves it to `/<current-surface>/:id` (trivial: same surface + same id). The server serves published content by id and drops the `/p/:id`→`/notes/:slug` HTML rewrite (links stay `/p/:id`; the SPA routes them, no-JS falls back to the server 302→`/notes/:id`). `slug` stays a DB column (latent, for a future cosmetic alias) but leaves every URL.

**Tech Stack:** bun workspace monorepo; web = React + react-router-dom + vitest; server = Hono + drizzle (bun:sqlite) + `bun test`; static publish = react-dom/server (`@skb/block-kinds/static`); e2e = Playwright.

**Spec:** `docs/superpowers/specs/2026-06-17-mvp10-view-mode-unification-design.md` (§4 / §5 / §8, 2026-06-18 订正). Discussion: `docs/engineering/design/discussions/mvp10-scope-2026-06-17.md` (M10-D14/D15).

**Pre-req — bun:** `bun` is at `C:/Users/W_YI1/.bun/bin/bun.exe` (on PATH for subagents). Tests use a throwaway DB; **never** the dev库 (`data/dev.db`). The dev server may be running on :3000/:5173 — do NOT run the live e2e (Task 10) while it is up (port 5173 collision → e2e would write into the dev库); stop it first.

---

## File Structure

**Server (`apps/server`)** — serve by id, remove materialization:
- `src/routes/notepages.ts` — publish + theme-pin write sites (drop materialize); `/public/notes/:slug`→`:id`; `/public/notes` dir +id; `publicHtmlRoutes` `/notes/:slug`→`:id` and `/p/:id`→`/notes/:id`.
- `src/render/publish-html.ts` — **delete** `materializeInternalLinks` + `publicIdToSlug`.
- `src/settings.ts` — `rerenderAllPublished` drop materialize.
- `src/export/importer.ts` — drop materialize.
- `src/routes/tree.ts` — public projection exposes `id`.

**block-kinds (`packages/block-kinds`):**
- `src/static.ts` — `renderStaticPage` canonical `/notes/:slug`→`/notes/:id` (rename param `slug`→`id`).

**Web (`apps/web`):**
- `src/nav/useNavigateToPage.ts` — `surfaceOf` 4 cases; `resolveTarget` all-id trivial (drop `permalink`); `useNavigateToPage` drop `window.location.assign`; `makeLinkClickHandler` drop `toPath`.
- `src/api/client.ts` — `getPublicNote(id)`; `PublicTreePage` +`id`.
- `src/main.tsx` — `/read/:slug`→`:id`, `/notes/:slug`→`:id`.
- `src/pages/ReadPage.tsx` — by id; drop `toPath`; scroll-restore by id+surface.
- `src/grid/GridCanvas.tsx` — copy-link → path form (Q2).

**Tests:**
- `apps/web/src/nav/__tests__/navigateToPage.test.ts` — rewrite resolveTarget/surfaceOf cases.
- `apps/server/test/` — public-by-id + no-materialization; delete `materialize-links.test.ts` if present.
- `e2e/page-links.spec.ts` — all-id + read→read.

**Docs (downstream):**
- `tools/block-doc-art/src/11-materialize.html` (F5) + `12-e2e-lesson.html` (F6) + re-seed via `apps/server/scripts/seed-view-system-doc.ts`.

---

## Phase 1 — Server: serve by id, drop slug-materialization

> **Phase-1 test harness.** Server tests use `createTestContext` from `apps/server/test/helpers.ts` — returns `TestContext = { db, app, blobStore, cookie, authed }` over an **in-memory** DB — plus the `json(res)` helper. Authed API calls: `t.authed('/api/...', init)` (cookie + JSON header attached). **Unauthenticated public routes need the full origin**: `t.app.request('http://localhost/<path>')`. `app.request` returns the raw `Response` (a 302 is `status===302` + a `location` header; it does NOT auto-follow). Define this create helper once per new test file:
> ```ts
> import { createTestContext, json, type TestContext } from './helpers';
> async function createPublicPage(t: TestContext, opts: { title: string; body: string }) {
>   const { id } = await json(await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: opts.title }) }));
>   await t.authed(`/api/notepages/${id}/working-state`, { method: 'PUT', body: JSON.stringify({
>     title: opts.title, gravityEnabled: false,
>     blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, shell: null, content: { markdown: opts.body } }],
>   }) });
>   await t.authed(`/api/notepages/${id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'graph-paper' }) });
>   const { slug } = await json(await t.authed(`/api/notepages/${id}/publish`, { method: 'POST' }));
>   await t.authed(`/api/notepages/${id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
>   return { id, slug };
> }
> ```

### Task 1: `renderStaticPage` canonical link by id

**Files:**
- Modify: `packages/block-kinds/src/static.ts:20-31`
- Test: `packages/block-kinds/test/static.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `packages/block-kinds/test/static.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { renderStaticPage } from '../src/static';
import { graphPaper } from '@skb/theme';

const doc = { title: 'Hi', blocks: [] } as any;

describe('renderStaticPage canonical', () => {
  test('canonical href is the id-based /notes/:id', () => {
    const html = renderStaticPage(doc, 'abc123', graphPaper);
    expect(html).toContain('<link rel="canonical" href="/notes/abc123">');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (current code emits the slug arg, but the arg will now be the page id; this pins the contract that the 2nd arg is an id and lands in `/notes/:id`).

Run: `cd apps/server && bun test ../../packages/block-kinds/test/static.test.ts` — Expected: PASS already *iff* the arg is treated as id. The real change is at the CALL SITES (Tasks 2-4) which now pass `page.id`. Rename the param for clarity:

- [ ] **Step 3: Rename the param `slug`→`id`** in `packages/block-kinds/src/static.ts`:
```ts
export function renderStaticPage(doc: PublishedDocShape, id: string, theme: Theme): string {
  // ...
  `<link rel="canonical" href="/notes/${escapeHtml(id)}">`
  // ...
}
```
(Body otherwise unchanged. The JSDoc line 4 `renderStaticPage(publishedDoc, slug, ...)` → `(publishedDoc, id, ...)`.)

- [ ] **Step 4: Run the test — expect PASS.**

Run: `cd apps/server && bun test ../../packages/block-kinds/test/static.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add packages/block-kinds/src/static.ts packages/block-kinds/test/static.test.ts
git commit -m "refactor(mvp10): renderStaticPage canonical by id (all-id)"
```

### Task 2: Delete `materializeInternalLinks` + `publicIdToSlug`; un-wrap all call sites

**Files:**
- Modify: `apps/server/src/render/publish-html.ts:34-81` (delete two functions)
- Modify: `apps/server/src/routes/notepages.ts:18,242-245,290-293`
- Modify: `apps/server/src/settings.ts:20,72,80-83`
- Modify: `apps/server/src/export/importer.ts:14,278` (+ remove its local `idToSlug` build)
- Test: `apps/server/test/no-materialize.test.ts` (create)

- [ ] **Step 1: Write the failing test** — `apps/server/test/no-materialize.test.ts` (read the page row from `t.db` — route-independent, so it does not depend on Task 3's id-routes):
```ts
import { describe, expect, test } from 'bun:test';
import { createTestContext } from './helpers';
import { notepages } from '../src/db/schema';
import { eq } from 'drizzle-orm';
// + the `createPublicPage` helper from the Phase-1 harness note above

describe('published HTML keeps /p/:id (no slug-materialization)', () => {
  test('publish leaves internal /p/:id content hrefs intact', async () => {
    const t = await createTestContext();
    const B = await createPublicPage(t, { title: 'B', body: '# B' });
    const A = await createPublicPage(t, { title: 'A', body: `[go](/p/${B.id})` });
    const row = t.db.select().from(notepages).where(eq(notepages.id, A.id)).get()!;
    expect(row.publishedHtml).toContain(`href="/p/${B.id}"`); // content link NOT rewritten to a slug
  });
});
```
> The assertion targets the CONTENT link (`href="/p/:B.id"`). Note the page's own `<link rel="canonical" href="/notes/:id">` legitimately contains `/notes/` (Task 1) — that's why we assert the specific `href="/p/..."`, not the absence of `/notes/`.

- [ ] **Step 2: Run it — expect FAIL** (today materialization rewrites `/p/:B`→`/notes/:slugB`).

Run: `cd apps/server && bun test test/no-materialize.test.ts` — Expected: FAIL (`publishedHtml` contains `/notes/...`).

- [ ] **Step 3: Delete the two functions** in `apps/server/src/render/publish-html.ts` — remove lines 34-81 (`materializeInternalLinks` + `publicIdToSlug` + their JSDoc and the now-unused `eq`, `notepages` imports if they become unused — check; `toRenderDoc` stays).

- [ ] **Step 4: Un-wrap the 4 call sites.**

`apps/server/src/routes/notepages.ts`:
- L18 import → `import { NOT_FOUND_HTML, renderStaticPage, toRenderDoc } from '../render/publish-html';`
- publish route L242-245 →
```ts
    const html = renderStaticPage(toRenderDoc(doc), page.id, effectiveTheme(db, page));
```
- theme-pin route L290-293 →
```ts
        const html = renderStaticPage(toRenderDoc(doc), page.id, effectiveTheme(db, { themeId }));
```

`apps/server/src/settings.ts`:
- L20 import → `import { renderStaticPage, toRenderDoc } from './render/publish-html';`
- delete L72 `const idToSlug = publicIdToSlug(db);` (and its comment L66-71 referencing it)
- L80-83 →
```ts
    const html = renderStaticPage(toRenderDoc(doc), page.id, effectiveTheme(db, page));
```

`apps/server/src/export/importer.ts`:
- L14 import → `import { renderStaticPage, toRenderDoc } from '../render/publish-html';`
- find where the importer builds its own `idToSlug` map (grep `idToSlug` in this file) and delete it
- L278 →
```ts
              : renderStaticPage(toRenderDoc(published), page.id, themeFor(page.themeId)),
```

- [ ] **Step 5: Run the test + the full server suite — expect PASS.**

Run: `cd apps/server && bun test test/no-materialize.test.ts` — Expected: PASS.
Run: `cd apps/server && bun test` — Expected: existing materialize tests now FAIL (they assert the old rewrite). **Delete** `apps/server/test/materialize-links.test.ts` (and any test asserting `/p/:id`→`/notes/:slug` materialization). Re-run `bun test` — Expected: all PASS.

- [ ] **Step 6: Commit**
```bash
git add apps/server/src/render/publish-html.ts apps/server/src/routes/notepages.ts apps/server/src/settings.ts apps/server/src/export/importer.ts apps/server/test/no-materialize.test.ts
git rm apps/server/test/materialize-links.test.ts 2>/dev/null || true
git commit -m "refactor(mvp10): drop publish-time slug-materialization (all-id makes it redundant)"
```

### Task 3: Public read served by id

**Files:**
- Modify: `apps/server/src/routes/notepages.ts:353-365` (`/public/notes` dir +id), `:376-390` (`/public/notes/:slug`→`:id`), `:402-408` (`/notes/:slug`→`:id`), `:414-420` (`/p/:id`→`/notes/:id`)
- Test: `apps/server/test/public-by-id.test.ts` (create)

- [ ] **Step 1: Write the failing test** — `apps/server/test/public-by-id.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { createTestContext, json } from './helpers';
// + the `createPublicPage` helper from the Phase-1 harness note
const REQ = (t: Awaited<ReturnType<typeof createTestContext>>, path: string) =>
  t.app.request(`http://localhost${path}`); // public routes: full origin, no auth

describe('public read by id', () => {
  test('GET /api/public/notes/:id returns the published doc', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await REQ(t, `/api/public/notes/${p.id}`);
    expect(res.status).toBe(200);
    expect((await json(res)).doc.title).toBe('P');
  });
  test('GET /notes/:id serves published HTML', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await REQ(t, `/notes/${p.id}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('canonical');
  });
  test('GET /p/:id 302s to /notes/:id', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await REQ(t, `/p/${p.id}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`/notes/${encodeURIComponent(p.id)}`);
  });
  test('unpublished id → 404 (no-leak)', async () => {
    const t = await createTestContext();
    const { id } = await json(await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'D' }) }));
    expect((await REQ(t, `/api/public/notes/${id}`)).status).toBe(404);
    expect((await REQ(t, `/p/${id}`)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (routes are by slug today).

Run: `cd apps/server && bun test test/public-by-id.test.ts` — Expected: FAIL (404s — `:id` is being matched against the `slug` column).

- [ ] **Step 3: Switch the routes to id.**

`apps/server/src/routes/notepages.ts`:
- `/public/notes/:slug` (L376) →
```ts
  r.get('/public/notes/:id', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page || page.visibility !== 'public' || page.publishedDoc === null) {
      return c.json(NOT_FOUND, 404);
    }
    const doc = safeParse<PublishedDoc | null>(page.publishedDoc, null);
    if (doc === null) return c.json({ error: 'published snapshot is corrupt — re-publish the page' }, 500);
    const themeId = effectiveTheme(db, page).id;
    return c.json({ id: page.id, slug: page.slug, theme: themeId, customization: themeCustomizations(db)[themeId] ?? null, doc });
  });
```
- `/public/notes` dir (L353-365): add `id` to each note —
```ts
        return doc === null ? null : { id: p.id, slug: p.slug, title: doc.title, publishedAt: doc.publishedAt };
```
- `publicHtmlRoutes` `/notes/:slug` (L402) →
```ts
  r.get('/notes/:id', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page || page.visibility !== 'public' || page.publishedHtml === null) {
      return c.html(NOT_FOUND_HTML, 404);
    }
    return c.html(page.publishedHtml);
  });
```
- `/p/:id` (L414-419) → redirect to id:
```ts
  r.get('/p/:id', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page || page.visibility !== 'public' || page.publishedHtml === null) {
      return c.html(NOT_FOUND_HTML, 404);
    }
    return c.redirect(`/notes/${encodeURIComponent(page.id)}`, 302);
  });
```

- [ ] **Step 4: Run the test + full suite — expect PASS.**

Run: `cd apps/server && bun test test/public-by-id.test.ts` — Expected: PASS.
Run: `cd apps/server && bun test` — Expected: all PASS (fix any other test that requested `/notes/:slug` or `/public/notes/:slug` — switch them to `:id`).

- [ ] **Step 5: Commit**
```bash
git add apps/server/src/routes/notepages.ts apps/server/test/public-by-id.test.ts
git commit -m "refactor(mvp10): serve public read by id (/notes/:id, /public/notes/:id, /p/:id->/notes/:id)"
```

### Task 4: Public tree exposes `id`

**Files:**
- Modify: `apps/server/src/routes/tree.ts:151-160`
- Test: `apps/server/test/public-tree-id.test.ts` (create)

- [ ] **Step 1: Write the failing test** — `apps/server/test/public-tree-id.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { createTestContext, json } from './helpers';
// + the `createPublicPage` helper from the Phase-1 harness note

describe('public tree carries id', () => {
  test('each public-tree page has an id', async () => {
    const t = await createTestContext();
    const p = await createPublicPage(t, { title: 'P', body: '# P' });
    const res = await t.app.request('http://localhost/api/public/tree');
    expect((await json(res)).notepages.some((n: any) => n.id === p.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (public tree returns `{slug,title,folderId,sortKey}`, no id).

Run: `cd apps/server && bun test test/public-tree-id.test.ts` — Expected: FAIL.

- [ ] **Step 3: Add `id`** to the public projection in `apps/server/src/routes/tree.ts:151-160`:
```ts
    const publishedPages = ps
      .filter((p) => p.publishedDoc !== null)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: safeParse<PublishedDoc | null>(p.publishedDoc!, null)?.title ?? p.title,
        folderId: p.folderId,
        sortKey: p.sortKey,
      }));
```

- [ ] **Step 4: Run the test — expect PASS.**

Run: `cd apps/server && bun test test/public-tree-id.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/server/src/routes/tree.ts apps/server/test/public-tree-id.test.ts
git commit -m "refactor(mvp10): public tree exposes page id (for /read/:id)"
```

---

## Phase 2 — Web: 4-surface all-id navigation

### Task 5: `surfaceOf` (4 surfaces) + `resolveTarget` (all-id, trivial)

**Files:**
- Modify: `apps/web/src/nav/useNavigateToPage.ts:14-63`
- Test: `apps/web/src/nav/__tests__/navigateToPage.test.ts` (rewrite the resolveTarget/surfaceOf cases)

- [ ] **Step 1: Write the failing tests** — replace the surfaceOf/resolveTarget cases in `navigateToPage.test.ts` with:
```ts
import { describe, expect, test } from 'vitest';
import { resolveTarget, surfaceOf } from '../useNavigateToPage';

describe('surfaceOf', () => {
  test.each([
    ['/edit/A', 'edit'], ['/view/A', 'view'], ['/read/A', 'read'],
    ['/notes/A', 'note'], ['/', 'other'], ['/login', 'other'],
  ])('%s -> %s', (path, s) => expect(surfaceOf(path)).toBe(s));
});

describe('resolveTarget (all-id, surface-preserving)', () => {
  test('edit -> /edit/:id', () =>
    expect(resolveTarget('/edit/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/edit/B' }));
  test('view -> /view/:id', () =>
    expect(resolveTarget('/view/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/view/B' }));
  test('read stays read (not note)', () =>
    expect(resolveTarget('/read/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/read/B' }));
  test('note stays note', () =>
    expect(resolveTarget('/notes/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/notes/B' }));
  test('other defaults to view', () =>
    expect(resolveTarget('/', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/view/B' }));
  test('cross-page block adds #blockId', () =>
    expect(resolveTarget('/read/A', { pageId: 'B', blockId: 'b1' })).toEqual({ kind: 'navigate', to: '/read/B#b1' }));
  test('same-page block -> pure scroll (any surface, by id)', () =>
    expect(resolveTarget('/read/A', { pageId: 'A', blockId: 'b1' })).toEqual({ kind: 'scroll', blockId: 'b1' }));
  test('encodes id + blockId', () =>
    expect(resolveTarget('/edit/A', { pageId: 'p/x', blockId: 'b#1' }))
      .toEqual({ kind: 'navigate', to: '/edit/p%2Fx#b%231' }));
});
```

- [ ] **Step 2: Run them — expect FAIL** (old surfaceOf returns 'editor'/'public'; old resolveTarget has a 'permalink' kind and collapses read+note).

Run: `cd apps/web && bun run test -- navigateToPage` — Expected: FAIL.

- [ ] **Step 3: Rewrite `surfaceOf` + `resolveTarget` + `NavAction` + `Surface`** in `apps/web/src/nav/useNavigateToPage.ts` (replace lines 14-63):
```ts
export type Surface = 'edit' | 'view' | 'read' | 'note' | 'other';

export function surfaceOf(pathname: string): Surface {
  if (pathname.startsWith('/edit/')) return 'edit';
  if (pathname.startsWith('/view/')) return 'view';
  if (pathname.startsWith('/read/')) return 'read';
  if (pathname.startsWith('/notes/')) return 'note';
  return 'other';
}

function currentId(pathname: string): string {
  return decodeURIComponent(pathname.split('/')[2] ?? '');
}

export type NavAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'scroll'; blockId: string };

const ROUTE_OF: Record<Exclude<Surface, 'other'>, string> = {
  edit: '/edit',
  view: '/view',
  read: '/read',
  note: '/notes',
};

/** Pure resolver (unit-tested). All surfaces address by id (SSOT); resolution
 * is "same surface + same id". Same-page block target = pure scroll, no nav.
 * `other` falls back to the in-app draft preview (view). */
export function resolveTarget(pathname: string, ref: LinkRef): NavAction {
  const surface = surfaceOf(pathname);
  if (surface !== 'other' && ref.blockId && ref.pageId === currentId(pathname)) {
    return { kind: 'scroll', blockId: ref.blockId };
  }
  const hash = ref.blockId ? `#${encodeURIComponent(ref.blockId)}` : '';
  const base = surface === 'other' ? '/view' : ROUTE_OF[surface];
  return { kind: 'navigate', to: `${base}/${encodeURIComponent(ref.pageId)}${hash}` };
}

export function useNavigateToPage(): (ref: LinkRef) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (ref: LinkRef) => {
      const action = resolveTarget(pathname, ref);
      if (action.kind === 'scroll') scrollToBlock(action.blockId);
      else navigate(action.to);
    },
    [navigate, pathname],
  );
}
```
> `permalinkOf` import (used only by the old `permalink` branch) is now unused in this file — remove it from the import on line 11 (`import { parsePermalink, type LinkRef } from '@skb/block-kinds';`). `parsePermalink` is still used by `makeLinkClickHandler` (Task 6).

- [ ] **Step 4: Run the tests — expect PASS.**

Run: `cd apps/web && bun run test -- navigateToPage` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/nav/useNavigateToPage.ts apps/web/src/nav/__tests__/navigateToPage.test.ts
git commit -m "feat(mvp10): 4-surface all-id resolveTarget (read->read, no permalink branch)"
```

### Task 6: `makeLinkClickHandler` — drop the `toPath`/materialized branch

**Files:**
- Modify: `apps/web/src/nav/useNavigateToPage.ts:65-96`
- Test: `apps/web/src/nav/__tests__/navigateToPage.test.ts` (add handler cases)

- [ ] **Step 1: Write the failing test** — append to `navigateToPage.test.ts`:
```ts
import { makeLinkClickHandler } from '../useNavigateToPage';

function fakeClick(href: string, attrs: Record<string, string> = {}) {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  document.body.appendChild(a);
  let prevented = false;
  return {
    a,
    ev: { target: a, button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: () => { prevented = true; } } as any,
    get prevented() { return prevented; },
  };
}

describe('makeLinkClickHandler (single arg, no toPath)', () => {
  test('data-skb-page link -> nav(ref) + preventDefault', () => {
    const seen: any[] = [];
    const h = makeLinkClickHandler((r) => seen.push(r));
    const c = fakeClick('/p/B', { 'data-skb-page': 'B', 'data-skb-block': 'b1' });
    h(c.ev);
    expect(seen).toEqual([{ pageId: 'B', blockId: 'b1' }]);
    expect(c.prevented).toBe(true);
  });
  test('bare /p/:id link -> parsed ref', () => {
    const seen: any[] = [];
    const h = makeLinkClickHandler((r) => seen.push(r));
    h(fakeClick('/p/B').ev);
    expect(seen).toEqual([{ pageId: 'B' }]);
  });
  test('external link -> ignored', () => {
    const seen: any[] = [];
    const h = makeLinkClickHandler((r) => seen.push(r));
    const c = fakeClick('https://example.com');
    h(c.ev);
    expect(seen).toEqual([]);
    expect(c.prevented).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (handler currently takes a 2nd `toPath` arg and has the `/notes/` branch — signature/behavior mismatch will not fail compile but the test pins the new single-arg shape; if TS complains about arity it still runs).

Run: `cd apps/web && bun run test -- navigateToPage` — Expected: FAIL or the `/notes/` branch present.

- [ ] **Step 3: Replace `makeLinkClickHandler`** (lines 65-96) with the single-arg form:
```ts
/** A delegated click handler: any click on a rendered internal link
 * (a[data-skb-page], or a[href^="/p/"] fallback) routes through navigateToPage,
 * client-side. New-tab / modified clicks pass through. All-id: there is no
 * materialized-slug form anymore, so no per-surface href rewriting here — the
 * surface is resolved by navigateToPage from the current pathname. */
export function makeLinkClickHandler(nav: (ref: LinkRef) => void) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    const pageId = a.getAttribute('data-skb-page');
    const ref: LinkRef | null = pageId
      ? { pageId, ...(a.getAttribute('data-skb-block') ? { blockId: a.getAttribute('data-skb-block')! } : {}) }
      : parsePermalink(href);
    if (!ref) return;
    e.preventDefault();
    nav(ref);
  };
}
```

- [ ] **Step 4: Run the test — expect PASS.**

Run: `cd apps/web && bun run test -- navigateToPage` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/nav/useNavigateToPage.ts apps/web/src/nav/__tests__/navigateToPage.test.ts
git commit -m "refactor(mvp10): simplify makeLinkClickHandler to single-arg (all-id, no toPath)"
```

---

## Phase 3 — Web: routes + ReadPage + API by id

### Task 7: API client — `getPublicNote(id)` + `PublicTreePage.id`

**Files:**
- Modify: `apps/web/src/api/client.ts:95,185-188`
- Test: typecheck only (the contract is enforced by callers in Task 8)

- [ ] **Step 1: Update the type + the call** in `apps/web/src/api/client.ts`:
- L95 →
```ts
export type PublicTreePage = { id: string; slug: string; title: string; folderId: string | null; sortKey: number };
```
- L185-188 →
```ts
  getPublicNote: (id: string) =>
    request<{ id: string; slug: string; theme: string; customization: ThemeCustomization | null; doc: PublishedDoc }>(
      `/api/public/notes/${encodeURIComponent(id)}`,
    ),
```
- If a `getPublicNotes` (directory) type exists and is consumed, add `id: string` to its item type.

- [ ] **Step 2: Run web typecheck — expect FAIL** at `ReadPage.tsx` (still passes `slug`).

Run: `cd apps/web && bun run typecheck` — Expected: FAIL at ReadPage (fixed in Task 8).

- [ ] **Step 3:** (no code beyond the edit above; the failure is resolved by Task 8.)

- [ ] **Step 4: Commit** (defer commit to end of Task 8 so the tree typechecks; OR commit together).

### Task 8: Routes `/read/:id` `/notes/:id` + ReadPage by id

**Files:**
- Modify: `apps/web/src/main.tsx:21,25`
- Modify: `apps/web/src/pages/ReadPage.tsx:24-43,82-107`
- Test: covered by typecheck + e2e (Task 10); add a light render check is optional.

- [ ] **Step 1: Update routes** in `apps/web/src/main.tsx`:
```tsx
          <Route path="/read/:id" element={<ReadPage />} />
```
and
```tsx
        <Route path="/notes/:id" element={<ReadPage />} />
```

- [ ] **Step 2: Rewrite `ReadPage`** to fetch by id, drop `toPath`, scroll-restore by id+surface. In `apps/web/src/pages/ReadPage.tsx`:
- params: `const { id } = useParams<{ id: string }>();`
- handler: `const onLinkClick = useMemo(() => makeLinkClickHandler(navigateToPage), [navigateToPage]);` (drop the `(p) => navigate(p)` 2nd arg; `navigate` import may become unused — remove it)
- scroll-restore: `const scrollRef = useScrollRestore(id ?? '', surfaceOf(useLocation().pathname) === 'note' ? 'note' : 'read');`
  - import `surfaceOf` from `../nav/useNavigateToPage`; `useLocation` is already imported (it also provides `hash`).
- fetch: replace `api.getPublicNote(slug)` with `api.getPublicNote(id)`; the effect dep `[slug]` → `[id]`; the early `if (!slug) return;` → `if (!id) return;`.
- The `useScrollRestore` surface arg type may need to accept `'read' | 'note'` — see Task 8b.

Concretely, the effect + handler block becomes:
```tsx
export function ReadPage() {
  const { id } = useParams<{ id: string }>();
  const { pathname, hash } = useLocation();
  const [resp, setResp] = useState<{ doc: PublishedDoc; theme: string; customization: ThemeCustomization | null } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const navigateToPage = useNavigateToPage();
  const onLinkClick = useMemo(() => makeLinkClickHandler(navigateToPage), [navigateToPage]);
  const scrollRef = useScrollRestore(id ?? '', surfaceOf(pathname) === 'note' ? 'note' : 'read');

  useEffect(() => {
    if (!id) return;
    let active = true;
    setResp(null);
    setNotFound(false);
    api
      .getPublicNote(id)
      .then((r) => { if (active) setResp({ doc: r.doc, theme: r.theme, customization: r.customization }); })
      .catch((e: unknown) => { if (active && e instanceof ApiError && e.status === 404) setNotFound(true); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => { if (resp && hash) scrollToHashTarget(hash); }, [resp, hash]);
  // ...rest unchanged (message helpers, renderDoc, the <div ref={scrollRef} ... onClick={onLinkClick}> render)
}
```
- Add imports: `surfaceOf` from `../nav/useNavigateToPage`; remove `useNavigate` if now unused.

- [ ] **Step 2b: Widen `useScrollRestore` surface type** if it's a string-literal union. In `apps/web/src/nav/useScrollRestore.ts`, change the surface param type to include `'read' | 'note'` (it currently has `'edit' | 'view' | 'public'` per the position-layer design):
```ts
export function useScrollRestore(pageId: string, surface: 'edit' | 'view' | 'read' | 'note') { /* ... */ }
```
Update its call sites (EditorPage uses `'edit'`, InAppView uses `'view'` — unchanged; ReadPage now passes `'read'|'note'`).

- [ ] **Step 3: Run web typecheck + tests — expect PASS.**

Run: `cd apps/web && bun run typecheck` — Expected: PASS.
Run: `cd apps/web && bun run test` — Expected: PASS (77 existing + nav additions).

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/api/client.ts apps/web/src/main.tsx apps/web/src/pages/ReadPage.tsx apps/web/src/nav/useScrollRestore.ts
git commit -m "feat(mvp10): read/note routes + ReadPage by id (all-id surfaces)"
```

---

## Phase 4 — Q2: copy-link path form

### Task 9: "Copy link to block" copies the `/p/:id#blockId` path

**Files:**
- Modify: `apps/web/src/grid/GridCanvas.tsx:244-249`
- Test: none (DOM clipboard); pin via comment + e2e-optional

- [ ] **Step 1: Change the copy** in `apps/web/src/grid/GridCanvas.tsx`:
```tsx
            {
              label: 'Copy link to block',
              onSelect: () => {
                // Copy the PATH form (`/p/:id#blockId`) — the markdown/richtext
                // link parsers only recognise the path, not an app-origin full URL.
                void navigator.clipboard.writeText(permalinkOf({ pageId, blockId: block.id }));
              },
            },
```
(`permalinkOf` is already imported from `@skb/block-kinds` at the top of GridCanvas.tsx.)

- [ ] **Step 2: Run web typecheck — expect PASS.**

Run: `cd apps/web && bun run typecheck` — Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/grid/GridCanvas.tsx
git commit -m "fix(mvp10): copy-link-to-block copies /p/:id#blockId path (Q2)"
```

---

## Phase 5 — e2e (real browser)

### Task 10: page-links e2e — all-id + read→read; run live

**Files:**
- Modify: `e2e/page-links.spec.ts`, `e2e/fixtures/login.ts`

- [ ] **Step 1: Update the fixture** — `createMarkdownPage` already returns `{ id, slug }`. Tests will now assert id-based URLs. No fixture change needed beyond using `.id` (already does).

- [ ] **Step 2: Update Test 4 (public) to read→read** in `e2e/page-links.spec.ts`. Replace the public-surface test body to: visit `/read/:A.id`, click the internal link, assert the URL becomes `/read/:B.id` (NOT `/notes/...`), and B's content shows. Pattern:
```ts
test('read: link stays in /read (whole-library browse), by id', async ({ page }) => {
  await loginViaApi(page);
  const B = await createMarkdownPage(page.request, { title: 'read target B', themeId: 'graph-paper', gravityEnabled: false,
    blocks: [{ id: 'rB1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, content: md('# Read B') }] });
  const A = await createMarkdownPage(page.request, { title: 'read source A', themeId: 'graph-paper', gravityEnabled: false,
    blocks: [{ id: 'rA1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, content: md(`[go](/p/${B.id})`) }] });
  await page.goto(`/read/${A.id}`);
  await expect(page.locator('.skb-md')).toBeVisible();
  await page.locator(`a[data-skb-page="${B.id}"]`).first().click();
  await expect(page).toHaveURL(`/read/${B.id}`);                 // stayed in read, by id
  await expect(page.locator('.skb-md').filter({ hasText: 'Read B' })).toBeVisible();
});
```

- [ ] **Step 3: Editor tests (1-3)** already use `/edit/:id` + `/p/:id` and assert `/edit/:B.id` — they remain valid (the editor surface is unchanged by all-id). Keep them.

- [ ] **Step 4: Run the e2e LIVE** using the throwaway-DB two-server procedure (the dev server must be stopped first — port 5173 collision):
Run: `bash %TEMP%/run-e2e-pagelinks.sh` (the existing driver: server :3210 throwaway DB + vite :5173 + playwright; trap tears down). Expected: **4 passed**.
> If the dev server is on :5173, stop it first (`taskkill` the PID on 5173) and restart it afterward against `data/dev.db`.

- [ ] **Step 5: Commit**
```bash
git add e2e/page-links.spec.ts
git commit -m "test(mvp10): page-links e2e all-id + read->read"
```

---

## Phase 6 — Docs (downstream, after code lands)

### Task 11: Revise the seeded 视图与链接 figures + re-seed

**Files:**
- Modify: `tools/block-doc-art/src/11-materialize.html` (F5 — materialization retired), `12-e2e-lesson.html` (F6 — number), `09-navigate.html` (read/note rows), and `apps/server/scripts/seed-view-system-doc.ts` (if figure semantics shift)

- [ ] **Step 1: F5 (`11-materialize.html`)** now contradicts the design (materialization retired). Replace it with a figure showing the all-id model: `/p/:id` content link → handler → `/<surface>/:id` (client) / no-JS → 302 → `/notes/:id`; "no slug-materialization." Keep the art.css visual language. (Re-title e.g. "链接按面解析 — 全 id，无物化".)
- [ ] **Step 2: F6 (`12-e2e-lesson.html`)** — change "349" to the accurate suite framing "156+77+116 单元/集成全绿（+theme 18/grid 63）" or just "全套单元/集成绿". (Matches the transcript; the agent flagged this.)
- [ ] **Step 3: F3 (`09-navigate.html`)** — the resolveTarget table: public row was `permalink /p/:id → 302`; update to the 4-surface all-id form (read→/read/:id, note→/notes/:id).
- [ ] **Step 4: Re-render** the changed figures:
Run: `node tools/block-doc-art/render.mjs 11 && node tools/block-doc-art/render.mjs 12 && node tools/block-doc-art/render.mjs 09` (node — bun can't launch Playwright on Windows). Expected: `✓` lines with dimensions.
- [ ] **Step 5: Re-seed** into the dev库 (back up first, like before) and verify, then commit the figures + seed:
```bash
# backup
bun %TEMP%/backup-devdb.mjs "data/dev.db" "data/dev.db.bak-pre-mvp10allid-20260618"
# re-seed (dev server on :3000 against data/dev.db must be running)
bun apps/server/scripts/seed-view-system-doc.ts --base http://localhost:3000 --email admin@local.dev --password dev-admin-password --replace
git add tools/block-doc-art/src/09-navigate.html tools/block-doc-art/src/11-materialize.html tools/block-doc-art/src/12-e2e-lesson.html tools/block-doc-art/out/09-navigate.png tools/block-doc-art/out/11-materialize.png tools/block-doc-art/out/12-e2e-lesson.png apps/server/scripts/seed-view-system-doc.ts tools/block-doc-art/src/07-surfaces.html tools/block-doc-art/src/08-link-capability.html tools/block-doc-art/src/10-rootcause.html tools/block-doc-art/out/07-surfaces.png tools/block-doc-art/out/08-link-capability.png tools/block-doc-art/out/10-rootcause.png
git commit -m "docs(mvp10): view-link doc figures match all-id model + seed script"
```
> The figure 07/08/10 + seed were authored earlier this session and are still uncommitted — fold them into this commit so the doc set lands together.

---

## Final review

After all tasks: dispatch a holistic code reviewer over the whole branch delta (per subagent-driven-development's final step), then `superpowers:finishing-a-development-branch`. Verify: web unit + server suite green; e2e page-links 4/4 green; typechecks clean; ADR-0031 updated to the 4-surface/all-id model (separate doc task — see spec §9).
