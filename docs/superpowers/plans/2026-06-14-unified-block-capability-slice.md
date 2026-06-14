# Unified Block-Capability Architecture (Internal Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the block's measurable content-box from each theme's `BlockFrame` to a single host-owned `frame-core`; reduce themes to supplying a typed, visual-only `BlockSkin`; and un-gate autofit from markdown into a per-kind block-base capability.

**Architecture:** A host `BlockFrameCore` (in `@skb/block-kinds`, used by the editor, the published view, AND the MeasureProbe) owns the in-flow, measurable, overflow-owning content box. Themes supply a `BlockSkin` (root/box/behind/front) whose `box`/`root` styles are type-restricted to visual-only props — so a skin physically cannot reintroduce the absolute-positioned collapse that broke stationery. `shells` become `skins`. Autofit gains a `BlockKindModule.autofit` field (`false` = unavailable, `{default}` = available); the two `kind==='markdown'` gates + the markdown seeding read it instead.

**Tech Stack:** React 18 + TS, bun workspace; `@skb/theme` (tokens + skin types), `@skb/block-kinds` (kind contract + frame-core + publish path), `apps/web/src/grid` (canvas geometry + autofit gesture + MeasureProbe), vitest (no globals; happy-dom for DOM tests; `afterEach(cleanup)`), Playwright e2e. Static publish via `renderToStaticMarkup`.

**Spec:** [docs/superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md](../specs/2026-06-14-unified-block-capability-architecture-design.md). NO data migration (schema v8 unchanged). `CanvasSurface`/`PageTitle` stay theme slots this slice. North-star items (UI-plugin extension type, papers/palettes→skin, asset pipeline, published-asset safety gate) are OUT of scope — recorded in spec §9.

**Commands** (run from repo root unless noted; bun is at `C:/Users/W_YI1/.bun/bin/bun.exe`, not on PATH — subagents have `bun` on PATH):
- theme unit tests: `cd packages/theme && bun run test`
- block-kinds unit tests: `cd packages/block-kinds && bun run test`
- web unit tests: `cd apps/web && bun run test`
- typecheck a package: `cd <pkg> && bun run typecheck`
- e2e (needs servers — see Task 14): `bun x playwright test`

---

## File Structure

**Create:**
- `packages/theme/src/skin.ts` — `BlockSkin`, `SkinRootStyle`, `SkinBoxStyle`, `SkinCtx`, `resolveSkin`, `skinOptionsFor`. (The skin contract; theme-owned because themes author skins.)
- `packages/block-kinds/src/BlockFrameCore.tsx` — the host frame-core component + `DEFAULT_SKIN`.
- `packages/block-kinds/src/__tests__/frame-invariant.test.ts` — the cross-skin/kind box invariant test.
- `e2e/autofit-all-kinds.spec.ts` — autofit-on-all-kinds e2e.

**Modify:**
- `packages/theme/src/themes.ts` — `Theme` gains `defaultSkin?` + `skins?`; deprecate (then remove) `BlockFrame`/`shells`/`ShellDefinition`/`resolveBlockFrame`/`shellOptionsFor`. Keep `blockOverflow`. `graphPaper`/`ink` need no frame change (token-only).
- `packages/theme/src/{galley,stationery,marginalia}.tsx` — replace `*BlockFrame` + shell `Frame`s with `defaultSkin` + `skins`.
- `packages/theme/src/shells.tsx` — `FlatShellFrame` → `flatSkin`.
- `packages/theme/src/{blueprint,workbench}.ts` — workbench `shells:{flat}` → `skins:{flat}`; blueprint unchanged (token-only).
- `packages/block-kinds/src/types.ts` — `BlockKindModule.autofit?: false | { default: AutofitMode }`.
- `packages/block-kinds/src/{markdown,richtext,image,code}/index.ts` — add `autofit`.
- `packages/block-kinds/src/PublishedCanvas.tsx` — use `BlockFrameCore` + `resolveSkin`.
- `apps/web/src/grid/GridCanvas.tsx` — use `BlockFrameCore` + `resolveSkin`/`skinOptionsFor`; remove the two `kind==='markdown'` gates.
- `apps/web/src/grid/MeasureProbe.tsx` — wrap `BlockFrameCore`.
- `apps/web/src/pages/EditorPage.tsx` — seeding reads `mod.autofit` (un-gate markdown).
- `docs/engineering/decisions/` — new ADR + ADR-0025/0028 amendments + AUDIT entry.
- `docs/product/prd/features/{plugin-system,theme-system}/*.md` — Phase-2+ entries (spec §9 table).

---

## Phase 1 — The contract: `BlockSkin`, `BlockFrameCore`, invariant test

### Task 1: `BlockSkin` types + `resolveSkin` + `skinOptionsFor`

**Files:**
- Create: `packages/theme/src/skin.ts`
- Modify: `packages/theme/src/themes.ts` (add `defaultSkin?`/`skins?` to `Theme`; keep `blockOverflow`)
- Test: `packages/theme/src/__tests__/skin.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/theme/src/__tests__/skin.test.ts`

```ts
import { describe, expect, test } from 'vitest';
import { resolveSkin, skinOptionsFor, DEFAULT_SKIN_ID } from '../skin';
import type { BlockSkin, Theme } from '../index';

const paper: BlockSkin = { id: 'paper', name: 'Paper', box: { style: { padding: '10px' } } };
const polaroid: BlockSkin = { id: 'polaroid', name: 'Polaroid', kinds: ['image'], box: { style: {} } };
const card: BlockSkin = { id: 'card', name: 'Card', box: { style: {} } };

// minimal Theme stub — only the fields resolveSkin reads
const theme = {
  defaultSkin: (kind: string) => (kind === 'image' ? polaroid : paper),
  skins: { card },
} as unknown as Theme;

describe('resolveSkin', () => {
  test('author-picked skin wins when it applies to the kind', () => {
    expect(resolveSkin(theme, 'markdown', 'card').id).toBe('card');
  });
  test('falls back to the theme default skin (per kind) when no pick', () => {
    expect(resolveSkin(theme, 'markdown', null).id).toBe('paper');
    expect(resolveSkin(theme, 'image', null).id).toBe('polaroid');
  });
  test('falls back to the framework DEFAULT_SKIN when the theme has none', () => {
    expect(resolveSkin({} as Theme, 'markdown', null).id).toBe(DEFAULT_SKIN_ID);
  });
  test('a skin not applicable to the kind is ignored (falls back)', () => {
    // polaroid is image-only; asking for it on markdown ignores it
    const t = { skins: { polaroid }, defaultSkin: paper } as unknown as Theme;
    expect(resolveSkin(t, 'markdown', 'polaroid').id).toBe('paper');
  });
});

describe('skinOptionsFor', () => {
  test('lists author-pickable skins applicable to the kind (excludes default)', () => {
    const t = { skins: { card, polaroid }, defaultSkin: paper } as unknown as Theme;
    expect(skinOptionsFor(t, 'markdown')).toEqual([{ id: 'card', name: 'Card' }]);
    expect(skinOptionsFor(t, 'image').map((o) => o.id).sort()).toEqual(['card', 'polaroid']);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `cd packages/theme && bun run test skin` → FAIL (`../skin` not found).

- [ ] **Step 3: Implement `packages/theme/src/skin.ts`**

```tsx
/**
 * BlockSkin — the material/decoration a theme dresses the host frame-core's
 * content box with (spec 2026-06-14-unified-block-capability §3/§5). The
 * box/root styles are type-restricted to VISUAL-ONLY props, so a skin
 * physically cannot set position/overflow/height/display and thus cannot
 * break the host box invariant (the stationery autofit-collapse class).
 * Replaces the per-theme BlockFrame + ShellDefinition (ADR-0025 amendment).
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Theme } from './themes';

/** Context handed to a skin's overlay render fns (enough to compute tilt etc.). */
export type SkinCtx = {
  blockId: string;
  kind: string;
  colSpan: number;
  rowSpan: number;
  /** Read tokens for colors/hairlines without importing the theme object. */
  tokens: Pick<Theme, 'textColor' | 'mutedColor' | 'hairline' | 'accent' | 'blockBg' | 'surfaceInsetBg' | 'quoteColor' | 'kindHues' | 'kindHueFallback'>;
};

