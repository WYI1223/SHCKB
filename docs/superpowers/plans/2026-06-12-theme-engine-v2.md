# Theme Engine v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade themes from token sets to token + render slots (BlockFrame/CanvasSurface/PageTitle/globalCss), fix the dark-theme hardcode gap with three surface tokens, and rebuild Stationery as the deep showcase (rotation, washi tape, deckle edge, texture, shadow, mount animation) — per [2026-06-12-theme-engine-v2-design.md](../specs/2026-06-12-theme-engine-v2-design.md).

**Architecture:** Theme type gains optional component slots; defaults (extracted from current PublishedCanvas/GridCanvas rendering) live in `packages/block-kinds/src/frames.tsx`, so token-only themes render pixel-equivalent and need zero migration. Canvas owns geometry (outer positioned div), theme owns the visual shell (inner BlockFrame). globalCss is injected by ThemeProvider (SPA) and renderStaticPage (static head). Stationery's slot components live beside its tokens and reference them by closure — NEVER via useTheme (stationery→context→themes→stationery would be a runtime import cycle, the same TDZ class of bug Bun hit in MVP-4).

**Tech Stack:** Existing React/Bun stack; pure CSS effects (clip-path-free zigzag via gradient ::after, repeating-gradient texture, @keyframes mount animation, prefers-reduced-motion).

**Branch:** continue on `feat/style-round`.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/theme/src/themes.ts` | Modify: +3 surface tokens on Theme; +ThemeSlots type (BlockFrameProps etc.); graphPaper/ink gain surface values |
| `packages/theme/src/workbench.ts`, `stationery.ts→stationery.tsx`, `blueprint.ts` | Modify: +3 surface values each; stationery converts to .tsx and gains slots + globalCss |
| `packages/theme/src/context.tsx` | Modify: ThemeProvider injects `<style>{theme.globalCss}</style>` |
| `packages/theme/src/__tests__/theme.test.ts` | Modify: completeness sweep covers new tokens |
| `packages/block-kinds/src/frames.tsx` | Create: DefaultBlockFrame / DefaultCanvasSurface / DefaultPageTitle (+ class hooks `skb-block`/`skb-canvas`/`data-kind`) |
| `packages/block-kinds/src/PublishedCanvas.tsx` | Modify: geometry/visual split; consume slots |
| `packages/block-kinds/src/static.ts` | Modify: append globalCss to head style |
| `packages/block-kinds/src/markdown/MarkdownRenderView.tsx`, `MarkdownEditView.tsx`, `image/*.tsx` | Modify: hardcoded light values → surface tokens |
| `apps/web/src/grid/GridCanvas.tsx` | Modify: BlockShell geometry/visual split; consume BlockFrame |
| `packages/block-kinds/src/__tests__/slots.test.ts` | Create: slot defaults, custom frame, determinism, globalCss injection |
| `docs/engineering/decisions/ADR-0025-theme-slots.md` + README row | Create |
| docs: CONTRACT.md touch, style-round build log | Modify |

---

### Task 1: Surface tokens (fixes the dark-theme hardcodes)

- [ ] **Step 1: Failing test** — in `packages/theme/src/__tests__/theme.test.ts`, extend the completeness key list:

```ts
      for (const key of [
        'canvasBg', 'dotColor', 'blockBg', 'blockBorder', 'blockRadius',
        'textColor', 'mutedColor', 'chromeBg', 'accent', 'danger',
        'kindHueFallback', 'codeCss',
        'surfaceInsetBg', 'hairline', 'quoteColor',
      ] as const) {
```

Run `cd packages/theme; bun run test` → FAIL (missing keys on every theme).

- [ ] **Step 2: Add tokens to the Theme type** in `themes.ts` (after `danger`):

```ts
  /** Inset surface inside blocks: markdown pre/inline-code chips. */
  surfaceInsetBg: string;
  /** Thin structural line: md table borders, missing-asset dashes. */
  hairline: string;
  /** Blockquote text color. */
  quoteColor: string;
```

- [ ] **Step 3: Values per theme** (extracted-from-current for graphPaper, dark-corrected for blueprint):

```ts
// graphPaper:
  surfaceInsetBg: 'oklch(95% 0.01 80)',
  hairline: 'oklch(85% 0.01 80)',
  quoteColor: 'oklch(50% 0.02 80)',
