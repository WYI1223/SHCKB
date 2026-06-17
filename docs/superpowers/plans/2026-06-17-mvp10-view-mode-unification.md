# MVP-10 View-Mode Unification + First-Class Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken in-editor page-link jump (full-page reload → published view) with one client-side, mode-preserving navigation primitive `navigateToPage(LinkRef)`; add an in-app draft-preview surface; and elevate "link" to a first-class, kind-agnostic capability (`LinkRef = {pageId, blockId?}` + per-kind extraction).

**Architecture:** Three surfaces — **Editor** (`/edit/:id`, working) ⇄ **In-app View** (`/view/:id`, working draft preview) / **Public** (`/notes/:slug`, published). A `navigateToPage` host capability reads the current surface and routes to the *same* surface for the target (Editor→Editor, View→View), client-side, so chrome (the `Shell` layout route) never unmounts. A canvas-level **delegated click handler** turns any rendered `a[data-skb-page]` into a `navigateToPage` call. Each block kind exposes `links(content): LinkRef[]`; blocks already carry `data-block-id`, so block-level links are scroll-to-block (same page = pure scroll, cross page = nav + scroll).

**Tech Stack:** React 18 + TS, bun workspace; react-router-dom v6 (`BrowserRouter`/`useNavigate`/`useLocation`); `@skb/block-kinds` (kind contract + richtext/markdown + `PublishedCanvas`); `apps/web` (router in `main.tsx`, `Shell` layout, `EditorPage`, `ReadPage`, `GridCanvas`); `apps/server` Hono (`/p/:id` permalink, publish HTML render); vitest (no globals; happy-dom; **manual `afterEach(cleanup)`**); Playwright e2e.

**Spec:** [docs/superpowers/specs/2026-06-17-mvp10-view-mode-unification-design.md](../specs/2026-06-17-mvp10-view-mode-unification-design.md). **Discussion:** [docs/engineering/design/discussions/mvp10-scope-2026-06-17.md](../../engineering/design/discussions/mvp10-scope-2026-06-17.md).