/** Visual-only style for the geometry-fill root. transform/filter allowed
 * (post-layout — tilt); NO layout-detaching props. */
export type SkinRootStyle = Pick<
  CSSProperties,
  'transform' | 'transformOrigin' | 'filter' | 'opacity' | 'mixBlendMode' | 'isolation'
>;

/** Visual-only style for the content box. NO position/overflow/height/
 * display/inset — those are the host's invariant. Background image props
 * are allowed (skin via data-URI/url; see spec §5 image/SVG). */
export type SkinBoxStyle = Pick<
  CSSProperties,
  | 'background' | 'backgroundColor' | 'backgroundImage' | 'backgroundSize'
  | 'backgroundRepeat' | 'backgroundPosition' | 'backgroundClip'
  | 'border' | 'borderTop' | 'borderLeft' | 'borderBottom' | 'borderRadius' | 'borderImage'
  | 'padding' | 'color' | 'boxShadow' | 'fontSize' | 'lineHeight'
  | 'scrollbarWidth'
>;

export type BlockSkin = {
  id: string;
  name: string;
  /** Kinds this skin may be picked for; omitted = all. */
  kinds?: string[];
  root?: { className?: string; style?: SkinRootStyle };
  /** Per-block root visual (e.g. blockId-derived tilt); merged AFTER root.style.
   * Still SkinRootStyle, so it can't express layout-breaking props. */
  rootStyleOf?: (ctx: SkinCtx) => SkinRootStyle;
  box?: { className?: string; style?: SkinBoxStyle };
  behind?: (ctx: SkinCtx) => ReactNode;
  front?: (ctx: SkinCtx) => ReactNode;
};

export const DEFAULT_SKIN_ID = '__default';

/** A theme's per-kind default look may be a single skin or a kind→skin fn
 * (stationery: image→polaroid, else paper). */
type DefaultSkin = BlockSkin | ((kind: string) => BlockSkin);

function skinApplies(s: BlockSkin, kind: string): boolean {
  return !s.kinds || s.kinds.includes(kind);
}

/** The framework default skin (the graph-paper-ish card). Imported lazily
 * via the block-kinds DEFAULT_SKIN at the frame-core; here we only need its
 * id for fallback identity, so resolveSkin returns a tokens-driven minimal
 * skin when the theme defines nothing. */
const FRAMEWORK_DEFAULT: BlockSkin = {
  id: DEFAULT_SKIN_ID,
  name: 'Default',
  // box styling is supplied by the frame-core's DEFAULT_SKIN tokens at render;
  // this object exists so resolveSkin always returns a BlockSkin with the
  // sentinel id. The frame-core merges token-derived card styling for it.
};

/** Resolve the BlockSkin for a block: author pick (if applicable) → theme
 * default (per kind) → framework default. Always returns a skin. */
export function resolveSkin(theme: Theme, kind: string, skinId: string | null | undefined): BlockSkin {
  const skins = theme.skins;
  if (skinId && skins?.[skinId] && skinApplies(skins[skinId], kind)) return skins[skinId];
  const def = (theme as Theme & { defaultSkin?: DefaultSkin }).defaultSkin;
  if (def) return typeof def === 'function' ? def(kind) : def;
  return FRAMEWORK_DEFAULT;
}

/** Author-pickable skins for a kind (inspector/menu feed) — excludes the
 * theme default (that's the "no pick" state). Mirrors old shellOptionsFor. */
export function skinOptionsFor(theme: Theme, kind: string): Array<{ id: string; name: string }> {
  return Object.entries(theme.skins ?? {})
    .filter(([, s]) => skinApplies(s, kind))
    .map(([id, s]) => ({ id, name: s.name }));
}
```

- [ ] **Step 4: Extend `Theme` in `packages/theme/src/themes.ts`** — add the two optional fields to the `Theme` type (after `shells?`), leaving `BlockFrame`/`shells` in place FOR NOW (removed in Task 11):

```ts
// in `export type Theme = ThemeTokens & ThemeSlots & { ... }` add:
    /** The theme's base block look (replaces the BlockFrame slot). May be a
     * single skin or kind→skin (e.g. stationery image→polaroid). Omitted =
     * framework default skin. */
    defaultSkin?: import('./skin').BlockSkin | ((kind: string) => import('./skin').BlockSkin);
    /** Author-pickable block skins (replaces `shells`), keyed by persisted id. */
    skins?: Record<string, import('./skin').BlockSkin>;
```

- [ ] **Step 5: Export from `packages/theme/src/index.ts`** — add `export * from './skin';` (and ensure `BlockSkin` etc. are re-exported). Run `cd packages/theme && bun run test skin` → PASS; `bun run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/theme/src/skin.ts packages/theme/src/themes.ts packages/theme/src/index.ts packages/theme/src/__tests__/skin.test.ts
git commit -m "feat(theme): BlockSkin contract + resolveSkin/skinOptionsFor (frame-core slice)"
```

### Task 2: `BlockFrameCore` + `DEFAULT_SKIN`

**Files:**
- Create: `packages/block-kinds/src/BlockFrameCore.tsx`
- Test: `packages/block-kinds/src/__tests__/BlockFrameCore.test.tsx`

- [ ] **Step 1: Write the failing test** — `packages/block-kinds/src/__tests__/BlockFrameCore.test.tsx`

```tsx
// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider, graphPaper, type BlockSkin } from '@skb/theme';
import { BlockFrameCore } from '../BlockFrameCore';

afterEach(cleanup);

const skin: BlockSkin = {
  id: 's', name: 'S',
  root: { className: 'r', style: { transform: 'rotate(1deg)' } },
  box: { className: 'b', style: { padding: '7px' } },
  behind: () => <div data-testid="behind" />,
  front: () => <div data-testid="front" />,
};

