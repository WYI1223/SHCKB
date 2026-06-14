/**
 * Theme = a swappable token set (MVP-4 theme seam; the theme-system
 * L0-L3 cascade builds on this later). All content-surface visuals flow
 * through a Theme value — components never hardcode visuals.
 * publishedHtml purity depends on Theme being plain data [ADR-0024].
 */
import type React from 'react';
import type { ComponentType, ReactNode } from 'react';

/** Author-picked page background (MVP-6 M6-D4): a free color and/or a
 * blob-store image. Surfaces interpret it — deep-slot themes decide
 * how it composes with their own drawing (theme sovereignty). */
export type PageBackground = { color?: string; blobHash?: string };

/** A theme-curated block shell variant (MVP-6 M6-D3): the author picks
 * WITHIN what the theme offers — never free shell styling (same
 * discipline as palette variants). The map key is persisted in
 * block.shell; never rename.
 *
 * Declaration IS implementation (owner feedback 2026-06-12): each
 * entry carries its own Frame, so a declared shell without a renderer
 * is a type error and an unregistered renderer is unreachable — the
 * two-hand-synced-lists bug class cannot exist. */
export type ShellDefinition = {
  name: string;
  /** Kinds this shell applies to; omitted = every kind. */
  kinds?: string[];
  /** The visual shell rendered when the author picks this option. */
  Frame: ComponentType<BlockFrameProps>;
};

export type BlockFrameProps = {
  kind: string;
  blockId: string;
  /** Geometry hints (grid units) — themes may scale effects by size
   * (e.g. wide blocks tilt less). Never used for layout (canvas owns
   * geometry). */
  colSpan: number;
  rowSpan: number;
  /** Author-picked shell option id; null/unknown = the theme's default
   * shell (a theme update may remove an option — pages keep rendering). */
  shell?: string | null;
  /** Autofit blocks clip overflow (the no-scrollbar aesthetic: rowSpan
   * already fits the content); non-autofit blocks scroll. block-level
   * metadata, threaded from PublishedDocShape.blocks / working state —
   * the frame only consumes it, it never measures. */
  autofit?: boolean;
  children: ReactNode;
};
export type CanvasSurfaceProps = {
  widthPx: number;
  heightPx: number;
  background?: PageBackground | null;
  children: ReactNode;
};
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

export type ThemeTokens = {
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
  /** Inset surface inside blocks: markdown pre/inline-code chips. */
  surfaceInsetBg: string;
  /** Thin structural line: md table borders, missing-asset dashes. */
  hairline: string;
  /** Blockquote text color. */
  quoteColor: string;
  /** Body font stack (content surfaces + chrome). Font FILES need the
   * future theme asset pipeline — stacks of installed fonts only. */
  fontFamily: string;
  kindHues: Record<string, string>;
  kindHueFallback: string;
  /** CSS rules for highlight.js token classes (code kind). */
  codeCss: string;
};

/** Token keys a palette variant may retune — colors and font only,
 * never geometry or identity (MVP-5 M5-D3: variants restyle, they
 * don't reflow). */
export type PaletteTokens = Partial<
  Omit<ThemeTokens, 'id' | 'name' | 'slot' | 'pad' | 'dotSize' | 'blockRadius'>
>;

/** A theme-curated color variant — a scientific-colormap-style official
 * alternative, not free-form recoloring. */
export type PaletteVariant = {
  id: string;
  name: string;
  tokens: PaletteTokens;
};

/** String-valued token keys an operator may override directly, when
 * (and only when) the theme opts them into `customizableTokens`. */
export type OverridableTokenKey = Exclude<
  { [K in keyof ThemeTokens]: ThemeTokens[K] extends string ? K : never }[keyof ThemeTokens],
  'id' | 'name'
>;

/** Operator-chosen customization for one theme — data the theme
 * interprets, never a bypass around it. Stored per themeId so switching
 * themes keeps each theme's choices. */
export type ThemeCustomization = {
  paletteId?: string;
  overrides?: Partial<Record<OverridableTokenKey, string>>;
};

