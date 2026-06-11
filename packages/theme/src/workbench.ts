/**
 * Workbench — everyday professional theme (MVP-4 style round candidate).
 * Notion/Linear-school neutrality: cool near-white canvas, white cards
 * with a near-invisible hairline border + 8px radius (reads as a soft
 * shadow at a glance), low-saturation functional kind hues, restrained
 * standard-blue accent, GitHub-light-style code colors. Success
 * criterion: nobody comments on it; 30 minutes of long-form reading
 * without fatigue.
 */
import type { Theme } from './themes';

/** GitHub-light-leaning token colors, tuned to stay >= ~4.5:1 on the
 * white blockBg (comment gray is the floor at ~4.6:1). */
const WORKBENCH_CODE_CSS = `
.hljs-keyword, .hljs-selector-tag { color: oklch(50% 0.19 22); }
.hljs-string, .hljs-attr { color: oklch(38% 0.09 255); }
.hljs-number, .hljs-literal { color: oklch(45% 0.14 255); }
.hljs-comment { color: oklch(50% 0.015 255); font-style: italic; }
.hljs-title, .hljs-name { color: oklch(48% 0.17 295); }
.hljs-built_in, .hljs-type { color: oklch(45% 0.12 55); }
`;

export const workbench: Theme = {
  id: 'workbench',
  name: 'Workbench',
  slot: 60,
  pad: 4,
  // Cool-neutral near-white: strips the graph-paper warm tint without
  // reading as blue. Hue 260 with chroma 0.002 is perceptually gray.
  canvasBg: 'oklch(98.5% 0.002 260)',
  // Very faint dots — present on inspection, invisible while reading.
  dotColor: 'oklch(89% 0.005 260)',
  dotSize: 2,
  blockBg: 'oklch(100% 0 0)',
  // Hairline a step above canvasBg: card edges register as a soft
  // elevation change rather than a drawn outline.
  blockBorder: '1px solid oklch(92% 0.005 260)',
  blockRadius: '8px',
  // ~14.7:1 on blockBg, ~13.5:1 on canvasBg — comfortable long-form ink.
  textColor: 'oklch(28% 0.01 260)',
  // ~5.5:1 on white — secondary text stays AA.
  mutedColor: 'oklch(50% 0.015 260)',
  chromeBg: 'oklch(23% 0.015 260)',
  // Restrained standard blue (Linear/GitHub family), chroma held down.
  accent: 'oklch(52% 0.16 255)',
  danger: 'oklch(53% 0.18 25)',
  surfaceInsetBg: 'oklch(96.5% 0.003 260)',
  hairline: 'oklch(90% 0.005 260)',
  quoteColor: 'oklch(48% 0.015 260)',
  fontFamily: 'system-ui, sans-serif',
  // Low-saturation functional family: purple = prose, blue = media,
  // green = code. Same lightness band so no kind shouts.
  kindHues: {
    markdown: 'oklch(58% 0.07 285)',
    image: 'oklch(60% 0.09 245)',
    code: 'oklch(58% 0.09 155)',
  },
  kindHueFallback: 'oklch(60% 0.015 260)',
  codeCss: WORKBENCH_CODE_CSS,
};
