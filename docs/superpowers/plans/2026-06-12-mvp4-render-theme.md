# MVP-4 Render Unification + Theme Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify SSR/SPA rendering through shared packages, add a swappable theme layer (instance setting + per-page pin + re-render-all), add the code block kind, harden BlockKindModule into a formal contract, and ship export format v2 with the first real up/down transform pair — per [2026-06-12-mvp4-render-theme-design.md](../specs/2026-06-12-mvp4-render-theme-design.md).

**Architecture:** Two new workspace packages. `packages/theme`: Theme type + graph-paper/ink themes + parametrized style helpers + React ThemeContext. `packages/block-kinds`: BlockKindModule contract + HostServices context + markdown/image/code modules + shared `PublishedCanvas` + `renderStaticPage` (react-dom/server, publish-time only). The server's hand-written renderer dies; `publishedHtml` becomes a pure function of `(publishedDoc, slug, effectiveTheme)`. Theme data lives in a new `settings` table + nullable `notepages.theme_id`; both enter the export format → FORMAT_VERSION 2 with a real up/down pair.

**Tech Stack:** Existing Bun/Hono/Drizzle/React stack + `react-dom/server` (server, publish-time), `highlight.js` (code kind, sync API).

**Branch:** `feat/mvp4` off `main`.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/theme/package.json`, `tsconfig.json` | Create: workspace package (mirror grid-engine's setup + `"jsx": "react-jsx"`) |
| `packages/theme/src/index.ts` | Create: Theme type, `graphPaper`, `ink`, `THEMES`, `DEFAULT_THEME_ID`, `kindHue/blockCardStyle/canvasBaseplateStyle` (theme-parametrized) |
| `packages/theme/src/context.tsx` | Create: `ThemeContext` + `useTheme()` (default graphPaper) |
| `packages/theme/test/theme.test.ts` | Create: token completeness, theme divergence, helper parametrization |
| `packages/block-kinds/package.json`, `tsconfig.json` | Create: deps react, react-dom, react-markdown, remark-gfm, highlight.js, @skb/grid-engine, @skb/theme |
| `packages/block-kinds/src/types.ts` | Create (moved): BlockKindModule + new `HostServices` context |
| `packages/block-kinds/src/registry.ts` | Create (moved): 3 kinds, sole entry point |
| `packages/block-kinds/src/markdown/`, `src/image/` | Create (moved from apps/web/src/blocks, theme via useTheme, upload via useHost) |
| `packages/block-kinds/src/code/` | Create: code kind (language + source, hljs render) |
| `packages/block-kinds/src/PublishedCanvas.tsx` | Create: shared published-page layout (from ReadPage markup) |
| `packages/block-kinds/src/static.ts` | Create: `renderStaticPage(doc, slug, theme)` + `NOT_FOUND_HTML` (react-dom/server; web never imports this entry) |
| `packages/block-kinds/CONTRACT.md` | Create: formal module contract |
| `packages/block-kinds/test/*.test.ts` | Create: moved kind tests + static render + registry tests |
| `apps/web/src/theme/tokens.ts` | Rewrite: thin shim re-exporting graphPaper with legacy helper signatures (chrome files untouched) |
| `apps/web/src/blocks/**` | Delete (all moved) |
| `apps/web/src/grid/GridCanvas.tsx`, `pages/ReadPage.tsx`, `pages/EditorPage.tsx`, `shell/Shell.tsx`, `shell/Sidebar.tsx`, `api/client.ts` | Modify: package imports, ThemeProvider wiring, theme UI |
| `apps/server/src/render/publish-html.ts` | Rewrite: thin re-export of shared static renderer |
| `apps/server/src/db/schema.ts` + `drizzle/0006_*.sql` | Modify: `settings` table + `notepages.theme_id` (schema v6) |
| `apps/server/src/settings.ts` | Create: getSetting/setSetting + effective-theme resolution |
| `apps/server/src/routes/notepages.ts`, `routes/admin.ts`, `app.ts` | Modify: themed publish, settings endpoints, pin endpoint, re-render-all |
| `apps/server/src/export/format.ts`, `migrate-format.ts`, `exporter.ts`, `importer.ts` | Modify: FORMAT_VERSION 2, settings + themeId in bundle, real transform pair, downgrade route support |
| `docs/engineering/decisions/ADR-0024-render-unification-theme.md` + README row | Create |
| `docs/engineering/design/discussions/mvp4-scope-2026-06-12.md` | Create: scope + build log |

Boundary locked by spec §2: theme governs **content surfaces** (editor canvas, /read, /notes static HTML). App chrome (Sidebar/Shell/Login) stays on default tokens via the shim — recorded as theme-system future work.

---

### Task 1: Branch, packages scaffolding, deps

- [ ] **Step 1: Branch + scope record**

```powershell
git checkout -b feat/mvp4
```

Create `docs/engineering/design/discussions/mvp4-scope-2026-06-12.md`:

```markdown
# MVP-4 scope — 插件就绪：渲染统一 + 主题层 + 契约收紧

| Field | Value |
|---|---|
| Status | in progress |
| Spec | [2026-06-12-mvp4-render-theme-design.md](../../../superpowers/specs/2026-06-12-mvp4-render-theme-design.md)（owner ratified，含钉选形态替换）|
| Branch | feat/mvp4 |

## 决策摘录（详见 spec）

- M4-D1 渲染统一：RenderView + tokens → 共享包；server publish 走 renderToStaticMarkup；publishedHtml = f(publishedDoc, slug, 有效主题) 纯函数
- M4-D2 Theme seam：实例级 settings + 逐页钉选（theme_id 可空 = 跟随实例）；换主题全量重渲染（不可跳过——跳过会产生不可再现状态）
- M4-D3 第三 kind = code（压测：per-block 设置项 / 重渲染依赖 / 三处渲染一致）；不含执行
- M4-D4 契约收紧：CONTRACT.md + 全 kind 仅经 registry；HostServices context = 插件 host API 的雏形
- M4-D5 格式 v2：settings + themeId 进导出物；第一对真实 up/down transform；?format=1 导出端降级实战
- M4-D6 边界：theme 只管内容面（画布/读页/静态页）；chrome 留默认 token（theme-system future）

## Build log

（按时间追加）
```

- [ ] **Step 2: Scaffold packages** — first read `packages/grid-engine/package.json` and `packages/grid-engine/tsconfig.json` to mirror conventions, then create:

`packages/theme/package.json`:

```json
{
  "name": "@skb/theme",
  "version": "0.1.0-dev",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {},
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "typescript": "~5.6.0",
    "vitest": "^2.1.9"
  }
}
```

`packages/theme/tsconfig.json` (mirror grid-engine's compilerOptions, add):

```json
{
  "extends": "../grid-engine/tsconfig.json",
  "compilerOptions": { "jsx": "react-jsx" },
  "include": ["src", "test"]
}
```

`packages/block-kinds/package.json`:

```json
{
  "name": "@skb/block-kinds",
  "version": "0.1.0-dev",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@skb/grid-engine": "workspace:*",
    "@skb/theme": "workspace:*",
    "highlight.js": "^11.10.0",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.1"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "~5.6.0",
    "vitest": "^2.1.9"
  }
}
```

`packages/block-kinds/tsconfig.json`: same shape as theme's.

Check `apps/web/package.json` for the exact react-markdown/remark-gfm versions already in use and reuse them verbatim (avoid duplicate lockfile entries).

- [ ] **Step 3: Wire app deps** — `apps/server/package.json` dependencies add:

```json
"@skb/block-kinds": "workspace:*",
"@skb/theme": "workspace:*",
"react": "^18.3.1",
"react-dom": "^18.3.1",
```

and REMOVE `rehype-stringify`, `remark-parse`, `remark-rehype`, `unified`, `remark-gfm` (replaced by the shared component pipeline). `apps/web/package.json`: add the two workspace packages; remove `react-markdown`, `remark-gfm` (moved into block-kinds).

- [ ] **Step 4: Install + commit**

```powershell
$env:Path += ";$HOME\.bun\bin"; bun install
git add -A; git commit -m "chore(mvp4): branch scaffold — theme + block-kinds packages, dep rewire"
```

---

### Task 2: packages/theme

- [ ] **Step 1: Write failing tests** — `packages/theme/test/theme.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_THEME_ID,
  THEMES,
  blockCardStyle,
  canvasBaseplateStyle,
  graphPaper,
  ink,
  kindHue,
} from '../src/index';

describe('theme registry', () => {
  test('default theme is graph-paper and registered', () => {
    expect(DEFAULT_THEME_ID).toBe('graph-paper');
    expect(THEMES['graph-paper']).toBe(graphPaper);
    expect(THEMES['ink']).toBe(ink);
  });

  test('every theme carries the full token surface', () => {
    for (const t of Object.values(THEMES)) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(t.slot).toBeGreaterThan(0);
      expect(t.pad).toBeGreaterThanOrEqual(0);
      for (const key of [
        'canvasBg', 'dotColor', 'blockBg', 'blockBorder', 'blockRadius',
        'textColor', 'mutedColor', 'chromeBg', 'accent', 'danger',
        'kindHueFallback', 'codeCss',
      ] as const) {
        expect(t[key], `${t.id}.${key}`).toBeTruthy();
      }
      expect(t.kindHues.markdown).toBeTruthy();
      expect(t.kindHues.image).toBeTruthy();
      expect(t.kindHues.code).toBeTruthy();
    }
  });

  test('themes actually diverge', () => {
    expect(graphPaper.canvasBg).not.toBe(ink.canvasBg);
  });

  test('helpers are theme-parametrized', () => {
    expect(kindHue(graphPaper, 'markdown')).toBe(graphPaper.kindHues.markdown);
    expect(kindHue(graphPaper, 'unknown-kind')).toBe(graphPaper.kindHueFallback);
    expect(blockCardStyle(graphPaper, 'markdown').borderTop).toContain(graphPaper.kindHues.markdown);
    expect(canvasBaseplateStyle(ink).backgroundImage).toContain(ink.dotColor);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd packages/theme; bun run test` → FAIL (module missing).

- [ ] **Step 3: Implement** — `packages/theme/src/index.ts`:

```ts
/**
 * Theme = a swappable token set (MVP-4 theme seam; theme-system L0-L3
 * cascade builds on this later). All content-surface visuals flow
 * through a Theme value — components never hardcode visuals.
 * publishedHtml purity depends on Theme being plain data.
 */