**Decisions (resolve spec §11 open questions — locked here):**
1. **Routes:** `/edit/:id` (Editor, keep) · `/view/:id` (In-app View, NEW) · `/notes/:slug` (Public, keep) · `/read/:slug` (anonymous in-app read, **keep** — `PublicTreePage` exposes only `slug`, not `id`, so anonymous browse stays slug-addressed) · `/p/:id` (external permalink, **keep** as the public/external share primitive; internal nav no longer uses it).
2. **In-app View scope (MVP-10):** working **draft preview only** (read-only render of working state, by id) + an Edit⇄View toggle. The In-app-View working⇄**published** toggle is **deferred** (no published-by-id endpoint exists; `getPublicNote` is slug+public-only — to view published, use the existing Public link). Recorded in the spec's deferred register.
3. **Mode-preserving client nav** targets the **authenticated, id-addressed app surfaces** (Editor, In-app View) — that is exactly where the bug bites (the author can't traverse their own link graph). Public links are **materialized to `/notes/:slug` at publish time** (Phase 6) for client-side Public→Public; programmatic `pageId` on the Public/anonymous surface falls back to the `/p/:id` 302 (a full nav there is tolerable for anonymous readers).
4. **Position layer:** stash/restore `scrollTop` + active block id per `(pageId, surface)`.

**Commands** (run from repo root unless noted; subagents have `bun` on PATH):
- package unit tests: `cd packages/block-kinds && bun run test` (or `packages/<pkg>`)
- web unit tests: `cd apps/web && bun run test`
- typecheck a package: `cd <pkg> && bun run typecheck`
- e2e (needs servers — see Task 13 note): `bun x playwright test`
- find consumers: `grep -rn "<sym>" apps packages --include=*.ts --include=*.tsx`

---

## File Structure

**Create:**
- `packages/block-kinds/src/links.ts` — `LinkRef` type + `parsePermalink(href): LinkRef | null` (the canonical `/p/:id(#blockId)` parser, shared by markdown extraction + the delegated handler fallback).
- `apps/web/src/nav/useNavigateToPage.ts` — the client-side navigation primitive (surface resolution) + `surfaceOf`.
- `apps/web/src/nav/scrollToBlock.ts` — `scrollToBlock(blockId)` + the flash CSS injection.
- `apps/web/src/nav/useScrollRestore.ts` — the position layer (stash/restore per `(pageId, surface)`).
- `apps/web/src/pages/InAppView.tsx` — the `/view/:id` draft-preview surface.
- `apps/web/src/nav/__tests__/navigateToPage.test.ts` — surface→route resolution unit test.
- `e2e/page-links.spec.ts` — the mode-preserving / no-reload / block-jump e2e.

**Modify:**
- `packages/block-kinds/src/types.ts` — `BlockKindModule.links?`; `HostServices.navigateToPage`; re-export `LinkRef`/`parsePermalink`.
- `packages/block-kinds/src/richtext/schema.ts` — `pagelink` mark gains `blockId` attr; `toDOM`/`parseDOM` carry `data-skb-block` + `#blockId`.
- `packages/block-kinds/src/richtext/richtext.ts` — add `links(content): LinkRef[]` (generalizes `linkedPageIds`).
- `packages/block-kinds/src/richtext/RichtextRenderView.tsx` — pagelink case emits `data-skb-block` + `#blockId` href.
- `packages/block-kinds/src/richtext/index.ts`, `packages/block-kinds/src/markdown/index.ts` — wire `links`.
- `packages/block-kinds/src/markdown/{markdown.ts,MarkdownRenderView.tsx}` — `links()` + rendered `a[data-skb-page]` for `/p/:id` hrefs.
- `packages/block-kinds/src/PublishedCanvas.tsx` — ensure each block wrapper carries `data-block-id` (block anchor parity with the editor canvas).
- `apps/web/src/main.tsx` — add `/view/:id` route.
- `apps/web/src/pages/EditorPage.tsx` — `navigateToPage` in `HostServices`; canvas delegated click handler; Edit→View toggle; scroll-restore.
- `apps/web/src/pages/ReadPage.tsx` — delegated click handler + scroll-restore for the Public/Read surface.
- `apps/web/src/grid/GridCanvas.tsx` — copy-link-to-block context-menu item; ensure the scroll container hosts the delegated handler.
- `apps/web/src/shell/Sidebar.tsx` — anonymous read link stays `/read/:slug`; (no change unless a `/view` entry is wanted — out of scope).
- `apps/server/src/render/publish-html.*` (confirm exact path) — materialize `/p/:id(#b)` → `/notes/:slug(#b)` at publish render.
- `docs/engineering/decisions/` — new ADR (~ADR-0031) + AUDIT entry.
- `docs/product/prd/features/notepage/{notepage-view.md,notepage-editing.md}` — mode model update.

---

## Phase 1 — Link contract: `LinkRef` + per-kind extraction (pure, no routing)

### Task 1: `LinkRef` type + `parsePermalink` + contract fields

**Files:**
- Create: `packages/block-kinds/src/links.ts`
- Modify: `packages/block-kinds/src/types.ts` (add `BlockKindModule.links?` + `HostServices.navigateToPage`; re-export)
- Test: `packages/block-kinds/src/__tests__/links.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/block-kinds/src/__tests__/links.test.ts`

```ts
import { describe, expect, test } from 'vitest';
import { parsePermalink, type LinkRef } from '../links';

describe('parsePermalink', () => {
  test('plain page permalink → {pageId}', () => {
    expect(parsePermalink('/p/abc123')).toEqual({ pageId: 'abc123' });
  });
  test('block permalink → {pageId, blockId}', () => {
    expect(parsePermalink('/p/abc123#blk9')).toEqual({ pageId: 'abc123', blockId: 'blk9' });
  });
  test('percent-encoded id is decoded', () => {
    expect(parsePermalink('/p/a%20b')).toEqual({ pageId: 'a b' });
  });
  test('non-permalink hrefs → null', () => {
    expect(parsePermalink('https://example.com')).toBeNull();
    expect(parsePermalink('/notes/some-slug')).toBeNull();
    expect(parsePermalink('#frag')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `cd packages/block-kinds && bun run test links` → FAIL (`../links` not found).

- [ ] **Step 3: Implement `packages/block-kinds/src/links.ts`**

```ts
/**
 * First-class link capability (MVP-10, spec §6). A LinkRef is the universal
 * internal-link target — page-level (blockId absent) or block-level. Every
 * block kind extracts its outbound links to LinkRef[] (host-uniform), and the
 * web host's delegated click handler + navigateToPage consume the same shape.
 * `/p/:id(#blockId)` stays the canonical external permalink string; this file
 * is the single parser, so markdown extraction and the handler agree.
 */
export type LinkRef = { pageId: string; blockId?: string };

const PERMALINK = /^\/p\/([^/#?]+)(?:#([^/?]+))?$/;

/** Parse a `/p/:id` or `/p/:id#:blockId` permalink href → LinkRef, else null.
 * Ids are percent-decoded. Any other href (external, /notes/, fragment) → null. */
export function parsePermalink(href: string): LinkRef | null {
  const m = PERMALINK.exec(href);
  if (!m) return null;
  const pageId = decodeURIComponent(m[1]);
  const blockId = m[2] ? decodeURIComponent(m[2]) : undefined;
  return blockId ? { pageId, blockId } : { pageId };
}

/** Build the canonical permalink string from a LinkRef. */
export function permalinkOf(ref: LinkRef): string {
  const base = `/p/${encodeURIComponent(ref.pageId)}`;
  return ref.blockId ? `${base}#${encodeURIComponent(ref.blockId)}` : base;
}
```

- [ ] **Step 4: Add contract fields in `packages/block-kinds/src/types.ts`**

```ts
import type { LinkRef } from './links';
// In the BlockKindModule type (generic over its content C), add:
  /** Outbound internal links this content references (MVP-10 spec §6 seam ①).
   * Host-uniform extraction feeds backlinks/search/agent (MVP-11) and
   * export/import integrity. Omitted = kind has no internal links. */
  links?: (content: C) => LinkRef[];

// In the HostServices type (seam ②), add:
  /** Navigate to a page/block, preserving the current surface (MVP-10 spec
   * §5). The host resolves Editor→Editor / View→View / Public→Public,
   * client-side. Same-page block target = pure scroll. Modules use this for
   * programmatic jumps (e.g. future search results); rendered links are
   * handled by the host's delegated click handler. */
  navigateToPage?: (ref: LinkRef) => void;
```

> **Confirm shape:** open `types.ts` and use the exact generic param name for the module's content (the autofit slice used `BlockKindModule`; check whether content is a generic `C` or `unknown`). If modules are not generic, type `links?: (content: never) => LinkRef[]` is wrong — instead make `links?: (content: any) => LinkRef[]` consistent with how `RenderView`/`createContent` type their content. Match the existing pattern; do not introduce a new generic.

- [ ] **Step 5: Re-export** in `packages/block-kinds/src/index.ts`: `export * from './links';` (so `LinkRef`/`parsePermalink`/`permalinkOf` are public). Run `cd packages/block-kinds && bun run test links` → PASS; `bun run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/block-kinds/src/links.ts packages/block-kinds/src/types.ts packages/block-kinds/src/index.ts packages/block-kinds/src/__tests__/links.test.ts
git commit -m "feat(block-kinds): LinkRef + parsePermalink + links()/navigateToPage contract seams"
```

### Task 2: richtext `links()` + `pagelink` mark gains `blockId`

**Files:**
- Modify: `packages/block-kinds/src/richtext/schema.ts`, `richtext.ts`, `RichtextRenderView.tsx`, `index.ts`
- Test: `packages/block-kinds/src/__tests__/richtext-links.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/block-kinds/src/__tests__/richtext-links.test.ts`

```ts
import { describe, expect, test } from 'vitest';
import { links } from '../richtext/richtext';
import type { RichtextContent } from '../richtext/richtext';

const doc = (marks: Array<Record<string, unknown>>): RichtextContent => ({
  doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks }] }] },
});