/** A theme-curated page paper (M8-D4): a finite color/texture choice
 * the author may pick as the page background — Notion-palette style,
 * limited but plural. `css` flows through PageBackground.color like any
 * author pick, so it must satisfy isSafeCssColor (≤128 chars, no
 * url()/blocks) — short gradients are fine, image textures are not. */
export type PaperOption = {
  id: string;
  name: string;
  css: string;
};

export type Theme = ThemeTokens &
  ThemeSlots & {
    /** Official color variants the theme curates; omitted = none. */
    palettes?: PaletteVariant[];
    /** Tokens open for direct operator override; omitted = all locked. */
    customizableTokens?: OverridableTokenKey[];
    /** Block shell variants the theme curates (M6-D3), keyed by the
     * persisted id; omitted = the default shell is the only shell. */
    shells?: Record<string, ShellDefinition>;
    /** Page papers the theme curates (M8-D4); omitted = none — the
     * author still has the free background picker either way. */
    papers?: PaperOption[];
    /** The theme's base block look (replaces the BlockFrame slot). May be a
     * single skin or kind→skin (e.g. stationery image→polaroid). Omitted =
     * framework default skin. */
    // inline import() avoids a circular type import (skin.ts imports Theme).
    defaultSkin?: import('./skin').BlockSkin | ((kind: string) => import('./skin').BlockSkin);
    /** Author-pickable block skins (replaces `shells`), keyed by persisted id. */
    skins?: Record<string, import('./skin').BlockSkin>;
  };

/** Shell choices applicable to a kind under a theme (inspector feed). */
export function shellOptionsFor(theme: Theme, kind: string): Array<{ id: string; name: string }> {
  return Object.entries(theme.shells ?? {})
    .filter(([, d]) => !d.kinds || d.kinds.includes(kind))
    .map(([id, d]) => ({ id, name: d.name }));
}

/** Frame for a block under an author shell choice: the shell's own
 * Frame when the choice is valid for this kind, otherwise undefined —
 * callers fall back to theme.BlockFrame / the default frame (unknown
 * ids keep rendering, same discipline as palette variants). */
export function resolveBlockFrame(
  theme: Theme,
  kind: string,
  shell: string | null | undefined,
): ComponentType<BlockFrameProps> | undefined {
  if (!shell) return undefined;
  const d = theme.shells?.[shell];
  if (!d || (d.kinds && !d.kinds.includes(kind))) return undefined;
  return d.Frame;
}

/** Public blob URL (server contract, [ADR-0022]) — surfaces resolve
 * background images from it. */
export function publicBlobUrl(hash: string): string {
  return `/api/public/blobs/${hash}`;
}

/** Override values land verbatim inside a published page's <style> block
 * (block-kinds/static.ts), so a value containing `</` could close the tag
 * and inject markup. No legitimate CSS value contains `</`. */
function isSafeCssValue(v: string): boolean {
  return !v.includes('</');
}

/** Author-picked background colors land in inline styles and published
 * HTML. Accept plain CSS color syntax only — no property smuggling
 * (`;`), no blocks/tags, no url()/expression(). Single truth source:
 * the background endpoint AND the importer validate through this. */