import type React from 'react';

export type Theme = {
  id: string;
  name: string;
  slot: number;
  pad: number;
  canvasBg: string;
  dotColor: string;
  dotSize: number;
  blockBg: string;
  blockBorder: string;
  blockRadius: string;
  textColor: string;
  mutedColor: string;
  chromeBg: string;
  accent: string;
  danger: string;
  kindHues: Record<string, string>;
  kindHueFallback: string;
  /** CSS rules for highlight.js token classes (code kind). */
  codeCss: string;
};

const GITHUB_ISH_CODE_CSS = `
.hljs-keyword, .hljs-selector-tag { color: oklch(45% 0.18 300); }
.hljs-string, .hljs-attr { color: oklch(45% 0.12 250); }
.hljs-number, .hljs-literal { color: oklch(50% 0.15 220); }
.hljs-comment { color: oklch(55% 0.02 80); font-style: italic; }
.hljs-title, .hljs-name { color: oklch(45% 0.14 150); }
.hljs-built_in, .hljs-type { color: oklch(50% 0.12 60); }
`;

export const graphPaper: Theme = {
  id: 'graph-paper',
  name: 'Graph paper',
  slot: 60,
  pad: 4,
  canvasBg: 'oklch(98% 0.005 80)',
  dotColor: 'oklch(70% 0.01 80)',
  dotSize: 2,
  blockBg: 'white',
  blockBorder: '1px solid oklch(85% 0.01 80)',
  blockRadius: '3px',
  textColor: 'oklch(35% 0.02 80)',
  mutedColor: 'oklch(50% 0.02 80)',
  chromeBg: 'oklch(20% 0.02 80)',
  accent: 'oklch(60% 0.12 240)',
  danger: 'oklch(55% 0.18 25)',
  kindHues: {
    markdown: 'oklch(60% 0.04 280)',
    image: 'oklch(65% 0.12 240)',
    code: 'oklch(55% 0.10 150)',
  },
  kindHueFallback: 'oklch(60% 0.05 0)',
  codeCss: GITHUB_ISH_CODE_CSS,
};

/** Minimal second theme — proof the seam switches; real candidates
 * arrive from the MVP-4 style round (spec §7). */
export const ink: Theme = {
  ...graphPaper,
  id: 'ink',
  name: 'Ink',
  canvasBg: 'white',
  dotColor: 'transparent',
  blockBg: 'oklch(99% 0 0)',
  blockBorder: '1px solid oklch(25% 0.01 270)',
  blockRadius: '0px',
  textColor: 'oklch(20% 0.01 270)',
  mutedColor: 'oklch(45% 0.01 270)',
  accent: 'oklch(40% 0.15 270)',
  kindHues: {
    markdown: 'oklch(25% 0.01 270)',
    image: 'oklch(25% 0.01 270)',
    code: 'oklch(25% 0.01 270)',
  },
  kindHueFallback: 'oklch(25% 0.01 270)',
};