describe('richtext links()', () => {
  test('page-level pagelink → {pageId}', () => {
    expect(links(doc([{ type: 'pagelink', attrs: { pageId: 'P1' } }]))).toEqual([{ pageId: 'P1' }]);
  });
  test('block-level pagelink → {pageId, blockId}', () => {
    expect(links(doc([{ type: 'pagelink', attrs: { pageId: 'P1', blockId: 'B2' } }]))).toEqual([
      { pageId: 'P1', blockId: 'B2' },
    ]);
  });
  test('dedups repeated targets, ignores non-pagelink marks', () => {
    const c = doc([
      { type: 'pagelink', attrs: { pageId: 'P1' } },
      { type: 'pagelink', attrs: { pageId: 'P1' } },
      { type: 'strong' },
    ]);
    expect(links(c)).toEqual([{ pageId: 'P1' }]);
  });
});
```

- [ ] **Step 2: Run it** → FAIL (`links` not exported from richtext.ts).

- [ ] **Step 3: Implement `links()` in `packages/block-kinds/src/richtext/richtext.ts`** (replace/augment `linkedPageIds`):

```ts
import type { LinkRef } from '../links';

/** Outbound internal links (MVP-10) — walks pagelink marks → LinkRef, deduped.
 * Supersedes linkedPageIds ("future backlink feed"): now block-aware. */