function renderCore(autofit: boolean) {
  return render(
    <ThemeProvider theme={graphPaper}>
      <BlockFrameCore kind="markdown" blockId="x" colSpan={6} rowSpan={2} autofit={autofit} skin={skin}>
        <p data-testid="content">hi</p>
      </BlockFrameCore>
    </ThemeProvider>,
  );
}

describe('BlockFrameCore', () => {
  test('renders root + behind + content-box(content) + front', () => {
    const { getByTestId, container } = renderCore(false);
    expect(getByTestId('behind')).toBeTruthy();
    expect(getByTestId('front')).toBeTruthy();
    expect(getByTestId('content').textContent).toBe('hi');
    // content lives inside the host content box (the overflow owner)
    const box = container.querySelector('.skb-content-box') as HTMLElement;
    expect(box.contains(getByTestId('content'))).toBe(true);
  });

  test('content box owns overflow per autofit, and the HOST invariant props win over the skin', () => {
    const box = renderCore(true).container.querySelector('.skb-content-box') as HTMLElement;
    expect(box.style.overflow).toBe('hidden'); // autofit -> clip
    expect(box.style.position).toBe('relative'); // host-owned, skin can't change it
    expect(box.style.padding).toBe('7px'); // skin visual prop applied
    const auto = renderCore(false).container.querySelector('.skb-content-box') as HTMLElement;
    expect(auto.style.overflow).toBe('auto'); // non-autofit -> scroll
  });

  test('skin root style (tilt) lands on the root, not the box', () => {
    const root = renderCore(false).container.querySelector('.skb-frame-root') as HTMLElement;
    expect(root.style.transform).toBe('rotate(1deg)');
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `cd packages/block-kinds && bun run test BlockFrameCore` → FAIL.

- [ ] **Step 3: Implement `packages/block-kinds/src/BlockFrameCore.tsx`**

```tsx
/**
 * BlockFrameCore — the host-owned block frame (spec 2026-06-14 §4). Used by
 * the editor (GridCanvas), the published view (PublishedCanvas), AND the
 * autofit MeasureProbe — so "what is measured" == "what is rendered" by
 * construction. The `.skb-content-box` is the INVARIANT: always in normal
 * flow, establishes the content's natural height, and is the overflow/clip
 * container. The skin dresses it but its box/root styles are visual-only
 * (typed), and the host applies its invariant props LAST so a skin can never
 * reintroduce the absolute-positioned collapse. (ADR-0025 amendment.)
 */
import type { ReactNode } from 'react';
import { blockOverflow, kindHue, useTheme, type BlockSkin, type SkinCtx } from '@skb/theme';
import { DEFAULT_SKIN_ID } from '@skb/theme';

export type BlockFrameCoreProps = {
  kind: string;
  blockId: string;
  colSpan: number;
  rowSpan: number;
  autofit?: boolean;
  skin: BlockSkin;
  children: ReactNode;
};

export function BlockFrameCore({ kind, blockId, colSpan, rowSpan, autofit, skin, children }: BlockFrameCoreProps) {
  const theme = useTheme();
  const ctx: SkinCtx = {
    blockId, kind, colSpan, rowSpan,
    tokens: theme, // Theme is a superset of SkinCtx['tokens']
  };
  // Framework default skin: the graph-paper-ish card, token-driven. Applied
  // when the resolved skin is the sentinel (theme defined no skin).
  const isDefault = skin.id === DEFAULT_SKIN_ID;
  const defaultBox = isDefault
    ? {
        background: theme.blockBg,
        border: theme.blockBorder,
        borderTop: `2px solid ${kindHue(theme, kind)}`,
        borderRadius: theme.blockRadius,
        padding: '8px 10px',
        fontSize: '14px',
        lineHeight: 1.55,
        color: theme.textColor,
      }
    : {};

  return (
    <div
      className={`skb-frame-root${skin.root?.className ? ' ' + skin.root.className : ''}`}
      data-kind={kind}
      style={{ position: 'relative', width: '100%', height: '100%', ...skin.root?.style, ...skin.rootStyleOf?.(ctx) }}
    >
      {skin.behind?.(ctx)}
      <div
        className={`skb-content-box${skin.box?.className ? ' ' + skin.box.className : ''}`}
        style={{
          // skin visual props first…
          ...defaultBox,
          ...skin.box?.style,
          // …then the HOST INVARIANT wins (a skin cannot override these):
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: blockOverflow(autofit),
        }}
      >
        {children}
      </div>
      {skin.front?.(ctx)}
    </div>
  );
}
```

- [ ] **Step 4: Run it, verify PASS** — `cd packages/block-kinds && bun run test BlockFrameCore` → PASS. `bun run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add packages/block-kinds/src/BlockFrameCore.tsx packages/block-kinds/src/__tests__/BlockFrameCore.test.tsx
git commit -m "feat(block-kinds): host BlockFrameCore (measurable box + skin decoration)"
```

### Task 3: The cross-skin/kind invariant test (the guardrail)

This is the test that would have caught the stationery collapse. It renders the frame-core with each theme's resolved skins and asserts the content box is in normal flow (not absolutely positioned / not detached).

**Files:**
- Create: `packages/block-kinds/src/__tests__/frame-invariant.test.ts` (`.tsx`)

- [ ] **Step 1: Write the test** — `packages/block-kinds/src/__tests__/frame-invariant.test.tsx`

```tsx
// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider, THEMES, resolveSkin, skinOptionsFor } from '@skb/theme';
import { BlockFrameCore } from '../BlockFrameCore';

afterEach(cleanup);

const KINDS = ['markdown', 'richtext', 'image', 'code'];

// Every theme × every kind × (default skin + each author-pickable skin):
// the host content box must remain the overflow owner in normal flow. happy-dom
// has no layout, so we assert the STRUCTURE the invariant depends on: the
// content box carries the host inline invariants and the skin did not inject a
// forbidden prop (skin.box.style is type-restricted, but assert at runtime too).
describe('frame invariant: content box stays host-owned for every theme/kind/skin', () => {
  for (const [themeId, theme] of Object.entries(THEMES)) {
    for (const kind of KINDS) {
      const skinIds = [null, ...skinOptionsFor(theme, kind).map((o) => o.id)];
      for (const skinId of skinIds) {
        test(`${themeId} · ${kind} · ${skinId ?? 'default'}`, () => {
          const skin = resolveSkin(theme, kind, skinId);
          const { container } = render(
            <ThemeProvider theme={theme}>
              <BlockFrameCore kind={kind} blockId="b" colSpan={6} rowSpan={2} autofit skin={skin}>
                <p>content</p>
              </BlockFrameCore>
            </ThemeProvider>,
          );
          const box = container.querySelector('.skb-content-box') as HTMLElement;
          expect(box).toBeTruthy();
          // host invariants present and not overridden
          expect(box.style.position).toBe('relative');
          expect(box.style.overflow).toBe('hidden'); // autofit
          expect(box.style.height).toBe('100%');
          // the rendered content is inside the box (not a sibling/detached layer)
          expect(box.textContent).toContain('content');
        });
      }
    }
  }
});
```

- [ ] **Step 2: Run it** — `cd packages/block-kinds && bun run test frame-invariant`. It will FAIL for any theme that still lacks `skins`/`defaultSkin` (resolveSkin returns the framework default — which is fine; default-skin themes PASS). It exists now to guard Phases 2–3; expect PASS for token-only themes (graph-paper/ink/blueprint/workbench-base) and the framework default. (Themes with custom frames not yet migrated still resolve to the framework default until migrated — also PASS. The test fully bites once Phase 3 gives each theme its real skins.)

- [ ] **Step 3: Commit**

```bash
git add packages/block-kinds/src/__tests__/frame-invariant.test.tsx
git commit -m "test(block-kinds): cross-theme/kind/skin frame-invariant guardrail"
```

---

## Phase 2 — Stationery spike (hardest theme first; prove non-breaking)

### Task 4: Rebuild stationery as skins

Map [stationery.tsx](../../../packages/theme/src/stationery.tsx) layer-by-layer (spec §5 table). Current default frame: root `.skb-paper-slip` (tilt) > `.skb-washi`(front) + `.skb-curl`(behind) + `.skb-paper-edge`(behind) + `.skb-paper`(content, `position:absolute; inset:3px; padding:10px 8px 8px`). Image kind → polaroid.

**Files:**
- Modify: `packages/theme/src/stationery.tsx`

- [ ] **Step 1: Add a failing assertion to the invariant test scope** — confirm it currently treats stationery as framework-default (PASS today). Then write the migration so stationery resolves to real skins. (No new test file; Task 3 covers it + Task 13 e2e proves visual fidelity.)

- [ ] **Step 2: Implement the stationery skins** — replace the `*BlockFrame`/`PolaroidFrame`/`CardFrame`/`BareFrame` components with skin objects. Keep `tiltOf`/`curlSideOf`, `STATIONERY_GLOBAL_CSS`, `StationeryCanvasSurface`, `StationeryPageTitle` (CanvasSurface/PageTitle stay theme slots). Replace the theme tail:

```tsx
import type { BlockSkin, SkinCtx } from './skin';

// behind/front overlays reuse the existing aria-hidden markup (verbatim styles).
const paperSlipSkin: BlockSkin = {
  id: '__default', name: 'Paper slip',
  root: { className: 'skb-paper-slip', style: {} }, // transform set per-block below via behind? no — see note
  box: {
    className: 'skb-paper',
    style: { padding: '10px 8px 8px', fontSize: '14px', lineHeight: 1.55 },
  },
  behind: ({ blockId, colSpan }: SkinCtx) => {
    const curl = curlSideOf(blockId);
    return (
      <>
        <div aria-hidden className={`skb-curl skb-curl-${curl}`} />
        <div aria-hidden className="skb-paper-edge" />
      </>
    );
  },
  front: ({ blockId, colSpan, tokens }: SkinCtx) => {
    const tilt = tiltOf(blockId, colSpan).toFixed(3);
    const tape = tokens.kindHues['markdown'] ?? tokens.kindHueFallback; // washi hue; per-kind below
    return (
      <div aria-hidden className="skb-washi" style={{
        position: 'absolute', top: '-7px', left: '50%', width: '64px', height: '15px',
        transform: `translateX(-50%) rotate(${(-Number(tilt) * 1.7).toFixed(3)}deg)`,
        background: tape, opacity: 0.78, boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)', zIndex: 3,
      }} />
    );
  },
};
```

> **Tilt note (important):** today the tilt is `transform: rotate(...)` on the slip root, computed per block from `blockId`. `skin.root.style` is static, so move the per-block tilt into the frame-core via a skin root style that reads `ctx`. Two clean options — pick (A) for this slice:
> **(A)** Add an optional `rootStyleOf?: (ctx: SkinCtx) => SkinRootStyle` to `BlockSkin` (merged after `root.style` in BlockFrameCore). Stationery sets `rootStyleOf: ({blockId,colSpan}) => ({ transform: `rotate(${tiltOf(blockId,colSpan)}deg)` })`. This keeps tilt visual-only and per-block.
> Update Task 1 `BlockSkin` to include `rootStyleOf?: (ctx: SkinCtx) => SkinRootStyle;` and Task 2 frame-core to merge `{...skin.root?.style, ...skin.rootStyleOf?.(ctx)}` into the root style. (Add this to Task 1/2 before implementing Task 4.)

Because the washi tape hue + tilt + the curl differ by block and the box background (scroll-curl gradients) lives in `STATIONERY_GLOBAL_CSS` keyed on `.skb-paper`, the box `className:'skb-paper'` keeps that CSS working. The 3px torn rim: set `root.style` (static) `padding: '3px'` so the content box insets 3px and `.skb-paper-edge` (behind, absolute `inset:0`) shows in the rim. Add `padding: '3px'` to `paperSlipSkin.root.style`.

The image polaroid + card + bare become skins:

```tsx
const polaroidSkin: BlockSkin = {
  id: '__default-image', name: 'Polaroid', kinds: ['image'],
  rootStyleOf: ({ blockId, colSpan }) => ({ transform: `rotate(${(tiltOf(blockId, colSpan) * 1.4).toFixed(3)}deg)` }),
  // the dark photo window is the content box; the card + gloss are overlays
  box: { className: 'skb-paper', style: { background: 'oklch(30% 0.01 80)', padding: 0, color: 'oklch(90% 0.01 80)', boxShadow: 'inset 0 1px 3px oklch(0% 0 0 / 45%), inset 0 0 1px oklch(0% 0 0 / 55%)' } },
  behind: () => (
    <div aria-hidden className="skb-polaroid-card" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(178deg, oklch(98% 0.004 95), oklch(97% 0.005 95))', boxShadow: 'inset 0 0 0 1px oklch(93% 0.008 95), 0 3px 8px oklch(38% 0.04 60 / 26%), 0 1px 2px oklch(38% 0.04 60 / 14%)', padding: '10px 10px 30px' }} />
  ),
  front: ({ blockId, colSpan, tokens }) => {
    const tilt = (tiltOf(blockId, colSpan) * 1.4).toFixed(3);
    const tape = tokens.kindHues['image'] ?? tokens.kindHueFallback;
    return (<>
      <div aria-hidden className="skb-washi" style={{ position: 'absolute', top: '-7px', left: '50%', width: '58px', height: '14px', transform: `translateX(-50%) rotate(${(-Number(tilt) * 1.2).toFixed(3)}deg)`, background: tape, opacity: 0.78, boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)', zIndex: 3 }} />
      <div aria-hidden className="skb-polaroid-gloss" style={{ position: 'absolute', inset: '10px 10px 30px', pointerEvents: 'none', zIndex: 2 }} />
    </>);
  },
};

const cardSkin: BlockSkin = {
  id: 'card', name: 'Card',
  rootStyleOf: ({ blockId, colSpan }) => ({ transform: `rotate(${tiltOf(blockId, colSpan).toFixed(3)}deg)` }),
  box: { className: 'skb-paper', style: { padding: '10px 8px 8px', fontSize: '14px', lineHeight: 1.55, borderRadius: '3px', boxShadow: 'inset 0 0 0 1px oklch(93% 0.008 95), 0 3px 8px oklch(38% 0.04 60 / 26%), 0 1px 2px oklch(38% 0.04 60 / 14%)' } },
  front: ({ blockId, colSpan, tokens }) => { const tilt = tiltOf(blockId, colSpan).toFixed(3); const tape = tokens.kindHues['markdown'] ?? tokens.kindHueFallback; return (<div aria-hidden className="skb-washi" style={{ position: 'absolute', top: '-7px', left: '50%', width: '64px', height: '15px', transform: `translateX(-50%) rotate(${(-Number(tilt) * 1.7).toFixed(3)}deg)`, background: tape, opacity: 0.78, boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)', zIndex: 3 }} />); },
};

const bareSkin: BlockSkin = {
  id: 'bare', name: 'Bare',
  rootStyleOf: ({ blockId, colSpan }) => ({ transform: `rotate(${tiltOf(blockId, colSpan).toFixed(3)}deg)`, filter: 'drop-shadow(0 3px 7px oklch(38% 0.04 60 / 30%))' }),
  box: { style: { fontSize: '14px', lineHeight: 1.55, scrollbarWidth: 'none' } },
};
```

Replace the theme object tail:

```tsx
export const stationery: Theme = {
  ...TOKENS,
  CanvasSurface: StationeryCanvasSurface,
  PageTitle: StationeryPageTitle,
  globalCss: STATIONERY_GLOBAL_CSS,
  defaultSkin: (kind: string) => (kind === 'image' ? polaroidSkin : paperSlipSkin),
  skins: { card: cardSkin, bare: bareSkin },
  palettes: [/* unchanged kraft */],
  papers: [/* unchanged */],
};
```

Add `root.style.padding: '3px'` to `paperSlipSkin` (the rim). Remove `BlockFrame`/the old `*Frame` components.

- [ ] **Step 3: Typecheck + invariant test** — `cd packages/theme && bun run typecheck` (clean); `cd packages/block-kinds && bun run test frame-invariant` → stationery cases now exercise real skins, PASS (box stays in-flow; overlays are siblings).

- [ ] **Step 4: Visual fidelity spike (manual, the proof)** — start the dev server + a page using stationery with a markdown block, an image block, and card/bare skins (or seed via API like `e2e/fixtures/login.ts`). Compare against `git stash` of pre-Task-4 render. Confirm: tilt, washi, torn edge, curl, 3px rim, polaroid window all visually match. Document any delta. **If a layer can't reproduce, STOP and report — this is the spike's purpose.**

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/stationery.tsx packages/theme/src/skin.ts packages/block-kinds/src/BlockFrameCore.tsx
git commit -m "feat(theme): stationery -> BlockSkin (spike; +rootStyleOf for per-block tilt)"
```

---

## Phase 3 — Migrate the remaining custom themes + shared flat

### Task 5: galley → skins

[galley.tsx](../../../packages/theme/src/galley.tsx): default `GalleyBlockFrame` (in-flow `.skb-block`, padding 10/12, boxShadow, border) + `keyline` (border + outline offset) + `cutout` (drop-shadow, no padding). All in-flow → trivial skins (box style only, no overlays).

- [ ] **Step 1:** Replace the three `*Frame` components + theme tail in `galley.tsx`:

```tsx
import type { BlockSkin } from './skin';
const galleyDefaultSkin: BlockSkin = { id: '__default', name: 'Strip', box: { className: 'skb-block', style: { padding: '10px 12px', fontSize: '14.5px', lineHeight: 1.62, color: TOKENS.textColor, background: TOKENS.blockBg, border: TOKENS.blockBorder, boxShadow: '0 1px 2px oklch(40% 0.02 80 / 14%)', scrollbarWidth: 'thin' } } };
const keylineSkin: BlockSkin = { id: 'keyline', name: 'Keyline', box: { className: 'skb-block', style: { padding: '14px 16px', fontSize: '14.5px', lineHeight: 1.62, color: TOKENS.textColor, background: TOKENS.blockBg, border: `1px solid ${TOKENS.textColor}`, scrollbarWidth: 'thin' } } };
const cutoutSkin: BlockSkin = { id: 'cutout', name: 'Cutout', box: { className: 'skb-block', style: { fontSize: '14.5px', lineHeight: 1.62, color: TOKENS.textColor, scrollbarWidth: 'thin' } } };
```

> **Note on keyline's `outline + outlineOffset`:** `outline`/`outlineOffset` are not in `SkinBoxStyle`. Move the keyline outer-frame to `GALLEY_GLOBAL_CSS` keyed on `.skb-content-box[data-…]` — simpler: add to `keylineSkin.box.className` a marker class `skb-keyline` and put `.skb-keyline { outline: 1px solid <hairline>; outline-offset: 3px; }` in `GALLEY_GLOBAL_CSS`. (globalCss already carries `.skb-block` rules.) Use `t.hairline` value inline in the CSS string (galley globalCss is a static template — substitute the literal hairline value `oklch(86% 0.018 90)`).
> cutout's `filter: drop-shadow` is also not in SkinBoxStyle and belongs on the root, not the box — set `cutoutSkin.root = { style: { filter: 'drop-shadow(0 1px 2px oklch(40% 0.02 80 / 18%))' } }` instead.

Theme tail:

```tsx
export const galley: Theme = { ...TOKENS, CanvasSurface: GalleyCanvasSurface, PageTitle: GalleyPageTitle, globalCss: GALLEY_GLOBAL_CSS, defaultSkin: galleyDefaultSkin, skins: { keyline: keylineSkin, cutout: cutoutSkin }, palettes: [/* unchanged */], customizableTokens: ['fontFamily', 'accent'], papers: [/* unchanged */] };
```

- [ ] **Step 2:** typecheck + `bun run test frame-invariant` (galley cases PASS). Commit `feat(theme): galley -> BlockSkin`.

### Task 6: marginalia → skins

[marginalia.tsx](../../../packages/theme/src/marginalia.tsx): default (in-flow `.skb-block`, transparent, padding 8/10) + `plate` (light bg + hairline border) + `aside` (muted, left accent border). All in-flow → box-only skins.

- [ ] **Step 1:** Replace `MarginaliaBlockFrame`/`PlateFrame`/`AsideFrame` + theme tail:

```tsx
import type { BlockSkin } from './skin';
const marginaliaDefaultSkin: BlockSkin = { id: '__default', name: 'Page', box: { className: 'skb-block', style: { padding: '8px 10px', fontSize: '15px', lineHeight: 1.7, color: TOKENS.textColor, scrollbarWidth: 'thin' } } };
const plateSkin: BlockSkin = { id: 'plate', name: 'Plate', box: { className: 'skb-block', style: { padding: '12px 14px', fontSize: '15px', lineHeight: 1.7, color: TOKENS.textColor, border: `1px solid ${TOKENS.hairline}`, background: 'oklch(99% 0.004 90)', scrollbarWidth: 'thin' } } };
const asideSkin: BlockSkin = { id: 'aside', name: 'Aside', box: { className: 'skb-block', style: { padding: '4px 10px 4px 12px', fontSize: '13px', lineHeight: 1.65, color: TOKENS.quoteColor, borderLeft: `2px solid ${TOKENS.accent}`, scrollbarWidth: 'thin' } } };
```

> `borderLeft` is in `SkinBoxStyle`? It's not in the Task-1 list — add `'borderLeft'` to `SkinBoxStyle`'s Pick (it's visual-only; also add `'borderTop'` already present). Update Task 1 `SkinBoxStyle` to include `borderLeft`.

Theme tail mirrors galley (`defaultSkin: marginaliaDefaultSkin`, `skins: { plate: plateSkin, aside: asideSkin }`).

- [ ] **Step 2:** typecheck + invariant test + commit `feat(theme): marginalia -> BlockSkin`.

### Task 7: shared flat skin (`shells.tsx`) + workbench

[shells.tsx](../../../packages/theme/src/shells.tsx) `FlatShellFrame` (in-flow `.skb-block`, no border, padding 8/10). [workbench.ts](../../../packages/theme/src/workbench.ts) uses it as `shells:{flat}`.

- [ ] **Step 1:** In `shells.tsx`, replace `FlatShellFrame` with `flatSkin` (export it):

```tsx
import type { BlockSkin } from './skin';
export const flatSkin: BlockSkin = { id: 'flat', name: 'Flat', box: { className: 'skb-block', style: { padding: '8px 10px', fontSize: '14px', lineHeight: 1.55 } } };
// color comes from the theme default skin / tokens; flat is structureless.
```

- [ ] **Step 2:** In `workbench.ts`, replace `import { FlatShellFrame }` + `shells: { flat: { name:'Flat', Frame: FlatShellFrame } }` with `import { flatSkin }` + `skins: { flat: flatSkin }`. workbench has no `defaultSkin` (token-only) → uses framework default. Commit `feat(theme): flat shell -> flatSkin; workbench skins`.

### Task 8: confirm token-only themes need no migration

- [ ] **Step 1:** Verify `graphPaper`, `ink` (themes.ts), `blueprint.ts` define no `BlockFrame`/`shells` → they resolve to the framework `DEFAULT_SKIN` automatically. No code change. Add/confirm the invariant test covers them (Task 3 already iterates `THEMES`). Run `cd packages/block-kinds && bun run test frame-invariant` → all 7 themes PASS. No commit (verification only) unless a gap is found.

---

## Phase 4 — Wire `BlockFrameCore` into the three render sites; retire `BlockFrame`/`shells`

### Task 9: PublishedCanvas uses BlockFrameCore + resolveSkin

**Files:** Modify `packages/block-kinds/src/PublishedCanvas.tsx`

- [ ] **Step 1:** Replace the frame resolution + usage. Remove `resolveBlockFrame`/`theme.BlockFrame` use; import `resolveSkin` and `BlockFrameCore`:

```tsx
import { resolveSkin, useTheme, type PageBackground } from '@skb/theme';
import { BlockFrameCore } from './BlockFrameCore';
// …inside the map:
const skin = resolveSkin(theme, b.kind, b.shell);
return (
  <div key={b.id} style={{ position: 'absolute', left: `${b.col*SLOT+PAD}px`, top: `${b.row*SLOT+PAD}px`, width: `${b.colSpan*SLOT-2*PAD}px`, height: `${b.rowSpan*SLOT-2*PAD}px` }}>
    <BlockFrameCore kind={b.kind} blockId={b.id} colSpan={b.colSpan} rowSpan={b.rowSpan} autofit={b.autofit} skin={skin}>
      {mod ? <mod.RenderView content={(b.content ?? mod.createContent()) as never} /> : <div style={{ color: theme.mutedColor, fontStyle: 'italic', fontSize: '13px' }}>Unsupported content</div>}
    </BlockFrameCore>
  </div>
);
```

Keep `b.shell` as the persisted skin id (rename to `b.skin` is a north-star data-rename; this slice keeps the field name `shell` to avoid a data migration — `resolveSkin` reads it as the skin id). Note this in the code comment.

- [ ] **Step 2:** `cd packages/block-kinds && bun run typecheck && bun run test` → existing publish tests pass (the static output structure changes: `.skb-block`→`.skb-frame-root > .skb-content-box`; update any snapshot/assert in `__tests__/static.test.ts` / `frames-autofit.test.ts` to the new structure — assert overflow on `.skb-content-box`). Commit `feat(block-kinds): publish path renders via BlockFrameCore + resolveSkin`.

### Task 10: GridCanvas + MeasureProbe use BlockFrameCore; remove markdown gates

**Files:** Modify `apps/web/src/grid/GridCanvas.tsx`, `apps/web/src/grid/MeasureProbe.tsx`

- [ ] **Step 1: MeasureProbe** — replace `resolveBlockFrame(theme,...) ?? theme.BlockFrame ?? DefaultBlockFrame` with `resolveSkin(theme, kind, shell)` + `BlockFrameCore`. The probe wraps the SAME core (measurement == render):

```tsx
import { resolveSkin, useTheme } from '@skb/theme';
import { BlockFrameCore } from '@skb/block-kinds';
// in component:
const skin = resolveSkin(theme, kind, shell);
// …in JSX (inside the offscreen, definite-height probe wrapper):
<BlockFrameCore kind={kind} blockId={blockId} colSpan={colSpan} rowSpan={1} autofit skin={skin}>
  <div ref={areaRef} data-skb-measure-area style={{ height: '100%' }}>
    <div ref={contentRef} data-skb-measure-content><Render content={safe} /></div>
  </div>
</BlockFrameCore>
```

Update `MeasureProbe.test.tsx` only if its frame-resolution stubs change (it injects offsetHeights on the area/content nodes — unaffected by the wrapper swap). Run `cd apps/web && bun run test MeasureProbe` → PASS.

- [ ] **Step 2: GridCanvas frame resolution** — replace line 182 `const Frame = resolveBlockFrame(...) ?? ...` with `const skin = resolveSkin(theme, block.kind, shell);` and replace the `<Frame …>` wrapper (lines 309–333) with `<BlockFrameCore kind={block.kind} blockId={block.id} colSpan={block.colSpan} rowSpan={block.rowSpan} autofit={isAutofit} skin={skin}>` — keeping the inner flex/height wrapper (active 100% / inactive auto) as the children. Update imports (`resolveSkin`, `skinOptionsFor`, `BlockFrameCore`; drop `resolveBlockFrame`, `shellOptionsFor`, `DefaultBlockFrame`).

- [ ] **Step 3: Remove markdown gate #1 (toggle, line 241)** — make "auto height" appear for any autofit-available kind. Replace the `block.kind === 'markdown' ? [...] : []` with a check on the kind module's autofit availability:

```tsx
...(blockModule(block.kind)?.autofit !== false
  ? [{ label: 'auto height', checked: isAutofit, onSelect: () => interaction.setAutofit(block.id, isAutofit ? 'off' : 'grow') } as MenuItem]
  : []),
```

- [ ] **Step 4: Remove markdown gate #2 (MeasureProbe mount, line 338)** — `{isActive && isAutofit && blockModule(block.kind)?.autofit !== false && (<MeasureProbe … />)}`. (`isAutofit` already implies autofit is on; the `!== false` guard is belt-and-suspenders for kinds that declared unavailable.)

- [ ] **Step 5: Replace `shellOptionsFor` → `skinOptionsFor`** at GridCanvas:221 (menu) — same shape `{id,name}`, just the new fn. (Also `apps/web/src/grid/Properties.tsx:145` — change `shellOptionsFor` → `skinOptionsFor`; identical signature.)

- [ ] **Step 6:** `cd apps/web && bun run typecheck && bun run test` → PASS. Commit `feat(web): editor renders via BlockFrameCore; un-gate autofit menu/probe from markdown`.

### Task 11: Retire `BlockFrame`/`shells`/`resolveBlockFrame`/`shellOptionsFor`/`ShellDefinition`/`DefaultBlockFrame`

**Files:** Modify `packages/theme/src/themes.ts`, `packages/theme/src/index.ts`, `packages/block-kinds/src/frames.tsx`, `packages/block-kinds/src/index.ts`

- [ ] **Step 1:** Confirm zero remaining consumers (`grep -rn "resolveBlockFrame\|shellOptionsFor\|ShellDefinition\|theme.BlockFrame\|\.shells\|DefaultBlockFrame" apps packages --include=*.ts --include=*.tsx`). Expect only the definitions + tests.

- [ ] **Step 2:** Remove from `themes.ts`: `ShellDefinition` type, `shells?`/`BlockFrame?` from `Theme`/`ThemeSlots`, `resolveBlockFrame`, `shellOptionsFor`. Keep `BlockFrameProps`? It's now only the legacy frame signature — remove if unused (the new core uses `BlockFrameCoreProps`); grep first. Keep `blockCardStyle` only if still used (the default skin inlines its own; grep — likely removable). Remove `DefaultBlockFrame`/`DefaultCanvasSurface` export of the block frame from `frames.tsx` (keep `DefaultCanvasSurface`/`DefaultPageTitle` — CanvasSurface/PageTitle stay). Update `PublishedCanvas.tsx` import (`Frame = theme.BlockFrame ?? DefaultBlockFrame` line is already gone from Task 9).

- [ ] **Step 3:** Delete the old per-theme frame unit tests that referenced `BlockFrame`/`shells` (e.g. `slots.test.ts` assertions about `theme.shells`); rewrite them to assert `theme.skins`/`resolveSkin`. Run all package tests (`packages/theme`, `packages/block-kinds`, `apps/web`) → green; all typechecks clean.

- [ ] **Step 4:** Commit `refactor(theme): remove BlockFrame/shells/resolveBlockFrame (superseded by BlockFrameCore + BlockSkin)`.

---

## Phase 5 — Autofit as a block-base capability

### Task 12: `BlockKindModule.autofit` field + 4 modules + un-gate seeding

**Files:** Modify `packages/block-kinds/src/types.ts`, the 4 `*/index.ts`, `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Write the failing test** — `packages/block-kinds/src/__tests__/autofit-policy.test.ts`

```ts
import { describe, expect, test } from 'vitest';
import { blockModule } from '../registry';

describe('per-kind autofit policy', () => {
  test('text kinds default to grow', () => {
    for (const k of ['markdown', 'richtext', 'code']) {
      expect(blockModule(k)?.autofit).toEqual({ default: 'grow' });
    }
  });
  test('image is autofit-unavailable', () => {
    expect(blockModule('image')?.autofit).toBe(false);
  });
});
```

- [ ] **Step 2: Run it** → FAIL (field absent).

- [ ] **Step 3: Add the type** in `types.ts` `BlockKindModule`:

```ts
  /** Autofit policy (spec 2026-06-14 §6): `false` = autofit unavailable for
   * this kind (no toggle, no probe); `{ default }` = available, new blocks
   * seed to that mode; omitted = available, default off. */
  autofit?: false | { default: 'off' | 'grow' | 'grow+shrink' };
```

- [ ] **Step 4: Add to the 4 modules** — `markdown/index.ts`, `richtext/index.ts`, `code/index.ts`: `autofit: { default: 'grow' },`. `image/index.ts`: `autofit: false,`.

- [ ] **Step 5: Un-gate seeding** in `EditorPage.tsx` `onBlockInserted` (replace the `if (block.kind === 'markdown')` block):

```ts
onBlockInserted: (block: Block) => {
  const mod = blockModule(block.kind);
  setContents((c) => ({ ...c, [block.id]: mod ? mod.createContent() : null }));
  const af = mod?.autofit;
  if (af && af !== false && af.default !== 'off') {
    interaction.setAutofit(block.id, af.default);
    interaction.setMinRowSpan(block.id, block.rowSpan);
  }
},
```

- [ ] **Step 6:** `cd packages/block-kinds && bun run test autofit-policy` → PASS; `cd apps/web && bun run typecheck && bun run test` → PASS. Commit `feat: autofit is a per-kind block-base capability (image unavailable, text grow)`.

---

## Phase 6 — Tests: generalize e2e

### Task 13: generalize `fit-shells` e2e to all themes

**Files:** Modify `e2e/autofit-fit-shells.spec.ts`

- [ ] **Step 1:** Change the theme loop to cover every theme with autofit-relevant frames. Replace `for (const themeId of ['galley', 'stationery'] as const)` with `for (const themeId of ['graph-paper','ink','blueprint','workbench','galley','stationery','marginalia'] as const)`. The assertion already targets the clip container via `.skb-md`'s parent (Fix D) — under the new structure that parent is `.skb-content-box`; update the selector to `[data-block-id="G"] .skb-content-box` (more robust than `.skb-md`'s parent). Keep the `scrollHeight <= clientHeight + 1` assertion.

- [ ] **Step 2:** (Servers must be running — see Task 14 note.) `bun x playwright test autofit-fit-shells` → all theme rows green. Commit `test(e2e): fit-shells across all themes`.

### Task 14: autofit-on-all-kinds e2e

**Files:** Create `e2e/autofit-all-kinds.spec.ts`

- [ ] **Step 1:** Write a spec that, on graph-paper, creates a richtext block and a code block with `autofit:'grow'` + a long content, asserts each grew (height > 1 row), and creates an image block and asserts the "auto height" affordance is ABSENT (image autofit-unavailable). Use the `createMarkdownPage`/`createPage` helper shape in [e2e/fixtures/login.ts](../../../e2e/fixtures/login.ts) (generalize it to arbitrary kinds, or inline a `createPage` with `blocks` of mixed kinds).

```ts
import { expect, test } from '@playwright/test';
import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

test('autofit grows richtext + code; image has no auto-height toggle', async ({ page }) => {
  await loginViaApi(page);
  const { id } = await createMarkdownPage(page.request, {
    title: 'autofit kinds', themeId: 'graph-paper',
    blocks: [
      { id: 'R', kind: 'richtext', col: 0, row: 0, colSpan: 4, rowSpan: 1, autofit: 'grow', minRowSpan: 1, content: { doc: { type: 'doc', content: [] } } },
      { id: 'C', kind: 'code', col: 0, row: 2, colSpan: 4, rowSpan: 1, autofit: 'grow', minRowSpan: 1, content: { code: Array.from({length: 12}).map((_,i)=>`line ${i}`).join('\n'), lang: 'text' } },
      { id: 'I', kind: 'image', col: 6, row: 0, colSpan: 4, rowSpan: 3, autofit: 'off', minRowSpan: null, content: {} },
    ],
  });
  await page.goto(`/edit/${id}`);
  // code block committed at grow shows >1 row of content fitting its box
  const C = page.locator(sel.block('C'));
  await expect(C).toBeVisible();
  expect((await C.boundingBox())!.height).toBeGreaterThan(60); // > 1 slot
  // image block: right-click → no "auto height" item
  const I = page.locator(sel.block('I'));
  await I.click({ button: 'right' });
  await expect(page.getByText('auto height')).toHaveCount(0);
});
```

> The richtext/code/image `content` shapes must match each module's `createContent()` — confirm exact shapes when implementing (read `richtext/richtext.ts`, `code/code.ts`, `image/image.ts`). Adjust the literals to the real shapes; do not guess.

- [ ] **Step 2:** Run it (servers up) → PASS. Commit `test(e2e): autofit across kinds (text grows, image unavailable)`.

> **Running e2e (Task 13/14):** Playwright's `webServer` uses POSIX `VAR=val cmd` syntax that Windows cmd.exe can't parse; start servers manually so `reuseExistingServer` reuses them. API: `SHCKB_AUTH_SECRET=e2e-secret-at-least-32-characters-long SHCKB_ADMIN_EMAIL=admin@local.dev SHCKB_ADMIN_PASSWORD=dev-admin-password SHCKB_BASE_URL=http://localhost:5173 SHCKB_DB_PATH=<tmp>/shckb-e2e/e2e.db PORT=3210 bun apps/server/src/index.ts`; web: `cd apps/web && SHCKB_API_TARGET=http://localhost:3210 bun x vite --port 5173 --strictPort`. Then `bun x playwright test`. (Use a throwaway DB — never the dev库.)

---

## Phase 7 — Docs (durability + decision record)

### Task 15: PRD Phase-2+ propagation (spec §9 deferred table)

**Files:** Modify `docs/product/prd/features/plugin-system/plugin-system.md`, `docs/product/prd/features/theme-system/theme-system.md`

- [ ] **Step 1:** Append a "Phase 2+ (deferred)" entry to **plugin-system.md** covering: UI-plugin extension type; frame-core replace/extend model (Open/Closed — replace-whole / extend-additive / no partial-modify; the box-capability a replacer must satisfy; shared invariant test as floor); published-asset safety gate; additive block capabilities. Reference the spec by path.
- [ ] **Step 2:** Append to **theme-system.md** Phase-2+: theme full simplification (move `CanvasSurface`/`PageTitle` out → theme = pure material); skin unification (`papers`+`palettes`+block `skins` → one skin concept; standalone skin packs); theme asset pipeline. Reference the spec.
- [ ] **Step 3:** Commit `docs(prd): record deferred UI-plugin pass (plugin-system + theme-system Phase 2+)`.

### Task 16: New ADR + amend ADR-0025/0028 + AUDIT entry

**Files:** Create `docs/engineering/decisions/ADR-00XX-host-frame-core-blockskin.md`; modify `ADR-0025-theme-slots.md`, `ADR-0028-autofit-gravity-carveout.md`, `AUDIT-2026-05.md`

- [ ] **Step 1:** Allocate the next ADR number (check the decisions dir). Write the ADR: decision = host `BlockFrameCore` + `BlockSkin` + autofit-for-all-kinds; context = the stationery collapse + the layering convergence; consequences; a "Deferred" section = spec §9 table; supersedes ADR-0025 §1/§2 (BlockFrame→host) and extends ADR-0028 (markdown→block-base). Form-C cite the spec + discussion doc (`187d33f`).
- [ ] **Step 2:** Add an amendment note at the top of ADR-0025 (§1/§2 BlockFrame allocation superseded by ADR-00XX) and ADR-0028 (autofit generalized). Add the new ADR to `AUDIT-2026-05.md` per its register format (PRD-informed).
- [ ] **Step 3:** Commit `docs(adr): host frame-core + BlockSkin ADR; amend ADR-0025/0028; AUDIT entry`.

---

## Self-Review (controller checklist — done at plan-author time)

**1. Spec coverage:** §3 ownership → Tasks 1–2,9–10 (frame-core is the hub). §4 frame-core + type-enforced box → Task 2 (host invariants applied last; `SkinBoxStyle` restricted). §5 BlockSkin + image/SVG + stationery map + fallback → Tasks 1,4 (`SkinBoxStyle` includes background-image; `resolveSkin` framework-default fallback). §6 autofit-for-all-kinds → Task 12 (+ un-gate Task 10). §7 Open/Closed extensibility → north-star (Task 15/16 records it; slice ships single core — consistent). §8 migration spike-first + scope boundary → Tasks 4 (spike) then 5–8; CanvasSurface/PageTitle untouched. §9 deferred + 3 homes → Tasks 15 (PRD) + 16 (ADR) + the spec itself. §10 ADR → Task 16. §12 tests → Tasks 3,13,14. **No gaps.**

**2. Placeholder scan:** No TBD/TODO. Two "confirm exact shape" notes (Task 14 content literals; Task 11 grep-before-remove) are verification instructions, not placeholders — each says exactly what to read. The stationery `rootStyleOf` addition is flagged to fold back into Tasks 1/2 before Task 4 (sequenced).

**3. Type consistency:** `BlockSkin` (Task 1) gains `rootStyleOf?` (Task 4 note) + `SkinBoxStyle` gains `borderLeft` (Task 6 note) — both must be added when implementing Task 1; flagged inline. `resolveSkin`/`skinOptionsFor` signatures match across Tasks 1,9,10. `BlockFrameCore` props (Task 2) used identically in Tasks 9,10. `autofit` field shape (`false | {default}`) consistent in Tasks 12 + the Task 10 menu guard (`!== false`). `DEFAULT_SKIN_ID` sentinel consistent (Task 1 export → Task 2 special-case).

**Inline fixes applied:** folded `rootStyleOf` and `borderLeft` requirements into the Task 1/2 implementation notes so the contract is complete before migrations consume it.