// ink (overrides after spread):
  surfaceInsetBg: 'oklch(96% 0 0)',
  hairline: 'oklch(80% 0.005 270)',
  quoteColor: 'oklch(45% 0.01 270)',
// workbench.ts:
  surfaceInsetBg: 'oklch(96.5% 0.003 260)',
  hairline: 'oklch(90% 0.005 260)',
  quoteColor: 'oklch(48% 0.015 260)',
// stationery:
  surfaceInsetBg: 'oklch(94% 0.02 90)',
  hairline: 'oklch(80% 0.04 75)',
  quoteColor: 'oklch(46% 0.05 60)',
// blueprint (the dark fix):
  surfaceInsetBg: 'oklch(22% 0.05 246)',
  hairline: 'oklch(60% 0.08 220 / 50%)',
  quoteColor: 'oklch(80% 0.06 218)',
```

- [ ] **Step 4: Consume in components** —
  - `MarkdownRenderView.tsx` scoped `<style>` template: `pre`/`code` background → `${theme.surfaceInsetBg}`; `th, td` border → `1px solid ${theme.hairline}`; `blockquote` border-left → `${theme.hairline}`, color → `${theme.quoteColor}`.
  - `MarkdownEditView.tsx` preview divider `1px dashed oklch(88% 0.01 80)` → `1px dashed ${theme.hairline}`.
  - `ImageRenderView.tsx` + `ImageEditView.tsx` fallback/placeholder `1px dashed oklch(85% 0.01 80)` → `1px dashed ${theme.hairline}`.

- [ ] **Step 5: Dark regression test** — append to `packages/block-kinds/src/__tests__/static.test.ts`:

```ts
import { blueprint } from '@skb/theme';

test('dark theme: markdown inline code uses surfaceInsetBg, not hardcoded light chip', () => {
  const doc = {
    title: 'dark',
    blocks: [{ id: 'm', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 2, content: { markdown: 'inline `code` here' } }],
  };
  const html = renderStaticPage(doc, 's', blueprint);
  expect(html).toContain(blueprint.surfaceInsetBg);
  expect(html).not.toContain('oklch(95% 0.01 80)'); // the old hardcode
});
```

- [ ] **Step 6: Run** theme + block-kinds + server suites → green. **Step 7: Commit** `feat(theme): surface tokens — surfaceInsetBg/hairline/quoteColor, dark-theme hardcodes repaired`

---

### Task 2: Render slots engine

- [ ] **Step 1: Slot types** in `themes.ts` (top, after React type import; add `import type { ComponentType, ReactNode } from 'react';`):

```ts
export type BlockFrameProps = { kind: string; blockId: string; children: ReactNode };
export type CanvasSurfaceProps = { widthPx: number; heightPx: number; children: ReactNode };
export type PageTitleProps = { title: string };

/** Optional render slots [ADR-0025]: a theme may replace the visual
 * shell of blocks/canvas/title and ship document-level CSS. Slots must
 * be deterministic (publishedHtml purity) and renderToStaticMarkup-safe.
 * Omitted slots fall back to the default rendering — token-only themes
 * stay valid unchanged. */
export type ThemeSlots = {
  BlockFrame?: ComponentType<BlockFrameProps>;
  CanvasSurface?: ComponentType<CanvasSurfaceProps>;
  PageTitle?: ComponentType<PageTitleProps>;
  /** Injected into SPA (via ThemeProvider) and static page head.
   * Carries @keyframes, pseudo-element decorations, texture. Must
   * include a prefers-reduced-motion: reduce guard for animations. */
  globalCss?: string;
};
```

and change `export type Theme = { …tokens… }` to `export type Theme = { …tokens… } & ThemeSlots;`

- [ ] **Step 2: Failing tests** — create `packages/block-kinds/src/__tests__/slots.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { createElement } from 'react';
import { graphPaper, type Theme } from '@skb/theme';
import { renderStaticPage } from '../static';

const DOC = {
  title: 'slots',
  blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'hello' } }],
};

