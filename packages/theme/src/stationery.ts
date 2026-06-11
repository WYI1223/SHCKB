/**
 * 「手帐 Stationery」— warm journal/diary theme (MVP-4 style round).
 * Digital translation of Hobonichi/Midori paper journals: the canvas
 * baseplate dots read as printed paper grid, blocks read as paper slips
 * taped in with washi-hued kind strips, text is ink-brown rather than
 * pure black. Plain data only [ADR-0024].
 */
import type { Theme } from './themes';

/** Code slips pasted into a journal: warm, low-saturation ink tones
 * that hold WCAG AA on the off-white paper slip (blockBg L 98%). */
const STATIONERY_CODE_CSS = `
.hljs-keyword, .hljs-selector-tag { color: oklch(44% 0.10 350); }
.hljs-string, .hljs-attr { color: oklch(45% 0.08 145); }
.hljs-number, .hljs-literal { color: oklch(47% 0.09 245); }
.hljs-comment { color: oklch(51% 0.045 70); font-style: italic; }
.hljs-title, .hljs-name { color: oklch(47% 0.10 65); }
.hljs-built_in, .hljs-type { color: oklch(49% 0.11 35); }
`;

export const stationery: Theme = {
  id: 'stationery',
  name: 'Stationery',
  slot: 60,
  pad: 4,
  /** Warm cream notebook paper (kraft-warm hue 90). */
  canvasBg: 'oklch(95.5% 0.027 90)',
  /** Faint kraft-brown printed paper grid — not engineering coordinates. */
  dotColor: 'oklch(80% 0.045 75)',
  dotSize: 2,
  /** Off-white paper slip, a touch brighter than the cream canvas. */
  blockBg: 'oklch(98% 0.013 95)',
  /** Pencil-thin dashed kraft outline, like a cut-and-pasted slip. */
  blockBorder: '1px dashed oklch(72% 0.05 75)',
  blockRadius: '6px',
  /** Sepia ink-brown — warm but still ~11:1 on both paper surfaces. */
  textColor: 'oklch(33% 0.045 55)',
  mutedColor: 'oklch(49% 0.05 60)',
  /** Espresso-brown chrome, the journal's leather cover. */
  chromeBg: 'oklch(28% 0.04 60)',
  /** Misty fountain-pen blue. */
  accent: 'oklch(55% 0.08 240)',
  /** Warm muted red, a correction-pen mark rather than an alarm. */
  danger: 'oklch(52% 0.16 28)',
  /** Washi-tape strips along the top edge of each slip. */
  kindHues: {
    markdown: 'oklch(78% 0.06 20)', // dusty pink washi
    image: 'oklch(78% 0.05 230)', // misty blue washi
    code: 'oklch(78% 0.06 145)', // sage green washi
  },
  kindHueFallback: 'oklch(78% 0.07 80)', // ochre washi
  codeCss: STATIONERY_CODE_CSS,
};