export const THEMES: Record<string, Theme> = { 'graph-paper': graphPaper, ink };
export const DEFAULT_THEME_ID = 'graph-paper';

export function kindHue(theme: Theme, kind: string): string {
  return theme.kindHues[kind] ?? theme.kindHueFallback;
}

/** Block card chrome shared by edit and read modes (theme-system
 * "consistent across modes" invariant). */
export function blockCardStyle(theme: Theme, kind: string): React.CSSProperties {
  return {
    background: theme.blockBg,
    border: theme.blockBorder,
    borderTop: `2px solid ${kindHue(theme, kind)}`,
    borderRadius: theme.blockRadius,
    padding: '8px 10px',
    overflow: 'hidden',
  };
}

export function canvasBaseplateStyle(theme: Theme): React.CSSProperties {
  return {
    backgroundImage: `radial-gradient(circle, ${theme.dotColor} ${theme.dotSize / 2}px, transparent ${theme.dotSize / 2}px)`,
    backgroundSize: `${theme.slot}px ${theme.slot}px`,
    backgroundPosition: `${theme.slot - theme.dotSize / 2}px ${theme.slot - theme.dotSize / 2}px`,
  };
}

export { ThemeContext, ThemeProvider, useTheme } from './context';
```

`packages/theme/src/context.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { graphPaper, type Theme } from './index';

/** Content surfaces read the active theme from here; default keeps
 * un-providered trees (and app chrome) on graph-paper. */
export const ThemeContext = createContext<Theme>(graphPaper);

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
```

- [ ] **Step 4: Run tests** → PASS. **Step 5: Commit** — `git add -A; git commit -m "feat(theme): theme package — token contract, graph-paper + ink, parametrized helpers"`

---

### Task 3: packages/block-kinds — move modules, HostServices, registry; rewire web

- [ ] **Step 1: Create contract types** — `packages/block-kinds/src/types.ts` (BlockKindModule moves verbatim from `apps/web/src/blocks/types.ts`, plus host context):

```tsx
/**
 * BlockKindModule — the block product contract (CONTRACT.md). In-tree
 * kinds are plugins that happen to live in this repo: they consume the
 * exact surface a plugin would (registry + HostServices + ThemeContext).
 */
import { createContext, useContext } from 'react';
import type { ComponentType } from 'react';
import type { BlockSize } from '@skb/grid-engine';

export type BlockViewProps<C = unknown> = {
  content: C;
  onChange: (next: C) => void;
};

export type BlockKindModule<C = unknown> = {
  kind: string;
  label: string;
  glyph: string;
  defaultSize: BlockSize;
  createContent: () => C;
  EditView: ComponentType<BlockViewProps<C>>;
  RenderView: ComponentType<{ content: C }>;
  extractText: (content: C) => string;
};

/** Host capabilities injected by the embedding app — the seed of the
 * plugin host API. EditViews must reach the host ONLY through this. */
export type HostServices = {
  uploadBlob: (file: File) => Promise<{ hash: string; size: number; mimeType: string }>;
};

export const HostContext = createContext<HostServices | null>(null);

export function useHost(): HostServices {
  const host = useContext(HostContext);
  if (!host) throw new Error('HostContext not provided — wrap editing surfaces in <HostContext.Provider>');
  return host;
}
```

- [ ] **Step 2: Move kind modules** — `git mv` the directories, then adjust:
  - `apps/web/src/blocks/markdown/` → `packages/block-kinds/src/markdown/`; `apps/web/src/blocks/image/` → `packages/block-kinds/src/image/`; tests move to `packages/block-kinds/test/` (vitest here, imports adjust from `../src/...`).
  - In every moved `.tsx`: replace `import { theme } from '../../theme/tokens'` with `import { useTheme } from '@skb/theme'` and add `const theme = useTheme();` as the first line of the component body (pure mechanical; `blockCardStyle` not used inside views).
  - `ImageEditView.tsx`: replace `import { uploadBlob } from '../../api/client'` with `import { useHost } from '../types'`; inside the component add `const { uploadBlob } = useHost();`.
  - `image.ts` keeps `blobUrl` (relative URL — valid in SPA and same-origin static pages alike).
  - `apps/web/src/blocks/registry.ts` → `packages/block-kinds/src/registry.ts` (code kind joins in Task 6).
  - Create `packages/block-kinds/src/index.ts`:

```ts
export * from './types';
export * from './registry';
export { PublishedCanvas } from './PublishedCanvas';
```

(`static.ts` is deliberately NOT exported from the index — the web bundle must never pull react-dom/server; server imports `@skb/block-kinds/src/static` directly.)

- [ ] **Step 3: Web shim + rewires**
  - Rewrite `apps/web/src/theme/tokens.ts`:

```ts
/** Legacy shim: app chrome keeps these static-default imports; content
 * surfaces use @skb/theme's ThemeContext instead (MVP-4 boundary —
 * chrome theming is theme-system future work). */
import { blockCardStyle as cardStyle, canvasBaseplateStyle as baseStyle, graphPaper, kindHue as hue } from '@skb/theme';

export const theme = { ...graphPaper, kindHue: (kind: string) => hue(graphPaper, kind) };
export const blockCardStyle = (kind: string) => cardStyle(graphPaper, kind);
export const canvasBaseplateStyle = () => baseStyle(graphPaper);
export type Theme = typeof theme;
```

  - All web imports of `../blocks/registry` / `../blocks/types` → `@skb/block-kinds` (grep `from '../blocks` and `from './blocks`; files: GridCanvas.tsx, Palette.tsx, EditorPage.tsx, ReadPage.tsx, overlays.tsx as found).
  - In the component that mounts EditViews (GridCanvas or EditorPage — locate `EditView` usage), wrap the editing surface with the host provider:

```tsx
import { HostContext } from '@skb/block-kinds';
import { uploadBlob } from '../api/client';
// around the canvas / active block tree:
<HostContext.Provider value={{ uploadBlob }}>…existing tree…</HostContext.Provider>
```

  - Delete `apps/web/src/blocks/` once nothing imports it.

- [ ] **Step 4: Verify both suites + typecheck**

```powershell
cd packages\block-kinds; bun run test       # moved kind tests pass here now
cd ..\..\apps\web; bun run test; bun run typecheck
```

Expected: all green. The moved tests (markdown.test.ts, image.test.ts) run under block-kinds vitest unchanged (they test `extractText`/content logic, no DOM).

- [ ] **Step 5: Commit** — `git add -A; git commit -m "refactor(blocks): lift kind modules + registry into @skb/block-kinds with HostServices seam"`

---

### Task 4: PublishedCanvas + static renderer; server renderer dies

- [ ] **Step 1: Write failing test** — `packages/block-kinds/test/static.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { graphPaper, ink } from '@skb/theme';
import { renderStaticPage, NOT_FOUND_HTML } from '../src/static';

