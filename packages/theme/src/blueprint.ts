/**
 * 「蓝图 Blueprint」— engineering blueprint drawing (MVP-4 style round,
 * differentiated/artistic candidate). The product's DNA made visual:
 * the constrained canvas, 12-column grid and AABB blocks ARE an
 * engineering drawing of thought, so the theme renders notes as one —
 * deep Prussian-blue drawing sheet, bright cyan drafting grid, panels
 * as pen-stroked drawing frames (zero radius, thin cyan stroke),
 * drafting-pen line-code hues per kind, phosphor code colors.
 *
 * Plain data only [ADR-0024]; oklch colors only (style-round rule).
 */
import type { Theme } from './themes';

/**
 * Phosphor-on-blueprint code palette. blockBg is deep blue (~27-30% L),
 * so every token sits at >= 65% oklch lightness for AA-ish legibility;
 * the cyan / amber / green trio reads like a phosphor terminal laid
 * over the drawing sheet.
 */
const PHOSPHOR_CODE_CSS = `
.hljs-keyword, .hljs-selector-tag { color: oklch(83% 0.14 85); }
.hljs-string, .hljs-attr { color: oklch(82% 0.17 150); }
.hljs-number, .hljs-literal { color: oklch(83% 0.12 200); }
.hljs-comment { color: oklch(66% 0.05 230); font-style: italic; }
.hljs-title, .hljs-name { color: oklch(87% 0.11 195); }
.hljs-built_in, .hljs-type { color: oklch(85% 0.10 105); }
`;

export const blueprint: Theme = {
  id: 'blueprint',
  name: 'Blueprint',

  // Geometry is not a style axis this round.
  slot: 60,
  pad: 4,

  // The drawing sheet: deep Prussian blue.
  canvasBg: 'oklch(27% 0.062 245)',

  // The drafting grid — the strongest blueprint signal. Bright cyan
  // dots at slot pitch, softened with alpha so they read as printed
  // grid, not LEDs.
  dotColor: 'oklch(75% 0.115 215 / 60%)',
  dotSize: 2,

  // Panels: semi-transparent darker blue (the grid ghosts through,
  // like a detail view inked over the sheet), thin cyan pen stroke,
  // hard corners — a drawing frame, never a card.
  blockBg: 'oklch(30% 0.065 247 / 78%)',
  blockBorder: '1px solid oklch(75% 0.115 215 / 80%)',
  blockRadius: '0px',

  // Cyan-white ink. ~11.5:1 against blockBg/canvasBg composite.
  textColor: 'oklch(95% 0.018 215)',
  // Muted annotation ink, ~5.5:1 — still AA for the small text it labels.
  mutedColor: 'oklch(76% 0.05 220)',

  // Chrome darker than the sheet: the drawing board under the paper.
  chromeBg: 'oklch(21% 0.05 246)',

  // Drafting highlighter cyan; danger = red pencil markup.
  accent: 'oklch(80% 0.135 215)',
  danger: 'oklch(68% 0.19 25)',

  // Dark-surface tokens (the v2 fix: no more hardcoded light insets).
  surfaceInsetBg: 'oklch(22% 0.05 246)',
  hairline: 'oklch(60% 0.08 220 / 50%)',
  quoteColor: 'oklch(80% 0.06 218)',
  fontFamily: 'system-ui, sans-serif',

  // Drafting-pen line codes: each kind is a pen on the rail.
  // markdown = cyan ink, image = magenta pen, code = amber pen,
  // unknown kinds = plain white pencil.
  kindHues: {
    markdown: 'oklch(80% 0.13 215)',
    image: 'oklch(74% 0.18 330)',
    code: 'oklch(82% 0.14 85)',
  },
  kindHueFallback: 'oklch(93% 0.01 220)',

  codeCss: PHOSPHOR_CODE_CSS,
};