describe('theme render slots', () => {
  test('default rendering exposes class hooks', () => {
    const html = renderStaticPage(DOC, 's', graphPaper);
    expect(html).toContain('class="skb-canvas"');
    expect(html).toContain('skb-block');
    expect(html).toContain('data-kind="markdown"');
  });

  test('custom BlockFrame replaces the shell; custom PageTitle replaces h1', () => {
    const themed: Theme = {
      ...graphPaper,
      id: 'custom',
      BlockFrame: ({ kind, blockId, children }) =>
        createElement('section', { className: 'my-frame', 'data-kind': kind, 'data-bid': blockId }, children),
      PageTitle: ({ title }) => createElement('h2', { className: 'my-title' }, title),
    };
    const html = renderStaticPage(DOC, 's', themed);
    expect(html).toContain('class="my-frame"');
    expect(html).toContain('data-bid="b1"');
    expect(html).toContain('<h2 class="my-title">slots</h2>');
    expect(html).toContain('hello'); // content still renders inside
  });

  test('globalCss lands in the static head', () => {
    const themed: Theme = { ...graphPaper, id: 'css', globalCss: '.skb-block{outline:1px solid red}' };
    const html = renderStaticPage(DOC, 's', themed);
    expect(html).toContain('.skb-block{outline:1px solid red}');
  });
});
```

Run → FAIL.

- [ ] **Step 3: Default frames** — create `packages/block-kinds/src/frames.tsx`:

```tsx
/**
 * Default render-slot implementations [ADR-0025] — exactly the visual
 * shell PublishedCanvas/GridCanvas rendered before slots existed, so
 * token-only themes render unchanged. Canvas owns geometry (position/
 * size); frames own the visual shell. Class hooks (skb-block /
 * skb-canvas / data-kind) are the stable surface for theme globalCss.
 */
import { blockCardStyle, canvasBaseplateStyle, useTheme } from '@skb/theme';
import type { BlockFrameProps, CanvasSurfaceProps, PageTitleProps } from '@skb/theme';