const DOC = {
  title: 'Hello <World>',
  gravityEnabled: true,
  publishedAt: 1000,
  blocks: [
    { id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: { markdown: '# Hi **there**' } },
    { id: 'b2', kind: 'image', col: 0, row: 1, colSpan: 4, rowSpan: 2, content: { blobHash: 'a'.repeat(64), alt: 'pic' } },
    { id: 'b3', kind: 'mystery', col: 4, row: 1, colSpan: 4, rowSpan: 1, content: {} },
  ],
};

describe('renderStaticPage', () => {
  test('full document with escaped title, markdown html, image src, unknown-kind fallback', () => {
    const html = renderStaticPage(DOC, 'hello-world', graphPaper);
    expect(html).toStartWith('<!doctype html>');
    expect(html).toContain('Hello &lt;World&gt;');
    expect(html).toContain('<strong>there</strong>');
    expect(html).toContain(`/api/public/blobs/${'a'.repeat(64)}`);
    expect(html).toContain('Unsupported content');
    expect(html).toContain('/notes/hello-world');
  });

  test('theme tokens are baked in — different theme, different bytes', () => {
    const a = renderStaticPage(DOC, 's', graphPaper);
    const b = renderStaticPage(DOC, 's', ink);
    expect(a).not.toBe(b);
    expect(a).toContain(graphPaper.canvasBg);
    expect(b).toContain(ink.canvasBg);
  });

  test('deterministic: same inputs, same bytes', () => {
    expect(renderStaticPage(DOC, 's', graphPaper)).toBe(renderStaticPage(DOC, 's', graphPaper));
  });

  test('404 page exists', () => {
    expect(NOT_FOUND_HTML).toContain('does not exist');
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `packages/block-kinds/src/PublishedCanvas.tsx` (markup lifted from ReadPage):

```tsx
/**
 * Published-page layout, shared verbatim by the SPA read route and the
 * publish-time static renderer — render drift is structurally
 * impossible (MVP-4 M4-D1; repays the mvp2 dual-renderer debt).
 */
import { blockCardStyle, canvasBaseplateStyle, useTheme } from '@skb/theme';
import { blockModule } from './registry';

export type PublishedDocShape = {
  title: string;
  blocks: Array<{
    id: string; kind: string; col: number; row: number;
    colSpan: number; rowSpan: number; content: unknown;
  }>;
};

const COLS = 12;

export function PublishedCanvas({ doc }: { doc: PublishedDocShape }) {
  const theme = useTheme();
  const rows = Math.max(1, ...doc.blocks.map((b) => b.row + b.rowSpan));
  const SLOT = theme.slot;
  const PAD = theme.pad;

  return (
    <div style={{ background: theme.canvasBg, minHeight: '100vh' }}>
      <div style={{ maxWidth: `${COLS * SLOT}px`, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ color: theme.textColor, fontSize: '26px', margin: '0 0 24px' }}>{doc.title}</h1>
        <div
          style={{
            position: 'relative',
            width: `${COLS * SLOT}px`,
            height: `${rows * SLOT}px`,
            ...canvasBaseplateStyle(theme),
          }}
        >
          {doc.blocks.map((b) => {
            const mod = blockModule(b.kind);
            return (
              <div
                key={b.id}
                style={{
                  ...blockCardStyle(theme, b.kind),
                  position: 'absolute',
                  left: `${b.col * SLOT + PAD}px`,
                  top: `${b.row * SLOT + PAD}px`,
                  width: `${b.colSpan * SLOT - 2 * PAD}px`,
                  height: `${b.rowSpan * SLOT - 2 * PAD}px`,
                  overflow: 'auto',
                  fontSize: '14px',
                  lineHeight: 1.55,
                }}
              >
                {mod ? (
                  <mod.RenderView content={(b.content ?? mod.createContent()) as never} />
                ) : (
                  <div style={{ color: theme.mutedColor, fontStyle: 'italic', fontSize: '13px' }}>
                    Unsupported content
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

`packages/block-kinds/src/static.ts`:

```tsx
/**
 * Publish-time static rendering (server-only entry — NOT exported from
 * the package index; the web bundle must never import react-dom/server).
 * publishedHtml = renderStaticPage(publishedDoc, slug, effectiveTheme):
 * a pure function — the theme invariant [ADR-0024].
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, type Theme } from '@skb/theme';
import { PublishedCanvas, type PublishedDocShape } from './PublishedCanvas';

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderStaticPage(doc: PublishedDocShape, slug: string, theme: Theme): string {
  const body = renderToStaticMarkup(
    createElement(ThemeProvider, { theme }, createElement(PublishedCanvas, { doc })),
  );
  const title = escapeHtml(doc.title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="canonical" href="/notes/${escapeHtml(slug)}">
<meta property="og:title" content="${title}">
<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: ${theme.canvasBg}; color: ${theme.textColor}; }
${theme.codeCss}
</style>
</head>
<body>${body}</body>
</html>`;
}

export const NOT_FOUND_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Not found</title></head>
<body style="font-family:system-ui,sans-serif;color:oklch(50% 0.02 80);text-align:center;margin-top:80px">
This page does not exist.
</body></html>`;
```

Note: the markdown `<style>` block currently inside MarkdownRenderView ships with the markup in both SPA and static output automatically — that's the point of sharing components.

- [ ] **Step 3: Server renderer becomes a shim** — rewrite `apps/server/src/render/publish-html.ts`:

```ts
/**
 * MVP-4: the hand-written renderer is gone. Static HTML comes from the
 * same React components the SPA renders (@skb/block-kinds static entry)
 * — the mvp2 dual-renderer drift debt is repaid by construction.
 */
export { NOT_FOUND_HTML, escapeHtml, renderStaticPage } from '@skb/block-kinds/src/static';
```

Update `apps/server/src/routes/notepages.ts` publish call site: `renderPublishedHtml(doc, slug)` → `renderStaticPage(doc, slug, /* theme: Task 5 wires the real effective theme */ THEMES[DEFAULT_THEME_ID]!)` with imports from `@skb/theme` (temporary default; Task 5 replaces it). Same for the importer's re-render call in `apps/server/src/export/importer.ts`.

- [ ] **Step 4: Update server static-html tests** — `apps/server/test/static-html.test.ts` assertions that match old CSS class names (`.grid`, `.block`, `.md`) must be updated to structural checks (title present, markdown `<strong>` rendered, blob URL present, identical 404 body). Keep the no-leak assertions intact. Run:

```powershell
bun test apps/server/test; cd packages\block-kinds; bun run test
```

Expected: all green.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat(render): shared PublishedCanvas + renderStaticPage; server hand-written renderer retired"`

---

### Task 5: settings table, effective theme, re-render endpoints

- [ ] **Step 1: Schema + migration** — `apps/server/src/db/schema.ts` add:

```ts
/** Instance-level key-value settings (first instance setting: theme).
 * MVP-4 M4-D2; values are plain strings, callers own parsing. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

and on `notepages` add (after `gravityEnabled`):

```ts
  themeId: text('theme_id'),
```

Generate migration 0006 with drizzle-kit (`cd apps/server; bun run drizzle-kit generate --name settings_theme` — check package.json for the existing generate script form first), confirm the SQL contains `CREATE TABLE settings` + `ALTER TABLE notepages ADD theme_id`. Schema version becomes 6 (migrate.ts derives it from journal count — verify `bun test apps/server/test/migrate.test.ts` expectations and update the expected version number).

- [ ] **Step 2: Write failing tests** — append to a new `apps/server/test/theme.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createTestContext, json } from './helpers';

describe('theme settings', () => {
  test('default instance theme; admin can change; full re-render happens', async () => {
    const ctx = await createTestContext();
    expect((await json(await ctx.authed('/api/settings'))).theme).toBe('graph-paper');

    // publish a page under graph-paper
    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'T' }) }));
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
    const before = await (await ctx.app.request('http://localhost/notes/t')).text();
    expect(before).toContain('oklch(98% 0.005 80)'); // graph-paper canvasBg

    const res = await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) });
    expect((await json(res)).rerendered).toBe(1);
    const after = await (await ctx.app.request('http://localhost/notes/t')).text();
    expect(after).not.toBe(before);
    expect(after).toContain('white'); // ink canvasBg

    // unknown theme rejected
    expect((await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'nope' }) })).status).toBe(400);
  });

  test('per-page pin overrides instance theme and survives instance switch', async () => {
    const ctx = await createTestContext();
    const p = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Pinned' }) }));
    await ctx.authed(`/api/notepages/${p.id}/publish`, { method: 'POST' });
    await ctx.authed(`/api/notepages/${p.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });

    const pin = await ctx.authed(`/api/notepages/${p.id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'ink' }) });
    expect(pin.status).toBe(200);
    const pinned = await (await ctx.app.request('http://localhost/notes/pinned')).text();
    expect(pinned).toContain('white'); // ink, while instance is graph-paper

    await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'graph-paper' }) });
    const still = await (await ctx.app.request('http://localhost/notes/pinned')).text();
    expect(still).toContain('white'); // pin holds

    // unpin → follows instance again
    await ctx.authed(`/api/notepages/${p.id}/theme`, { method: 'POST', body: JSON.stringify({ themeId: null }) });
    const unpinned = await (await ctx.app.request('http://localhost/notes/pinned')).text();
    expect(unpinned).toContain('oklch(98% 0.005 80)');
  });

  test('non-admin cannot change instance theme; public instance endpoint exposes it', async () => {
    const ctx = await createTestContext();
    const anon = await ctx.app.request('http://localhost/api/public/instance');
    expect((await json(anon)).theme).toBe('graph-paper');
  });
});
```

- [ ] **Step 3: Implement** — `apps/server/src/settings.ts`:

```ts
/** Instance settings + effective-theme resolution [ADR-0024]. */
import { eq } from 'drizzle-orm';
import { DEFAULT_THEME_ID, THEMES, type Theme } from '@skb/theme';
import type { Db } from './db/client';
import { settings, type NotepageRow } from './db/schema';

