/**
 * Theme = a swappable token set (MVP-4 theme seam; the theme-system
 * L0-L3 cascade builds on this later). All content-surface visuals flow
 * through a Theme value — components never hardcode visuals.
 * publishedHtml purity depends on Theme being plain data [ADR-0024].
 */
import type React from 'react';
import type { ComponentType, ReactNode } from 'react';
import { blueprint } from './blueprint';
import { stationery } from './stationery';
import { workbench } from './workbench';

export type BlockFrameProps = {
  kind: string;
  blockId: string;
  /** Geometry hints (grid units) — themes may scale effects by size
   * (e.g. wide blocks tilt less). Never used for layout (canvas owns
   * geometry). */
  colSpan: number;
  rowSpan: number;
  children: ReactNode;
};
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

export type Theme = ThemeTokens & ThemeSlots;

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
};

export const THEMES: Record<string, Theme> = { 'graph-paper': graphPaper, ink, workbench, stationery, blueprint };
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