export function DefaultBlockFrame({ kind, blockId: _blockId, children }: BlockFrameProps) {
  const theme = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      style={{
        ...blockCardStyle(theme, kind),
        width: '100%',
        height: '100%',
        overflow: 'auto',
        fontSize: '14px',
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

export function DefaultCanvasSurface({ widthPx, heightPx, children }: CanvasSurfaceProps) {
  const theme = useTheme();
  return (
    <div
      className="skb-canvas"
      style={{ position: 'relative', width: `${widthPx}px`, height: `${heightPx}px`, ...canvasBaseplateStyle(theme) }}
    >
      {children}
    </div>
  );
}

export function DefaultPageTitle({ title }: PageTitleProps) {
  const theme = useTheme();
  return <h1 style={{ color: theme.textColor, fontSize: '26px', margin: '0 0 24px' }}>{title}</h1>;
}
```

- [ ] **Step 4: PublishedCanvas consumes slots** — rewrite the body:

```tsx
export function PublishedCanvas({ doc }: { doc: PublishedDocShape }) {
  const theme = useTheme();
  const rows = Math.max(1, ...doc.blocks.map((b) => b.row + b.rowSpan));
  const SLOT = theme.slot;
  const PAD = theme.pad;
  const Frame = theme.BlockFrame ?? DefaultBlockFrame;
  const Surface = theme.CanvasSurface ?? DefaultCanvasSurface;
  const Title = theme.PageTitle ?? DefaultPageTitle;

  return (
    <div style={{ background: theme.canvasBg, minHeight: '100vh' }}>
      <div style={{ maxWidth: `${COLS * SLOT}px`, margin: '0 auto', padding: '40px 20px' }}>
        <Title title={doc.title} />
        <Surface widthPx={COLS * SLOT} heightPx={rows * SLOT}>
          {doc.blocks.map((b) => {
            const mod = blockModule(b.kind);
            return (
              <div
                key={b.id}
                style={{
                  position: 'absolute',
                  left: `${b.col * SLOT + PAD}px`,
                  top: `${b.row * SLOT + PAD}px`,
                  width: `${b.colSpan * SLOT - 2 * PAD}px`,
                  height: `${b.rowSpan * SLOT - 2 * PAD}px`,
                }}
              >
                <Frame kind={b.kind} blockId={b.id}>
                  {mod ? (
                    <mod.RenderView content={(b.content ?? mod.createContent()) as never} />
                  ) : (
                    <div style={{ color: theme.mutedColor, fontStyle: 'italic', fontSize: '13px' }}>
                      Unsupported content
                    </div>
                  )}
                </Frame>
              </div>
            );
          })}
        </Surface>
      </div>
    </div>
  );
}
```

(imports: `DefaultBlockFrame, DefaultCanvasSurface, DefaultPageTitle` from './frames'; export frames from index.ts too.)

- [ ] **Step 5: globalCss injection** —
  - `packages/theme/src/context.tsx`:

```tsx
export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <ThemeContext.Provider value={theme}>
      {theme.globalCss ? <style>{theme.globalCss}</style> : null}
      {children}
    </ThemeContext.Provider>
  );
}
```

  - `packages/block-kinds/src/static.ts` head style gains `${theme.globalCss ?? ''}` after `${theme.codeCss}`.

- [ ] **Step 6: GridCanvas split** — in `apps/web/src/grid/GridCanvas.tsx`:
  - canvas div: replace the inline relative/size/baseplate div with `<Surface widthPx={state.totalCols * SLOT} heightPx={rows * SLOT}>` (Surface = `theme.CanvasSurface ?? DefaultCanvasSurface`); keep `data-skb-canvas` + drop props by wrapping: the outer div that carries `{...interaction.canvasDropProps(SLOT)}` and `data-skb-canvas` stays a plain positioned wrapper around Surface with `position: relative; width/height` matching — simplest correct form: keep the existing outer div but strip the baseplate style from it and nest Surface as its sole child with `position:absolute; inset:0` wrapper? NO — simpler and honest: keep outer div for interaction with width/height, render Surface inside it at 100% via a width/height pass-through. Implementation: outer div keeps `position: relative`, exact px width/height, drop props, `data-skb-canvas`; Surface is called with the same px numbers and rendered as its only child; DefaultCanvasSurface already renders `position: relative` + size — nested identical-size relative containers keep absolute children correct.
  - BlockShell: outer div keeps `data-block-id`, drag props, onClick, `position:absolute` + geometry, cursor/opacity, and when active `boxShadow: 0 0 0 2px ${theme.accent}` + `zIndex: 30` (replaces the old accent border swap — editing chrome stays editor-owned and works for any frame shape); DeleteButton + ResizeHandles stay in the outer div. Inside it, `<Frame kind={block.kind} blockId={block.id}>` wraps a flex-column div (`display:flex; flexDirection:column; height:100%; fontSize:'12px'; color: theme.textColor`) containing the existing header row + BlockBody.
  - The old `blockCardStyle(theme, block.kind)` spread on the outer div is removed (the Frame now owns it).

- [ ] **Step 7: Run** slots tests + all block-kinds + web typecheck + server suite → green (server static tests assert content/structure, unaffected by the wrapper div). Visual check on dev server: graph-paper looks identical to before. **Step 8: Commit** `feat(theme): render slots — BlockFrame/CanvasSurface/PageTitle/globalCss with pixel-equivalent defaults`

---

### Task 3: Stationery deep showcase

- [ ] **Step 1: Failing tests** — append to `slots.test.ts`:

```ts
import { stationery } from '@skb/theme';

describe('stationery deep showcase', () => {
  const DOC2 = {
    title: 'paper',
    blocks: [
      { id: 'alpha', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'a' } },
      { id: 'beta', kind: 'image', col: 6, row: 0, colSpan: 6, rowSpan: 2, content: { blobHash: null, alt: 'b' } },
    ],
  };

  test('deterministic: identical bytes across renders; distinct rotations per block', () => {
    const a = renderStaticPage(DOC2, 's', stationery);
    const b = renderStaticPage(DOC2, 's', stationery);
    expect(a).toBe(b);
    const angles = [...a.matchAll(/rotate\((-?[\d.]+)deg\)/g)].map((m) => m[1]);
    expect(new Set(angles).size).toBeGreaterThan(1); // alpha and beta tilt differently
  });

  test('washi tape carries the kind hue; globalCss ships keyframes + reduced-motion guard', () => {
    const html = renderStaticPage(DOC2, 's', stationery);
    expect(html).toContain(stationery.kindHues.markdown); // tape color present
    expect(html).toContain('@keyframes skb-paper-drop');
    expect(html).toContain('prefers-reduced-motion');
  });
});
```

- [ ] **Step 2: Convert** `packages/theme/src/stationery.ts` → `stationery.tsx` (git mv) and restructure: tokens first as a plain const, slot components referencing tokens **by closure** (⚠️ NEVER useTheme here — stationery→context→themes→stationery is a runtime import cycle, the Bun TDZ bug class from MVP-4):

```tsx
// after the existing token fields, refactored as:
const TOKENS = { /* the entire existing token object, unchanged + Task 1 additions */ };