export function getSetting(db: Db, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function instanceThemeId(db: Db): string {
  const v = getSetting(db, 'theme');
  return v !== null && v in THEMES ? v : DEFAULT_THEME_ID;
}

/** page pin wins; else instance; unknown ids degrade to default. */
export function effectiveTheme(db: Db, page: Pick<NotepageRow, 'themeId'>): Theme {
  const id = page.themeId !== null && page.themeId in THEMES ? page.themeId : instanceThemeId(db);
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID]!;
}
```

Routes (in `apps/server/src/routes/notepages.ts` or a small new block in admin.ts where role-gated):
  - `GET /api/settings` (auth): `{ theme: instanceThemeId(db) }`
  - `PUT /api/settings/theme` (admin — place under `adminRoutes`' gate as `/admin`-prefixed? No: spec calls it admin-only; mount as `r.put('/settings/theme')` inside adminRoutes with explicit path `/settings/theme` OUTSIDE the `/admin/*` middleware — simplest correct form: keep it in admin.ts and extend the gate: `r.use('/admin/*', requireAdmin); r.use('/settings/theme', requireAdmin);`). Body `{theme}` validated against THEMES → 400 unknown; `setSetting`; then re-render every published page with its effective theme; return `{ ok: true, rerendered }`.
  - `POST /api/notepages/:id/theme` (auth): `{themeId: string|null}`; non-null validated against THEMES → 400; update row; if published re-render its HTML with new effective theme.
  - `GET /api/public/instance` (anonymous via `/api/public/` prefix): `{ theme: instanceThemeId(db) }`.
  - Publish route + importer re-render: replace Task 4's temporary default with `effectiveTheme(db, page)`.
  - Re-render-all helper (place in settings.ts or notepages.ts, used by settings PUT and import):

```ts
export function rerenderAllPublished(db: Db): number {
  let n = 0;
  for (const page of db.select().from(notepages).all()) {
    if (page.publishedDoc === null) continue;
    const doc = JSON.parse(page.publishedDoc) as PublishedDoc;
    db.update(notepages)
      .set({ publishedHtml: renderStaticPage(doc, page.slug, effectiveTheme(db, page)) })
      .where(eq(notepages.id, page.id))
      .run();
    n++;
  }
  return n;
}
```

  - `GET /api/notepages/:id` response gains `themeId: page.themeId` (pin state for the editor UI); `GET /api/public/notes/:slug` gains `theme: effectiveTheme(db, page).id`.

- [ ] **Step 4: Run** `bun test apps/server/test` → all green (old tests + new theme tests). **Step 5: Commit** — `git add -A; git commit -m "feat(theme): settings table, per-page pin, effective theme, re-render endpoints (schema v6)"`

---

### Task 6: code block kind

- [ ] **Step 1: Write failing tests** — `packages/block-kinds/test/code.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { codeModule } from '../src/code';
import { BLOCK_KINDS } from '../src/registry';
import { renderStaticPage } from '../src/static';
import { graphPaper } from '@skb/theme';

describe('code kind', () => {
  test('registered with sane defaults', () => {
    expect(BLOCK_KINDS.code).toBeDefined();
    const c = codeModule.createContent();
    expect(c).toEqual({ language: 'plaintext', source: '' });
  });

  test('extractText returns the source verbatim', () => {
    expect(codeModule.extractText({ language: 'ts', source: 'const a = 1;' })).toBe('const a = 1;');
  });

  test('static render highlights known language, survives unknown language', () => {
    const doc = {
      title: 'c', gravityEnabled: true, publishedAt: 1,
      blocks: [
        { id: 'a', kind: 'code', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { language: 'typescript', source: 'const x: number = 1;' } },
        { id: 'b', kind: 'code', col: 6, row: 0, colSpan: 6, rowSpan: 2, content: { language: 'no-such-lang', source: '<unsafe> & sound' } },
      ],
    };
    const html = renderStaticPage(doc, 's', graphPaper);
    expect(html).toContain('hljs-keyword'); // typescript highlighted
    expect(html).toContain('&lt;unsafe&gt; &amp; sound'); // fallback escaped, never raw
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `packages/block-kinds/src/code/code.ts`:

```ts
/** code kind content — kind-owned, opaque to the platform [CONTRACT.md].
 * No runner fields: executable code is a future family; the export
 * format-migration pipeline exists precisely for adding fields later. */