export function isSafeCssColor(v: string): boolean {
  return v.length <= 128 && !/[;{}<>]/.test(v) && !/url\s*\(|expression\s*\(/i.test(v);
}

/** Pure function: base tokens → palette variant tokens → whitelist-
 * filtered overrides. Slots, identity, and geometry pass through
 * untouched. Unknown paletteIds and non-whitelisted override keys are
 * ignored (a theme update may remove a variant — pages keep rendering). */
export function applyCustomization(base: Theme, c?: ThemeCustomization | null): Theme {
  if (!c) return base;
  const variant = c.paletteId ? base.palettes?.find((p) => p.id === c.paletteId) : undefined;
  const allowed = new Set(base.customizableTokens ?? []);
  const overrides: Partial<Record<OverridableTokenKey, string>> = {};
  for (const [k, v] of Object.entries(c.overrides ?? {})) {
    if (
      allowed.has(k as OverridableTokenKey) &&
      typeof v === 'string' &&
      v.trim() !== '' &&
      isSafeCssValue(v)
    ) {
      overrides[k as OverridableTokenKey] = v;
    }
  }
  if (!variant && Object.keys(overrides).length === 0) return base;
  return { ...base, ...variant?.tokens, ...overrides };
}

/** Single truth source for validating operator-supplied customization
 * (admin endpoint AND importer): drops unknown paletteIds and
 * non-whitelisted overrides; null when nothing valid remains. */
export function sanitizeCustomization(base: Theme, raw: unknown): ThemeCustomization | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const out: ThemeCustomization = {};
  if (typeof r.paletteId === 'string' && base.palettes?.some((p) => p.id === r.paletteId)) {
    out.paletteId = r.paletteId;
  }
  if (typeof r.overrides === 'object' && r.overrides !== null) {
    const allowed = new Set(base.customizableTokens ?? []);
    const overrides: Partial<Record<OverridableTokenKey, string>> = {};
    for (const [k, v] of Object.entries(r.overrides)) {
      if (
        allowed.has(k as OverridableTokenKey) &&
        typeof v === 'string' &&
        v.trim() !== '' &&
        isSafeCssValue(v)
      ) {
        overrides[k as OverridableTokenKey] = v.trim();
      }
    }
    if (Object.keys(overrides).length > 0) out.overrides = overrides;
  }
  return out.paletteId !== undefined || out.overrides !== undefined ? out : null;
}

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
  surfaceInsetBg: 'oklch(95% 0.01 80)',
  hairline: 'oklch(85% 0.01 80)',
  quoteColor: 'oklch(50% 0.02 80)',
  fontFamily: 'system-ui, sans-serif',
  kindHues: {
    markdown: 'oklch(60% 0.04 280)',
    image: 'oklch(65% 0.12 240)',
    code: 'oklch(55% 0.10 150)',
  },
  kindHueFallback: 'oklch(60% 0.05 0)',
  codeCss: GITHUB_ISH_CODE_CSS,
  // Whitelist path proof (M5-D3): the default theme opens font + accent.
  customizableTokens: ['fontFamily', 'accent'],
  // Curated papers (M8-D4): light tints that keep the dot grid legible.
  papers: [
    { id: 'bone', name: 'Bone', css: 'oklch(96.5% 0.012 85)' },
    { id: 'mint', name: 'Mint', css: 'oklch(96.5% 0.018 160)' },
    { id: 'sky', name: 'Sky', css: 'oklch(96.5% 0.018 240)' },
    { id: 'blush', name: 'Blush', css: 'oklch(96.5% 0.018 20)' },
  ],
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
  surfaceInsetBg: 'oklch(96% 0 0)',
  hairline: 'oklch(80% 0.005 270)',
  quoteColor: 'oklch(45% 0.01 270)',
  fontFamily: 'system-ui, sans-serif',
  kindHues: {
    markdown: 'oklch(25% 0.01 270)',
    image: 'oklch(25% 0.01 270)',
    code: 'oklch(25% 0.01 270)',
  },
  kindHueFallback: 'oklch(25% 0.01 270)',
  customizableTokens: ['fontFamily', 'accent'],
  // Own papers — inheriting graph-paper's warm tints via the spread
  // would clash with ink's stark page.
  papers: [
    { id: 'warm', name: 'Warm white', css: 'oklch(97.5% 0.008 85)' },
    { id: 'cool', name: 'Cool white', css: 'oklch(97.5% 0.005 250)' },
    { id: 'grey', name: 'Pale grey', css: 'oklch(94% 0 0)' },
  ],
};

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

/** Block body overflow under the autofit contract: autofit blocks clip
 * (no scrollbar — rowSpan ≥ fit so content lands exactly), every other
 * block keeps the theme's scroll behavior. Single truth source so the
 * default frame and every curated shell agree. */
export function blockOverflow(autofit: boolean | undefined): 'hidden' | 'auto' {
  return autofit ? 'hidden' : 'auto';
}