/** djb2 → deterministic tilt in [-1.2°, 1.2°] (publishedHtml purity). */
function tiltOf(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000) * 2.4 - 1.2;
}

function StationeryBlockFrame({ kind, blockId, children }: BlockFrameProps) {
  const tilt = tiltOf(blockId);
  const tape = TOKENS.kindHues[kind] ?? TOKENS.kindHueFallback;
  return (
    <div
      className="skb-block skb-paper-slip"
      data-kind={kind}
      style={{ position: 'relative', width: '100%', height: '100%', transform: `rotate(${tilt}deg)` }}
    >
      <div
        aria-hidden
        className="skb-washi"
        style={{
          position: 'absolute',
          top: '-7px',
          left: '50%',
          width: '64px',
          height: '15px',
          transform: `translateX(-50%) rotate(${(-tilt * 1.7).toFixed(3)}deg)`,
          background: tape,
          opacity: 0.78,
          boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)',
          zIndex: 1,
        }}
      />
      <div
        className="skb-paper"
        style={{
          width: '100%',
          height: '100%',
          background: TOKENS.blockBg,
          border: TOKENS.blockBorder,
          borderRadius: TOKENS.blockRadius,
          padding: '12px 10px 10px',
          overflow: 'auto',
          fontSize: '14px',
          lineHeight: 1.55,
          boxShadow: '0 2px 5px oklch(40% 0.04 60 / 16%), 0 1px 2px oklch(40% 0.04 60 / 10%)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function StationeryCanvasSurface({ widthPx, heightPx, children }: CanvasSurfaceProps) {
  return (
    <div
      className="skb-canvas skb-desk"
      style={{
        position: 'relative',
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        backgroundImage: [
          // paper fiber texture (horizontal, very faint)
          `repeating-linear-gradient(0deg, transparent 0 2px, oklch(85% 0.02 90 / 7%) 2px 3px)`,
          // printed journal grid (the kraft dots)
          `radial-gradient(circle, ${TOKENS.dotColor} 1px, transparent 1px)`,
        ].join(', '),
        backgroundSize: `auto, ${TOKENS.slot}px ${TOKENS.slot}px`,
        backgroundPosition: `0 0, ${TOKENS.slot - 1}px ${TOKENS.slot - 1}px`,
      }}
    >
      {children}
    </div>
  );
}

function StationeryPageTitle({ title }: PageTitleProps) {
  return (
    <h1
      style={{
        color: TOKENS.textColor,
        fontSize: '26px',
        margin: '0 0 24px',
        paddingBottom: '6px',
        borderBottom: `2px dashed ${TOKENS.hairline}`,
        display: 'inline-block',
      }}
    >
      {title}
    </h1>
  );
}

const STATIONERY_GLOBAL_CSS = `
@keyframes skb-paper-drop {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.skb-paper-slip { animation: skb-paper-drop 240ms ease-out backwards; }
.skb-paper-slip .skb-paper { transition: box-shadow 160ms ease, translate 160ms ease; }
.skb-paper-slip:hover .skb-paper {
  translate: 0 -1.5px;
  box-shadow: 0 5px 12px oklch(40% 0.04 60 / 22%), 0 2px 4px oklch(40% 0.04 60 / 12%);
}
.skb-paper { position: relative; }
.skb-paper::after {
  content: '';
  position: absolute;
  left: 3px;
  right: 3px;
  bottom: -4px;
  height: 5px;
  background:
    linear-gradient(-45deg, transparent 70%, oklch(98% 0.013 95) 0) 0 0 / 10px 5px repeat-x,
    linear-gradient(45deg, transparent 70%, oklch(98% 0.013 95) 0) 5px 0 / 10px 5px repeat-x;
  filter: drop-shadow(0 1px 1px oklch(40% 0.04 60 / 14%));
}
@media (prefers-reduced-motion: reduce) {
  .skb-paper-slip { animation: none; }
  .skb-paper-slip .skb-paper { transition: none; }
}
`;

export const stationery: Theme = {
  ...TOKENS,
  BlockFrame: StationeryBlockFrame,
  CanvasSurface: StationeryCanvasSurface,
  PageTitle: StationeryPageTitle,
  globalCss: STATIONERY_GLOBAL_CSS,
};
```

(Note: the animation animates `transform: translateY` on `.skb-paper-slip`, which also carries the inline rotate — CSS animation overrides the inline transform during play and snaps to it at the end with `backwards` fill; if the snap is visually harsh in manual testing, move the drop animation to `.skb-paper` (translate only, no transform conflict) — decide by eye on the dev server, both forms are listed here so either is plan-conformant.)

Imports needed in stationery.tsx: `import type { BlockFrameProps, CanvasSurfaceProps, PageTitleProps, Theme } from './themes';`

- [ ] **Step 3: Run** slots tests + theme tests + full block-kinds + server suite → green. Re-render samples (`bun packages/theme/scripts/render-samples.ts`) and eyeball stationery.html + blueprint.html (inline code now readable). **Step 4: Commit** `feat(theme): stationery deep showcase — tilt, washi tape, deckle edge, texture, shadow, mount motion`

---

### Task 4: Docs — ADR-0025, CONTRACT touch, build log

- [ ] **Step 1: ADR-0025** (`docs/engineering/decisions/ADR-0025-theme-slots.md`, mirror ADR-0024 structure, Source = theme-engine-v2 spec): records (1) theme = tokens + optional render slots, amending ADR-0024's "theme = plain data" (purity survives: slots deterministic, randomness derived from block.id hash); (2) surface tokens closing the dark hardcode gap; (3) motion layering — mount/hover via globalCss now, exit/operation animations (tear-off, print-in) need editor deferred-unmount infra → theme-system future with `skb-anim-*` class convention reserved; (4) geometry/visual split (canvas owns position, theme owns shell, editor chrome stays outside frames); (5) alternatives rejected: full theme-as-component-tree (no token layer → every theme reimplements everything), CSS-variables-only theming (can't change structure, the exact ceiling owner rejected).
- [ ] **Step 2:** README index row; `packages/block-kinds/CONTRACT.md` adds a "BlockFrame 与 RenderView 边界" note (kind owns content rendering, theme owns the shell; RenderViews must not assume card chrome). AUDIT: blueprint inline-code row → repaid by surface tokens [ADR-0025].
- [ ] **Step 3:** style-round discussion build log entries; commit `docs(theme-v2): ADR-0025 + contract boundary + audit update`

---

### Task 5: Verification

- [ ] **Step 1:** All suites + typechecks (theme / block-kinds / web / server).
- [ ] **Step 2:** Export regression: server export/import round-trip tests green (publishedHtml not exported; settings/pin paths unchanged).
- [ ] **Step 3:** Re-render samples + screenshots for all 5 themes (`render-samples.ts` + the :8123 static server + Playwright full-page shots) — stationery shows tilt/tape/deckle/shadow; blueprint inline code readable; graph-paper/ink/workbench visually unchanged vs the style-round shots.
- [ ] **Step 4:** Dev-server smoke (remember: restart vite after package structure changes): editor on stationery — mount animation plays, hover lifts, drag/resize handles still work on tilted blocks, active ring visible.
- [ ] **Step 5:** Final commit; report to owner with screenshots. Do NOT merge (owner decides; merge target is feat/style-round → main together once showcase accepted).

---

## Self-review notes

- Spec §1 → Task 1 (3 tokens, 5 themes, component consumption, dark regression test). §2 → Task 2 (slots + defaults + class hooks + globalCss two-channel injection + GridCanvas split). §3 → Task 3 globalCss keyframes + reduced-motion (assert in test); exit-motion infra explicitly out (§7), `skb-anim-*` reserved in ADR. §4 → Task 3 showcase items 1-7 (rotation hash / washi / deckle / texture / mount / shadow / token reuse). §5 → Task 4. §6 → Tasks 1/3 tests + Task 5.
- Type consistency: `BlockFrameProps/CanvasSurfaceProps/PageTitleProps/ThemeSlots` defined Task 2 Step 1, consumed Tasks 2/3; `DefaultBlockFrame/DefaultCanvasSurface/DefaultPageTitle` defined Task 2 Step 3, consumed PublishedCanvas + GridCanvas; `tiltOf` local to stationery.
- Known watch-points for the executor: import cycle (stationery must NOT useTheme — closure over TOKENS); animation-vs-inline-transform conflict (both resolutions pre-approved in Task 3 note); vite restart after stationery.ts→.tsx rename; GridCanvas wrapper nesting must keep absolute-positioned overlays (DeleteButton/ResizeHandles) anchored to the outer geometry div.