export type CodeContent = { language: string; source: string };

export const CODE_LANGUAGES = [
  'plaintext', 'typescript', 'javascript', 'python', 'rust', 'go',
  'json', 'bash', 'html', 'css', 'sql', 'c', 'cpp', 'java', 'markdown',
] as const;
```

`packages/block-kinds/src/code/CodeRenderView.tsx`:

```tsx
import hljs from 'highlight.js/lib/core';
import plaintext from 'highlight.js/lib/languages/plaintext';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import java from 'highlight.js/lib/languages/java';
import markdown from 'highlight.js/lib/languages/markdown';
import { useTheme } from '@skb/theme';
import type { CodeContent } from './code';

const LANGS: Record<string, unknown> = {
  plaintext, typescript, javascript, python, rust, go, json, bash,
  html: xml, css, sql, c, cpp, java, markdown,
};
for (const [name, lang] of Object.entries(LANGS)) {
  hljs.registerLanguage(name, lang as Parameters<typeof hljs.registerLanguage>[1]);
}

export function CodeRenderView({ content }: { content: CodeContent }) {
  const theme = useTheme();
  const lang = content.language in LANGS ? content.language : 'plaintext';
  const { value } = hljs.highlight(content.source, { language: lang });
  return (
    <pre
      style={{
        margin: 0, height: '100%', overflow: 'auto',
        fontSize: '12.5px', lineHeight: 1.5,
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        color: theme.textColor,
      }}
    >
      <style>{theme.codeCss}</style>
      <code dangerouslySetInnerHTML={{ __html: value }} />
    </pre>
  );
}
```

(hljs.highlight escapes non-token text itself — the unknown-language fallback path emits escaped plaintext, asserted by the test.)

`packages/block-kinds/src/code/CodeEditView.tsx`:

```tsx
import { useTheme } from '@skb/theme';
import type { BlockViewProps } from '../types';
import { CODE_LANGUAGES, type CodeContent } from './code';

export function CodeEditView({ content, onChange }: BlockViewProps<CodeContent>) {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', minHeight: 0 }}>
      <select
        value={content.language}
        onChange={(e) => onChange({ ...content, language: e.target.value })}
        aria-label="Language"
        style={{ alignSelf: 'flex-start', fontSize: '12px', border: theme.blockBorder, borderRadius: '4px', padding: '2px 6px' }}
      >
        {CODE_LANGUAGES.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
      <textarea
        value={content.source}
        onChange={(e) => onChange({ ...content, source: e.target.value })}
        spellCheck={false}
        aria-label="Source code"
        style={{
          flex: 1, minHeight: 0, resize: 'none', border: theme.blockBorder, borderRadius: '4px',
          padding: '6px 8px', fontSize: '12.5px', lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', color: theme.textColor,
        }}
      />
    </div>
  );
}
```

`packages/block-kinds/src/code/index.ts`:

```ts
import type { BlockKindModule } from '../types';
import { CodeEditView } from './CodeEditView';
import { CodeRenderView } from './CodeRenderView';
import type { CodeContent } from './code';

export const codeModule: BlockKindModule<CodeContent> = {
  kind: 'code',
  label: 'Code',
  glyph: '{}',
  defaultSize: { colSpan: 6, rowSpan: 3 },
  createContent: () => ({ language: 'plaintext', source: '' }),
  EditView: CodeEditView,
  RenderView: CodeRenderView,
  extractText: (c) => c.source,
};
export { codeModule as default };
export type { CodeContent };
```

Register in `registry.ts` (`code: codeModule as unknown as BlockKindModule<never>`). The palette (apps/web Palette.tsx) iterates BLOCK_KINDS — verify code appears without changes; if the palette hardcodes kinds, fix it to iterate.

- [ ] **Step 3: Run** block-kinds + web + server suites → green. **Step 4: Commit** — `git add -A; git commit -m "feat(blocks): code kind — language select + highlight.js render, third contract sample"`

---

### Task 7: web theme wiring (provider, instance select, page pin)

- [ ] **Step 1: API client** — add to `apps/web/src/api/client.ts`:

```ts
  getSettings: () => request<{ theme: string }>('/api/settings'),
  setInstanceTheme: (theme: string) =>
    request<{ ok: true; rerendered: number }>('/api/settings/theme', {
      method: 'PUT',
      body: JSON.stringify({ theme }),
    }),
  setPageTheme: (id: string, themeId: string | null) =>
    request<{ ok: true }>(`/api/notepages/${id}/theme`, {
      method: 'POST',
      body: JSON.stringify({ themeId }),
    }),
  getPublicInstance: () => request<{ theme: string }>('/api/public/instance'),
```

`NotepageDetail.page` type gains `themeId: string | null`; public note response type gains `theme: string`.

- [ ] **Step 2: Provider wiring**
  - `Shell.tsx`: fetch instance theme (authed → `api.getSettings()`, anonymous → `api.getPublicInstance()`), keep in ShellContext as `instanceTheme: string`, refresh alongside tree.
  - `EditorPage.tsx`: effective theme = `THEMES[page.themeId ?? instanceTheme] ?? graphPaper`; wrap the canvas region in `<ThemeProvider theme={effective}>` (chrome outside stays default). Add a pin select near the existing visibility/publish controls:

```tsx
<select
  value={page.themeId ?? ''}
  onChange={(e) => void api.setPageTheme(page.id, e.target.value === '' ? null : e.target.value).then(reloadPage)}
  title="Page theme (empty = follow instance)"