export function links(content: RichtextContent): LinkRef[] {
  const out: LinkRef[] = [];
  const seen = new Set<string>();
  const walk = (node: PmNode) => {
    for (const mark of node.marks ?? []) {
      if (mark.type === 'pagelink' && typeof mark.attrs?.pageId === 'string') {
        const pageId = mark.attrs.pageId;
        const blockId = typeof mark.attrs?.blockId === 'string' && mark.attrs.blockId ? mark.attrs.blockId : undefined;
        const key = `${pageId}#${blockId ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(blockId ? { pageId, blockId } : { pageId });
        }
      }
    }
    (node.content ?? []).forEach(walk);
  };
  walk(content.doc);
  return out;
}
```

> Keep `linkedPageIds` as a thin wrapper for any existing caller: `export function linkedPageIds(c: RichtextContent): string[] { return [...new Set(links(c).map((l) => l.pageId))]; }` (grep callers; if none outside tests, leave the wrapper for safety — it's tiny).

- [ ] **Step 4: `pagelink` mark gains `blockId`** in `packages/block-kinds/src/richtext/schema.ts` — replace the `pagelink` mark:

```ts
    /** First-class inter-page link (M9-D1; MVP-10 block-aware): stores pageId
     * + optional blockId — renders the /p/:id(#blockId) permalink. */
    pagelink: {
      attrs: { pageId: {}, blockId: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[data-skb-page]',
          getAttrs: (dom) => ({
            pageId: (dom as HTMLElement).getAttribute('data-skb-page'),
            blockId: (dom as HTMLElement).getAttribute('data-skb-block') || null,
          }),
        },
      ],
      toDOM: (mark) => {
        const pageId = mark.attrs.pageId as string;
        const blockId = mark.attrs.blockId as string | null;
        return [
          'a',
          {
            href: `/p/${pageId}${blockId ? '#' + blockId : ''}`,
            'data-skb-page': pageId,
            ...(blockId ? { 'data-skb-block': blockId } : {}),
          },
          0,
        ];
      },
    },
```

- [ ] **Step 5: RenderView emits `data-skb-block`** in `packages/block-kinds/src/richtext/RichtextRenderView.tsx` — replace the `pagelink` case in `applyMarks`:

```tsx
      case 'pagelink': {
        const pageId = typeof mark.attrs?.pageId === 'string' ? mark.attrs.pageId : '';
        const blockId = typeof mark.attrs?.blockId === 'string' ? mark.attrs.blockId : '';
        out = (
          <a
            href={`/p/${encodeURIComponent(pageId)}${blockId ? '#' + encodeURIComponent(blockId) : ''}`}
            data-skb-page={pageId}
            {...(blockId ? { 'data-skb-block': blockId } : {})}
          >
            {out}
          </a>
        );
        break;
      }
```

- [ ] **Step 6: Wire `links` into the module** — `packages/block-kinds/src/richtext/index.ts`: add `links,` to the exported `BlockKindModule` object (import `links` from `./richtext`).

- [ ] **Step 7: Run** `cd packages/block-kinds && bun run test richtext` → PASS (richtext-links + existing richtext tests); `bun run typecheck` → clean. Commit:

```bash
git add packages/block-kinds/src/richtext packages/block-kinds/src/__tests__/richtext-links.test.ts
git commit -m "feat(richtext): block-aware pagelink + links() extraction (LinkRef)"
```

### Task 3: markdown `links()` + rendered `data-skb-page`

**Files:** Modify `packages/block-kinds/src/markdown/markdown.ts`, `MarkdownRenderView.tsx`, `index.ts`; Test `packages/block-kinds/src/__tests__/markdown-links.test.ts`

> **Confirm shape FIRST:** read `packages/block-kinds/src/markdown/markdown.ts` for the content type (the markdown source field — likely `{ md: string }` or `{ text: string }`) and how `MarkdownRenderView` renders links (it uses a markdown lib; find where `<a href>` is produced). Use the real field name below.

- [ ] **Step 1: Write the failing test** — `packages/block-kinds/src/__tests__/markdown-links.test.ts`

```ts
import { describe, expect, test } from 'vitest';
import { links } from '../markdown/markdown';

const md = (src: string) => ({ /* <field>: src */ } as never); // fill the real field

describe('markdown links()', () => {
  test('extracts /p/:id link targets', () => {
    expect(links(md('see [other](/p/P1) and [blk](/p/P1#B2)'))).toEqual([
      { pageId: 'P1' },
      { pageId: 'P1', blockId: 'B2' },
    ]);
  });
  test('ignores external links', () => {
    expect(links(md('[x](https://example.com)'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `links()` in `markdown.ts`** — extract `/p/:id(#b)` targets from the source via the shared parser (no markdown AST needed; a link-target regex over the source is sufficient and avoids a parser dep here):

```ts
import { parsePermalink, type LinkRef } from '../links';

/** Outbound internal links (MVP-10): markdown internal links are ordinary
 * `[text](/p/:id(#blockId))` — no new syntax. Extract their targets. */
export function links(content: /* MarkdownContent */ { md: string }): LinkRef[] {
  const out: LinkRef[] = [];
  const seen = new Set<string>();
  // markdown inline link: [label](target) — capture target up to space/paren
  const re = /\]\(\s*(\/p\/[^\s)]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content.md)) !== null) {
    const ref = parsePermalink(m[1]);
    if (!ref) continue;
    const key = `${ref.pageId}#${ref.blockId ?? ''}`;
    if (!seen.has(key)) { seen.add(key); out.push(ref); }
  }
  return out;
}
```

> Replace `{ md: string }` + `content.md` with the real content shape from Step-0's read.

- [ ] **Step 4: Rendered markdown links carry `data-skb-page`** — in `MarkdownRenderView.tsx`, find the link renderer (react-markdown `components={{ a: ... }}` or equivalent). For an `href` matching `parsePermalink`, render `<a href={href} data-skb-page={ref.pageId} {...(ref.blockId?{'data-skb-block':ref.blockId}:{})}>` so the delegated handler picks it up; external hrefs render as today (with `rel="noreferrer noopener"`).

```tsx
import { parsePermalink } from '../links';
// in the components map:
a: ({ href = '', children }) => {
  const ref = parsePermalink(href);
  if (ref) return <a href={href} data-skb-page={ref.pageId} {...(ref.blockId ? { 'data-skb-block': ref.blockId } : {})}>{children}</a>;
  return <a href={href} rel="noreferrer noopener">{children}</a>;
},
```

> **Confirm shape:** match the actual renderer API in `MarkdownRenderView.tsx` (it may not be react-markdown). Wire the same two-branch logic into whatever produces the `<a>`.

- [ ] **Step 5: Wire `links`** into `markdown/index.ts` module object. Run `cd packages/block-kinds && bun run test markdown` → PASS; `bun run typecheck` → clean. Commit `feat(markdown): links() over /p/:id targets + data-skb-page render`.

---

## Phase 2 — The navigation primitive + delegated handler (the keystone bug fix)

### Task 4: `useNavigateToPage` + `scrollToBlock` + surface resolution

**Files:** Create `apps/web/src/nav/useNavigateToPage.ts`, `apps/web/src/nav/scrollToBlock.ts`, `apps/web/src/nav/__tests__/navigateToPage.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/src/nav/__tests__/navigateToPage.test.ts` (pure resolution fn, no router needed)

```ts
import { describe, expect, test } from 'vitest';
import { resolveTarget, surfaceOf } from '../useNavigateToPage';

describe('surfaceOf', () => {
  test.each([
    ['/edit/abc', 'editor'],
    ['/view/abc', 'view'],
    ['/notes/some-slug', 'public'],
    ['/', 'other'],
  ])('%s → %s', (path, expected) => expect(surfaceOf(path)).toBe(expected));
});

describe('resolveTarget', () => {
  test('editor → editor route by id (mode preserved)', () => {
    expect(resolveTarget('/edit/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/edit/B' });
  });
  test('view → view route by id', () => {
    expect(resolveTarget('/view/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/view/B' });
  });
  test('cross-page block target carries the hash', () => {
    expect(resolveTarget('/edit/A', { pageId: 'B', blockId: 'X' })).toEqual({ kind: 'navigate', to: '/edit/B#X' });
  });
  test('same-page block target = pure scroll (no navigation)', () => {
    expect(resolveTarget('/edit/A', { pageId: 'A', blockId: 'X' })).toEqual({ kind: 'scroll', blockId: 'X' });
  });
  test('public surface falls back to the /p/:id permalink (full nav)', () => {
    expect(resolveTarget('/notes/s', { pageId: 'B', blockId: 'X' })).toEqual({ kind: 'permalink', to: '/p/B#X' });
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `apps/web/src/nav/useNavigateToPage.ts`**

```ts
/**
 * The MVP-10 navigation primitive (spec §5). Resolves a LinkRef against the
 * CURRENT surface and keeps you in it: Editor→Editor, In-app View→View
 * (client-side, chrome stays mounted). Same-page block target = pure scroll.
 * Public surface has no client id→slug map, so it falls back to the /p/:id
 * permalink (server 302) — acceptable for the anonymous read surface.
 */
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { permalinkOf, type LinkRef } from '@skb/block-kinds';
import { scrollToBlock } from './scrollToBlock';

export type Surface = 'editor' | 'view' | 'public' | 'other';

export function surfaceOf(pathname: string): Surface {
  if (pathname.startsWith('/edit/')) return 'editor';
  if (pathname.startsWith('/view/')) return 'view';
  if (pathname.startsWith('/notes/')) return 'public';
  return 'other';
}

function currentId(pathname: string): string {
  return decodeURIComponent(pathname.split('/')[2] ?? '');
}

export type NavAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'scroll'; blockId: string }
  | { kind: 'permalink'; to: string };

/** Pure resolver (unit-tested). The hook below performs the side effect. */
export function resolveTarget(pathname: string, ref: LinkRef): NavAction {
  const surface = surfaceOf(pathname);
  const appById = surface === 'editor' || surface === 'view';
  if (appById && ref.blockId && ref.pageId === currentId(pathname)) {
    return { kind: 'scroll', blockId: ref.blockId };
  }
  const hash = ref.blockId ? `#${encodeURIComponent(ref.blockId)}` : '';
  if (surface === 'editor') return { kind: 'navigate', to: `/edit/${encodeURIComponent(ref.pageId)}${hash}` };
  if (surface === 'view') return { kind: 'navigate', to: `/view/${encodeURIComponent(ref.pageId)}${hash}` };
  if (surface === 'public') return { kind: 'permalink', to: permalinkOf(ref) };
  // default app surface = the in-app draft preview
  return { kind: 'navigate', to: `/view/${encodeURIComponent(ref.pageId)}${hash}` };
}

export function useNavigateToPage(): (ref: LinkRef) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (ref: LinkRef) => {
      const action = resolveTarget(pathname, ref);
      if (action.kind === 'scroll') scrollToBlock(action.blockId);
      else if (action.kind === 'navigate') navigate(action.to);
      else window.location.assign(action.to); // permalink (public) → server 302
    },
    [navigate, pathname],
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/nav/scrollToBlock.ts`**

```ts
/** Scroll a block into view + a brief highlight (MVP-10 spec §5.3). Block
 * tiles already carry data-block-id (GridCanvas/PublishedCanvas). No-op if the
 * block isn't on the current page (e.g. not in the published snapshot). */
let flashStyleInjected = false;
function ensureFlashStyle() {
  if (flashStyleInjected || typeof document === 'undefined') return;
  flashStyleInjected = true;
  const s = document.createElement('style');
  s.textContent =
    '@keyframes skb-block-flash{0%{box-shadow:0 0 0 3px var(--skb-accent,#3b82f6)}100%{box-shadow:0 0 0 3px transparent}}' +
    '.skb-block-flash{animation:skb-block-flash 1.1s ease-out 1}' +
    '@media (prefers-reduced-motion: reduce){.skb-block-flash{animation:none}}';
  document.head.appendChild(s);
}

export function scrollToBlock(blockId: string): void {
  if (typeof document === 'undefined') return;
  const el = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null;
  if (!el) return;
  ensureFlashStyle();
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('skb-block-flash');
  void el.offsetWidth; // restart the animation
  el.classList.add('skb-block-flash');
  window.setTimeout(() => el.classList.remove('skb-block-flash'), 1300);
}
```

- [ ] **Step 5: Run** `cd apps/web && bun run test navigateToPage` → PASS; `bun run typecheck` → clean. Commit `feat(web): navigateToPage primitive (surface-preserving) + scrollToBlock`.

### Task 5: delegated click handler + wire `HostServices.navigateToPage` (Editor)

**Files:** Modify `apps/web/src/pages/EditorPage.tsx`, `apps/web/src/grid/GridCanvas.tsx`

- [ ] **Step 1: Add the delegated handler helper** — in `apps/web/src/nav/useNavigateToPage.ts`, export a click-handler factory:

```ts
import { parsePermalink, type LinkRef } from '@skb/block-kinds';

/** A delegated click handler: any click on a rendered internal link
 * (a[data-skb-page], or a[href^="/p/"] fallback) routes through navigateToPage,
 * client-side. New-tab / modified clicks pass through. */
export function makeLinkClickHandler(nav: (ref: LinkRef) => void) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (!a) return;
    const pageId = a.getAttribute('data-skb-page');
    let ref: LinkRef | null = pageId
      ? { pageId, ...(a.getAttribute('data-skb-block') ? { blockId: a.getAttribute('data-skb-block')! } : {}) }
      : parsePermalink(a.getAttribute('href') ?? '');
    if (!ref) return;
    e.preventDefault();
    nav(ref);
  };
}
```

(Add `import type React from 'react';` if needed for the `React.MouseEvent` type, matching the file's existing React import style.)

- [ ] **Step 2: Wire into EditorPage** — in `EditorPage.tsx`'s `Editor`:
  - `const navigateToPage = useNavigateToPage();` and add `navigateToPage` to the `hostServices` memo (the `HostServices` object, alongside `uploadBlob`/`listPages`/`promptText`/`menu`).
  - `const onLinkClick = useMemo(() => makeLinkClickHandler(navigateToPage), [navigateToPage]);`
  - Put `onClick={onLinkClick}` on the canvas scroll container — the `<div className="pu-scroll" …>` that wraps `<GridCanvas …>` (the element around line 421). This catches clicks on inactive-preview links (the bug's locus). Active PM editor links are not navigated by a plain click (PM owns them), which is correct.

- [ ] **Step 3: Run** `cd apps/web && bun run typecheck && bun run test` → PASS (no behavior test here; covered by e2e Task 13). Commit `feat(web): editor routes page-link clicks through navigateToPage (client-side, mode-preserving)`.

### Task 6: block anchors parity in `PublishedCanvas`

**Files:** Modify `packages/block-kinds/src/PublishedCanvas.tsx`; Test `packages/block-kinds/src/__tests__/published-anchor.test.tsx`

The editor canvas already tags `data-block-id` ([GridCanvas.tsx:203](../../../apps/web/src/grid/GridCanvas.tsx)); the published/read render must match so cross-page block jumps land in the Public/View surfaces too.

- [ ] **Step 1: Write the failing test** — `packages/block-kinds/src/__tests__/published-anchor.test.tsx`

```tsx
// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { PublishedCanvas } from '../PublishedCanvas';

afterEach(cleanup);

test('each published block tile carries data-block-id', () => {
  const doc = { title: 'T', gravityEnabled: true, blocks: [
    { id: 'B1', kind: 'markdown', col: 0, row: 0, colSpan: 4, rowSpan: 1, content: { /* md shape */ }, follow: true },
  ] } as never;
  const { container } = render(<ThemeProvider theme={graphPaper}><PublishedCanvas doc={doc} /></ThemeProvider>);
  expect(container.querySelector('[data-block-id="B1"]')).toBeTruthy();
});
```

> Fill the markdown `content` with the real shape (Step-0 of Task 3).

- [ ] **Step 2: Run** → FAIL if the wrapper lacks `data-block-id`.

- [ ] **Step 3: Add `data-block-id={b.id}`** to the per-block wrapper `<div>` in `PublishedCanvas.tsx` (the absolutely-positioned tile, mirroring GridCanvas). Run `cd packages/block-kinds && bun run test published-anchor` → PASS. Commit `feat(block-kinds): published tiles carry data-block-id (block-anchor parity)`.

---

## Phase 3 — In-app View surface (`/view/:id` draft preview) + Edit⇄View toggle

### Task 7: `InAppView` component + route + delegated handler

**Files:** Create `apps/web/src/pages/InAppView.tsx`; Modify `apps/web/src/main.tsx`

- [ ] **Step 1: Implement `apps/web/src/pages/InAppView.tsx`** — read-only render of the working state, by id, inside the Shell (chrome), with the same delegated link handler + an Edit toggle:

```tsx
/**
 * In-app View (/view/:id, MVP-10 spec §4): a read-only preview of the AUTHOR's
 * working draft — the "see my draft as a reader would" surface that the
 * published-only ReadPage never offered. By id (app surface), inside the Shell.
 * Renders working content through the shared PublishedCanvas (same renderer as
 * the public page), so edit/preview parity is by construction.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PublishedCanvas } from '@skb/block-kinds';
import { THEMES, ThemeProvider, applyCustomization, graphPaper } from '@skb/theme';
import { api, ApiError, type NotepageDetail } from '../api/client';
import { BENCH } from '../chrome/bench';
import { useShell } from '../shell/Shell';
import { makeLinkClickHandler, useNavigateToPage } from '../nav/useNavigateToPage';
import { useScrollRestore } from '../nav/useScrollRestore';

export function InAppView() {
  const { id } = useParams<{ id: string }>();
  const shell = useShell();
  const [detail, setDetail] = useState<NotepageDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const navigateToPage = useNavigateToPage();
  const onLinkClick = useMemo(() => makeLinkClickHandler(navigateToPage), [navigateToPage]);
  const scrollRef = useScrollRestore(id ?? '', 'view');

  useEffect(() => {
    if (!id) return;
    setDetail(null); setNotFound(false);
    api.getNotepage(id).then(setDetail).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
    });
  }, [id]);

  if (notFound) return <Msg text="This page does not exist." />;
  if (!detail) return <Msg text="Loading…" />;

  // working blocks → the PublishedCanvas render shape (follow boolean from autofit)
  const isFollow = (af: unknown) => af === 'follow' || af === 'grow' || af === 'grow+shrink';
  const renderDoc = {
    title: detail.page.title,
    gravityEnabled: detail.page.gravityEnabled,
    blocks: detail.blocks.map((b) => ({ ...b, follow: isFollow(b.autofit) })),
    publishedAt: 0,
  };
  const themeId = detail.page.themeId ?? shell.instanceTheme;
  const theme = applyCustomization(THEMES[themeId] ?? graphPaper, shell.customizations[themeId]);

  return (
    <div ref={scrollRef} className="pu-scroll" style={{ height: '100%', overflow: 'auto', background: BENCH.paperSunken }} onClick={onLinkClick}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px' }}>
        <Link to={`/edit/${detail.page.id}`} style={{ color: BENCH.blue, fontFamily: BENCH.fontUi, fontSize: '12px', textDecoration: 'none' }}>
          edit ✎
        </Link>
      </div>
      <ThemeProvider theme={theme}><PublishedCanvas doc={renderDoc as never} /></ThemeProvider>
    </div>
  );
}

function Msg({ text }: { text: string }) {
  return <p style={{ textAlign: 'center', marginTop: '80px', color: BENCH.inkSoft, fontFamily: BENCH.fontUi, fontSize: '13px' }}>{text}</p>;
}
```

> **Confirm shape:** `PublishedCanvas`'s `doc` prop type — match what `ReadPage.tsx` passes (it maps `autofit`→`follow`). Reuse that exact mapping. If `PublishedCanvas` expects no `publishedAt`, drop it.

- [ ] **Step 2: Add the route** in `apps/web/src/main.tsx` — inside the `<Shell/>` layout route, after `/edit/:id`:

```tsx
        <Route path="/view/:id" element={<InAppView />} />
```

(Import `InAppView`. Leave `/read/:slug` as-is for anonymous browse.)

- [ ] **Step 3:** `cd apps/web && bun run typecheck && bun run test` → PASS. Commit `feat(web): /view/:id in-app draft-preview surface (read-only, mode-preserving links)`.

### Task 8: Edit→View / View→Edit toggle in the Editor

**Files:** Modify `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1:** Add a "preview" link in the Editor job-ticket header (near the `instruments`/`publish` controls): `<Link to={`/view/${pageId}`} …>preview ◉</Link>`. This is the Editor→View half (View→Edit is the `edit ✎` link from Task 7). Keep it quiet (label style), consistent with the bench chrome. Run `bun run typecheck && bun run test` → PASS. Commit `feat(web): editor↔in-app-view toggle (preview/edit)`.

---

## Phase 4 — Position layer (scroll/active-block stash + restore)

### Task 9: `useScrollRestore`

**Files:** Create `apps/web/src/nav/useScrollRestore.ts`; Test `apps/web/src/nav/__tests__/scrollRestore.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/src/nav/__tests__/scrollRestore.test.ts` (test the pure store)

```ts
import { describe, expect, test } from 'vitest';
import { __store as store } from '../useScrollRestore';

describe('scroll-position store', () => {
  test('stash + read back per (pageId, surface)', () => {
    store.set('view', 'P1', 120);
    store.set('edit', 'P1', 40);
    expect(store.get('view', 'P1')).toBe(120);
    expect(store.get('edit', 'P1')).toBe(40);
    expect(store.get('view', 'P2')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `apps/web/src/nav/useScrollRestore.ts`**

```ts
/** Position layer (MVP-10 spec §5.5): stash scrollTop per (surface,pageId);
 * restore on (re)entry; save on unmount/leave. In-memory (per session) — a
 * Map keyed `surface pageId`. The hook returns a ref for the scroll box. */
import { useEffect, useRef } from 'react';

const mem = new Map<string, number>();
const k = (surface: string, pageId: string) => `${surface} ${pageId}`;

export const __store = {
  set: (surface: string, pageId: string, top: number) => mem.set(k(surface, pageId), top),
  get: (surface: string, pageId: string) => mem.get(k(surface, pageId)),
};

export function useScrollRestore(pageId: string, surface: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !pageId) return;
    const saved = __store.get(surface, pageId);
    if (saved !== undefined) el.scrollTop = saved;
    const onScroll = () => __store.set(surface, pageId, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      __store.set(surface, pageId, el.scrollTop); // save on leave
      el.removeEventListener('scroll', onScroll);
    };
  }, [pageId, surface]);
  return ref;
}
```

- [ ] **Step 4:** Wire `useScrollRestore` into the Editor scroll box (`EditorPage.tsx` `pu-scroll` div: `ref={useScrollRestore(pageId, 'edit')}` — note GridCanvas needs the scroll container ref; if the container already has a ref, merge) and into `ReadPage.tsx` (Public surface, keyed `'public'`+slug). InAppView already wired (Task 7).

> **Confirm:** the Editor's `pu-scroll` div has no existing ref — add the `useScrollRestore` ref directly. If a block-anchor scroll (Task 4) and restore compete on entry, prefer the hash: if `location.hash` is present on mount, `scrollToBlock(hash)` wins over restore. Add that guard in the InAppView/ReadPage mount effect: `if (location.hash) scrollToBlock(decodeURIComponent(location.hash.slice(1)));` after data load.

- [ ] **Step 5:** `cd apps/web && bun run test scrollRestore && bun run typecheck` → PASS. Commit `feat(web): scroll-position stash/restore per (surface,page) + hash-jump on entry`.

---

## Phase 5 — Minimal link authoring (copy-link-to-block)

### Task 10: "copy link to block" context-menu item

**Files:** Modify `apps/web/src/grid/GridCanvas.tsx`

The canvas already has a block right-click menu (the autofit/"Fixed height"/edit/delete items via `host.menu`). Add a "Copy link to block" item that writes the `/p/:id#:blockId` permalink to the clipboard.

- [ ] **Step 1:** In the block context-menu items array (where the autofit/edit/delete items are built), add:

```ts
{
  label: 'Copy link to block',
  onSelect: () => {
    void navigator.clipboard.writeText(`${window.location.origin}/p/${pageId}#${block.id}`);
  },
},
```

> **Confirm shape:** match the menu item type used at that call site (it may be `HostMenuItem` with `run`/`onSelect`). `pageId` is available in the canvas via props/context — confirm how GridCanvas knows the page id (it may need threading from `EditorPage`; if absent, pass `pageId` as a `GridCanvas` prop). Reuse `permalinkOf({pageId, blockId: block.id})` from `@skb/block-kinds` instead of string-building if convenient.

- [ ] **Step 2:** `cd apps/web && bun run typecheck && bun run test` → PASS. Commit `feat(web): copy-link-to-block context action (minimal block-link authoring)`.

---

## Phase 6 — Public surface: publish-time link materialization + e2e

### Task 11: materialize `/p/:id(#b)` → `/notes/:slug(#b)` at publish render

**Files:** Modify the publish HTML renderer (confirm path: `apps/server/src/render/publish-html.*` — the `renderStaticPage`/`toRenderDoc` used by `importer.ts` and the publish route)

Public pages are server-rendered HTML served at `/notes/:slug`. Their internal links currently render as `/p/:id` (full reload via 302). Materializing them to `/notes/:slug` at publish time lets the SPA Public route navigate client-side (and the delegated handler on ReadPage catch them).

- [ ] **Step 0: Confirm** the renderer path and where richtext/markdown `RenderView` output is turned into the static string. Determine whether link rewriting is cleaner (a) at render (post-process the HTML string: replace `href="/p/:id..."` using an id→slug map) or (b) by passing a `resolveHref` into the kind RenderViews. **(a) is least invasive** — a string/DOM pass over the rendered block HTML with an id→slug lookup built from the published page set.

- [ ] **Step 1:** Build an `id→slug` map for published, public pages (query notepages where `visibility='public' AND publishedHtml IS NOT NULL`). In the publish render path, rewrite anchor hrefs: `/p/:id(#b)` → `/notes/:slug(#b)` when the id resolves; leave unresolved ids as `/p/:id` (the 302 still works). Keep `data-skb-page`/`data-skb-block` attributes intact (the ReadPage delegated handler reads them; the href is the fallback).

> **Confirm shape + add a test** at the server layer: a unit test that feeds a richtext/markdown block containing a pagelink to a known published page and asserts the rendered HTML contains `/notes/<slug>` (and that an unknown id stays `/p/<id>`). Place it beside the existing publish-html tests.

- [ ] **Step 2:** Wire the **delegated handler + scroll-restore into `ReadPage.tsx`** (Public surface): `onClick={makeLinkClickHandler(navigateToPage)}` on its container + `useScrollRestore(slug, 'public')` + hash-jump on entry. On the Public surface, `navigateToPage` for a rendered `/notes/:slug` anchor: extend `makeLinkClickHandler` to also catch `a[href^="/notes/"]` and client-navigate (`navigate(href)`) — add a small branch so Public→Public is client-side. (Public links carry `data-skb-page` too, but their resolved `pageId` has no client slug map, so on the Public surface prefer the anchor's own `/notes/:slug` href for client nav.)

```ts
// in makeLinkClickHandler, before the data-skb-page branch:
const href = a.getAttribute('href') ?? '';
if (href.startsWith('/notes/')) { e.preventDefault(); /* SPA nav */ navOpts.toPath(href); return; }
```

> Adjust `makeLinkClickHandler` to accept either `navigateToPage` (LinkRef) or a `toPath(path)` for raw client nav; simplest is to pass both `nav` and `navigate` into the factory. Keep the Editor/View call sites unchanged (they pass a no-op `toPath` or the real `navigate`).

- [ ] **Step 3:** typecheck server + web; run server unit tests (`cd apps/server && bun run test`) → PASS. Commit `feat(server,web): publish-time link materialization to /notes/:slug + client-side public nav`.

### Task 12: cross-surface e2e

**Files:** Create `e2e/page-links.spec.ts`

- [ ] **Step 1:** Write the spec (graph-paper page A with a richtext block linking to page B; B published). Assert:
  1. **Editor stays in Editor, no reload:** on `/edit/:A`, click the page-link → URL becomes `/edit/:B`, the Editor chrome is the SAME document (probe: set `window.__probe = 1` before click via `page.evaluate`; after click assert it survived → no full reload), and the sidebar is still mounted.
  2. **Cross-page block jump:** a link to `B#blk` lands on `/edit/:B` and scrolls the block into view (assert the block is in viewport).
  3. **Same-page block link = no navigation:** a link to `A#blk2` keeps URL `/edit/:A` and scrolls.
  4. **Public→Public:** on `/notes/:Aslug`, the materialized link click navigates client-side to `/notes/:Bslug` (no full reload probe).

```ts
import { expect, test } from '@playwright/test';
import { loginViaApi /*, helpers */ } from './fixtures/login';

test('page links: editor stays in editor, no reload; block jumps scroll', async ({ page }) => {
  await loginViaApi(page);
  // create page B (published) and page A (richtext block linking /p/:B and /p/:A#blk2)
  // … use the fixtures' page-creation helper; confirm its shape in e2e/fixtures/login.ts
  // (richtext content with a pagelink mark: attrs {pageId:B} and {pageId:A, blockId:'blk2'})
  await page.goto(`/edit/${A}`);
  await page.evaluate(() => ((window as unknown as { __probe?: number }).__probe = 1));
  await page.locator(`${'[data-block-id="L"]'} a[data-skb-page="${B}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/edit/${B}$`));
  expect(await page.evaluate(() => (window as unknown as { __probe?: number }).__probe)).toBe(1); // no reload
});
```

> **Confirm shapes:** the page-creation helper in [e2e/fixtures/login.ts](../../../e2e/fixtures/login.ts) (generalize to richtext blocks with pagelink marks; read the helper). Build A's link block as a richtext block whose doc contains a text node with a `pagelink` mark.

- [ ] **Step 2:** Run (servers up — see note) `bun x playwright test page-links` → green. Commit `test(e2e): page-link nav (mode-preserving, no reload, block jump)`.

> **Running e2e:** Playwright's `webServer` uses POSIX `VAR=val cmd` syntax cmd.exe can't parse; start servers manually so `reuseExistingServer` reuses them. API: `SHCKB_AUTH_SECRET=e2e-secret-at-least-32-characters-long SHCKB_ADMIN_EMAIL=admin@local.dev SHCKB_ADMIN_PASSWORD=dev-admin-password SHCKB_BASE_URL=http://localhost:5173 SHCKB_DB_PATH=<tmp>/shckb-e2e/e2e.db PORT=3210 bun apps/server/src/index.ts`; web: `cd apps/web && SHCKB_API_TARGET=http://localhost:3210 bun x vite --port 5173 --strictPort`. Use a throwaway DB — never the dev库.

---

## Phase 7 — Docs (ADR + PRD)

### Task 13: new ADR (routing / identity / mode model) + AUDIT entry

**Files:** Create `docs/engineering/decisions/ADR-00XX-view-mode-navigation.md`; modify `AUDIT-2026-05.md`

- [ ] **Step 1:** Allocate the next ADR number (check the decisions dir — currently highest is ADR-0030, so likely **ADR-0031**). Write it PRD-informed: **Decision** = three surfaces (Editor/In-app View/Public; app=id, public=slug) + `navigateToPage(LinkRef)` client-side mode-preserving primitive + `/p/:id` retained as external-only permalink + `LinkRef={pageId,blockId?}` first-class capability. **Context** = the layer-error (public permalink misused as in-editor nav; full reload; draft 404; three-axis asymmetry). **Consequences** + a **Deferred** section (In-app-View published toggle; selective-import link remap; PDF/agent/canvas — spec §8.3). Form-C cite the spec + discussion doc + this plan.
- [ ] **Step 2:** Register the new ADR in `AUDIT-2026-05.md` (PRD-informed, per its register format). Commit `docs(adr): view-mode navigation + first-class links ADR; AUDIT entry`.

### Task 14: update notepage PRD (mode model)

**Files:** Modify `docs/product/prd/features/notepage/notepage-view.md`, `notepage-editing.md`

- [ ] **Step 1:** Update the user-observable mode model: the drifted "one URL across edit/view" invariant is replaced by the **three-surface model** (Editor / In-app draft preview / Public), and the **link-jump-preserves-mode** behavior (edit-A→edit-B; reading stays reading). Record the draft-preview capability (In-app View). Keep WHAT-level (no route strings / form factor — those are dev decisions per [[feedback-what-vs-how-prd-boundary]]). Cross-ref the new ADR. Commit `docs(prd): notepage mode model — three surfaces + mode-preserving links`.

---

## Self-Review (controller checklist — done at plan-author time)

**1. Spec coverage:** §2 root cause → Tasks 5,11 (delegated handler replaces native `/p/:id` nav). §3 decision (3 surfaces) → Tasks 7,8 + main.tsx route (Task 7). §4 surface model + id/slug split → Tasks 4 (resolveTarget), 7 (view by id), 11 (public slug). §5 nav invariants: ① client-side surgical → Task 5 (handler on canvas, Shell stays) + e2e Task 12 (no-reload probe); ② LinkRef everywhere → Tasks 1–3. §5.3 three link cases → Task 4 (resolveTarget: navigate/scroll/permalink) + Task 6 (block anchors). §5.5 position layer → Task 9. §6 link capability 3 seams: ① extract → Tasks 2,3; ② navigate → Tasks 4,5; ③ author `pickLinkTarget` (MVP-11) **out of scope** — minimal authoring (copy-link) Task 10 stands in; HostServices signature占位 done in Task 1. §7 export/import safe-today → no code change (verified in spec); remap debt → ADR Task 13. §8 staging → Tasks honor In/Out (no search, no backlinks). §9 ADR/PRD → Tasks 13,14. §10 testing → Tasks 4,6,9,12 + server test in Task 11. **Gap:** In-app-View published toggle = explicitly deferred (Decision 2) — recorded, not a gap.

**2. Placeholder scan:** No TBD/TODO. "Confirm shape" notes (Task 1 generic param; Task 3 markdown content field + renderer; Task 6/7 PublishedCanvas doc shape; Task 10 menu item type + pageId threading; Task 11 renderer path; Task 12 fixtures) are verification instructions naming exactly what to read — consistent with house style (cf. the 2026-06-14 plan's Task 14). Each has concrete code around it.

**3. Type consistency:** `LinkRef` (Task 1) used identically in Tasks 2,3,4,5,10. `parsePermalink`/`permalinkOf` (Task 1) consumed in Tasks 3,4,5,10. `resolveTarget`/`surfaceOf` (Task 4) match their test + the hook. `makeLinkClickHandler` (Task 5) extended in Task 11 (the `toPath` branch is flagged to fold into the factory signature when Task 11 lands — noted inline). `useScrollRestore(pageId, surface)` (Task 9) signature matches its call sites (Tasks 7 view, 9 edit/public). `data-block-id` anchor (Task 6) matches `scrollToBlock`'s selector (Task 4). Route strings (`/edit/:id`,`/view/:id`,`/notes/:slug`) consistent across Tasks 4,7,8,12.

**Inline fixes applied:** flagged the `makeLinkClickHandler` `toPath` extension (Task 11) to fold back into the Task-5 factory signature; flagged hash-jump-vs-restore precedence (Task 9 Step 4) so block-anchor entry wins over scroll restore.
```