>
  <option value="">Theme: instance</option>
  {Object.values(THEMES).map((t) => (
    <option key={t.id} value={t.id}>Theme: {t.name} (pinned)</option>
  ))}
</select>
```

  - `ReadPage.tsx`: replace its hand-rolled layout with `<ThemeProvider theme={THEMES[resp.theme] ?? graphPaper}><PublishedCanvas doc={doc}/></ThemeProvider>` (the not-found/loading states keep current markup).
  - `Sidebar.tsx` admin area: instance theme select under the Export/Import row:

```tsx
{me.role === 'admin' && (
  <select
    value={instanceTheme}
    onChange={(e) => {
      if (!window.confirm('Switch instance theme? All published pages re-render.')) return;
      void api.setInstanceTheme(e.target.value).then(() => refresh());
    }}
    style={{ fontSize: '12px', border: `1px dashed ${theme.mutedColor}`, borderRadius: '6px', padding: '4px' }}
  >
    {Object.values(THEMES).map((t) => (
      <option key={t.id} value={t.id}>Theme: {t.name}</option>
    ))}
  </select>
)}
```

- [ ] **Step 3: Verify** — `cd apps/web; bun run typecheck; bun run test` green; manual smoke on dev servers: switch instance theme to ink → editor canvas + /read + /notes all flip; pin a page back to graph-paper → only it stays. **Step 4: Commit** — `git add -A; git commit -m "feat(web): theme provider wiring, instance theme select, per-page pin UI"`

---

### Task 8: export format v2 — first real transform pair

- [ ] **Step 1: Write failing tests** — append to `apps/server/test/export-import.test.ts`:

```ts
describe('format v2 (theme data)', () => {
  test('v2 export carries settings + per-page themeId; round trip preserves them', async () => {
    const src = await freshContext();
    const seeded = await seedInstance(src, src.blobStore);
    await src.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) });
    await src.authed(`/api/notepages/${seeded.p2}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'graph-paper' }) });

    const bundle = buildExport(src.db, src.blobStore, OPTS);
    const manifest = JSON.parse(bundle.files.get('manifest.json')!);
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.settings).toEqual({ theme: 'ink' });
    const p2 = JSON.parse(bundle.files.get('tree/page-two.page.json')!);
    expect(p2.themeId).toBe('graph-paper');

    const dst = await freshContext();
    expect(importBundle(dst.db, dst.blobStore, bundle).ok).toBe(true);
    expect((await json(await dst.authed('/api/settings'))).theme).toBe('ink');
    const again = buildExport(dst.db, dst.blobStore, OPTS);
    for (const [p, text] of bundle.files) expect(again.files.get(p)).toBe(text);
  });

  test('v1 bundle imports via upgrade transform (defaults applied)', async () => {
    const src = await freshContext();
    await seedInstance(src, src.blobStore);
    const v2 = buildExport(src.db, src.blobStore, OPTS);
    // hand-downgrade to a v1 bundle through the real transform
    const parsed = new Map([...v2.files].map(([p, t]) => [p, JSON.parse(t)]));
    const { files: v1files, losses } = downgradeToVersion(parsed, 1);
    expect(losses).toEqual([]); // default theme + no pins → lossless
    const v1bundle = {
      files: new Map([...v1files].map(([p, v]) => [p, JSON.stringify(v)])),
      blobs: v2.blobs,
    };
    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, v1bundle);
    expect(result.ok).toBe(true);
    expect((await json(await dst.authed('/api/settings'))).theme).toBe('graph-paper');
  });

  test('downgrade is lossy-explicit when theme data is non-default', async () => {
    const src = await freshContext();
    const seeded = await seedInstance(src, src.blobStore);
    await src.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) });
    await src.authed(`/api/notepages/${seeded.p1}/theme`, { method: 'POST', body: JSON.stringify({ themeId: 'graph-paper' }) });
    const v2 = buildExport(src.db, src.blobStore, OPTS);
    const parsed = new Map([...v2.files].map(([p, t]) => [p, JSON.parse(t)]));
    const { losses } = downgradeToVersion(parsed, 1);
    expect(losses.some((l) => l.includes('instance theme "ink"'))).toBe(true);
    expect(losses.some((l) => l.includes('themeId'))).toBe(true);
  });

  test('export route ?format=1 serves a v1 zip; dryRun reports losses', async () => {
    const ctx = await freshContext();
    await seedInstance(ctx, ctx.blobStore);
    await ctx.authed('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) });

    const dry = await json(await ctx.authed('/api/admin/export?format=1&dryRun=1'));
    expect(dry.losses.length).toBeGreaterThan(0);

    const res = await ctx.authed('/api/admin/export?format=1');
    expect(res.status).toBe(200);
    const entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const manifest = JSON.parse(strFromU8(entries['manifest.json']!));
    expect(manifest.formatVersion).toBe(1);
    expect('settings' in manifest).toBe(false);
  });
});
```

Add imports at the top of the file: `downgradeToVersion` from `../src/export/migrate-format`, `strFromU8` from `fflate`.

- [ ] **Step 2: Implement**
  - `format.ts`: `FORMAT_VERSION = 2`; `ExportManifest` gains `settings: { theme: string }` (key order: place after `counts`); `ExportPage` gains `themeId: string | null` (after `gravityEnabled`).
  - `migrate-format.ts` — register the real pair:

```ts
import { DEFAULT_THEME_ID } from '@skb/theme';

export const FORMAT_TRANSFORMS: FormatTransform[] = [
  {
    // v2: instance theme setting + per-page theme pin (MVP-4 [ADR-0024])
    to: 2,
    up(files) {
      const next: JsonFiles = new Map();
      for (const [path, value] of files) {
        if (path === 'manifest.json') {
          const m = value as Record<string, unknown>;
          next.set(path, { ...m, settings: { theme: DEFAULT_THEME_ID } });
        } else if (path.endsWith('.page.json')) {
          const { id, slug, title, visibility, gravityEnabled, ...rest } = value as Record<string, unknown>;
          next.set(path, { id, slug, title, visibility, gravityEnabled, themeId: null, ...rest });
        } else {
          next.set(path, value);
        }
      }
      return next;
    },
    down(files) {
      const next: JsonFiles = new Map();
      const losses: string[] = [];
      for (const [path, value] of files) {
        if (path === 'manifest.json') {
          const { settings, ...m } = value as Record<string, unknown> & { settings?: { theme?: string } };
          if (settings?.theme !== undefined && settings.theme !== DEFAULT_THEME_ID) {
            losses.push(`manifest.json: instance theme "${settings.theme}" dropped (v1 has no settings)`);
          }
          next.set(path, m);
        } else if (path.endsWith('.page.json')) {
          const { themeId, ...rest } = value as Record<string, unknown> & { themeId?: string | null };
          if (themeId != null) losses.push(`${path}: themeId "${themeId}" dropped (v1 has no per-page theme)`);
          next.set(path, rest);
        } else {
          next.set(path, value);
        }
      }
      return { files: next, losses };
    },
  },
];
```

(Note the up() reconstructs page key order explicitly so v1→v2→export stays canonical.)
  - `exporter.ts`: manifest gains `settings: { theme: instanceThemeId(db) }`; page object gains `themeId: p.themeId` after `gravityEnabled`.
  - `importer.ts`: parsePage accepts `themeId` (string|null; validate `typeof`); after upgrade, read `manifest.settings.theme` → `setSetting(db, 'theme', …)` inside the transaction scope (settings write before page re-renders so effective theme is correct); insert `themeId`; re-render with `effectiveTheme(db, page)`.
  - `admin.ts` export route: `?format=` now accepts `1` or `2`: for 1, parse bundle files to JSON, `downgradeToVersion(files, 1)`, re-serialize via `canonicalJson`, zip those; `&dryRun=1` short-circuits to `c.json({ losses })`. Unsupported values keep the 400.
  - Synthetic-transform pipeline tests (export-format.test.ts) pass transforms explicitly — they stay green; any v1 manifest fixtures in tests gain nothing (transform tests are self-contained).
  - Existing tests asserting `formatVersion: 1` / manifest equality (`export-import.test.ts` buildExport test) — update expected version to 2 and counts shape (settings now present).

- [ ] **Step 3: Run** `bun test apps/server/test` → green. **Step 4: Commit** — `git add -A; git commit -m "feat(export): format v2 — theme data in bundle, first real up/down pair, export-side downgrade live"`

---

### Task 9: contract + docs

- [ ] **Step 1: `packages/block-kinds/CONTRACT.md`** — formal surface doc: BlockKindModule fields (semantics per field), HostServices (uploadBlob today; additive-only growth rule), ThemeContext consumption rule (views read useTheme(), never import a concrete theme), RenderView purity requirements (no network, no author affordances, renderToStaticMarkup-safe: effects/state allowed but initial render must be complete), blob reference contract (verbatim lowercase sha256 in content JSON, cite [ADR-0023]), registry as sole entry, kind-opaque content ownership. Cite [ADR-0024] + blocks PRD.

- [ ] **Step 2: ADR-0024** — `docs/engineering/decisions/ADR-0024-render-unification-theme.md` following ADR-0023's structure. Record: shared-component static rendering (renderToStaticMarkup at publish-time only — runtime properties unchanged); publishedHtml = f(publishedDoc, slug, effectiveTheme) purity invariant; theme = data (token set), instance setting + per-page pin, change → full re-render (and why skip-list was rejected: unreproducible state); content-surface vs chrome boundary; format v2 consequence; alternatives rejected (runtime SSR per request; CSS-variable runtime theming for published pages — would make publishedHtml impure; per-kind server renderers — the repaid debt). Add README index row. Update AUDIT MVP-era debts: SSR/SPA drift → repaid by ADR-0024.

- [ ] **Step 3: Runbook** — `self-host-upgrade.md`: note format v2 (v2 instances import v1 bundles automatically; export `?format=1` + `&dryRun=1` to produce bundles for older instances, losses reported), theme switch re-renders all published pages (operator-visible pause on huge instances acceptable; recorded).

- [ ] **Step 4: Build log + commit** — append outcomes to `mvp4-scope-2026-06-12.md`; `git add -A; git commit -m "docs(mvp4): ADR-0024, CONTRACT.md, runbook + audit updates"`

---

### Task 10: full verification

- [ ] **Step 1: All suites + typecheck**

```powershell
bun test apps/server/test
cd packages\grid-engine; bun run test; cd ..\theme; bun run test; cd ..\block-kinds; bun run test
cd ..\..\apps\web; bun run test; bun run typecheck; cd ..\server; bun run typecheck
```

- [ ] **Step 2: Container round trip (v2)** — compose.dev fresh volume: seed (folder + markdown/image/code page + publish + pin one page to ink + instance theme ink) → export → wipe → import → verify static pages keep correct themes, code highlighting present, settings restored.

- [ ] **Step 3: Cross-version downgrade (the real prize)** — build the mvp-3 image (`git worktree add ..\shckb-mvp3 mvp-3` + `docker build` there, or `docker build` with `--build-arg` from a checkout of tag mvp-3), boot it on a fresh volume, then: v2 instance → `GET /api/admin/export?format=1` → import the v1 zip into the mvp-3 container → published pages serve. This proves the downgrade path end-to-end across real versions. Record results + any friction in the build log.

- [ ] **Step 4: Playwright smoke on dev servers** — theme select switches editor canvas live; pinned page holds; code block edit + publish renders highlighted on /notes. Use a dedicated test page; delete afterwards.

- [ ] **Step 5: Final commit; report to owner. Do NOT merge or push** (owner decides). The style round (spec §7) starts only after owner reviews.

---

## Self-review notes

- Spec §1 → Tasks 3-4 (shared package + static render + thin server shim). §2 → Tasks 2, 5, 7 (themes, settings/pin/re-render, UI; skip-list rejection encoded in ADR task). §3 → Task 6. §4 → Task 9 CONTRACT.md + registry-only check. §5 → Task 8 + Task 10 cross-version test. §6 → distributed test steps + Task 10. §7 → explicitly out (post-review). §8 boundaries respected (no cascade/per-user/drawing/runner).
- Type consistency: `Theme`/`THEMES`/`DEFAULT_THEME_ID`/`kindHue(theme, kind)` (Task 2) used in Tasks 4-8; `renderStaticPage(doc, slug, theme)` consistent across Tasks 4, 5, 8; `effectiveTheme(db, page)` Tasks 5, 8; `HostContext/useHost` Tasks 3, 7.
- Known risk points for the executor: hljs type for registerLanguage (cast shown); drizzle-kit generate naming flags (check package.json script first); migrate.test.ts schema-version expectations; static-html.test.ts old CSS assertions; Palette may hardcode kinds. All flagged in their tasks.
