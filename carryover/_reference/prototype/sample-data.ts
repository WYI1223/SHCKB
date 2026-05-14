/**
 * THROWAWAY — sample blocks for the grid UI prototype. Realistic-ish
 * mix of 6-8 blocks at varied sizes, kinds, and positions to make the
 * variants look populated (not a vacuum).
 */
import type { Block } from '@skb/grid-engine';

export const SAMPLE_BLOCKS: Block[] = [
  {
    id: 'h1',
    col: 0,
    row: 0,
    colSpan: 12,
    rowSpan: 1,
    kind: 'markdown',
  },
  {
    id: 'p1',
    col: 0,
    row: 1,
    colSpan: 6,
    rowSpan: 2,
    kind: 'markdown',
  },
  {
    id: 'img1',
    col: 6,
    row: 1,
    colSpan: 6,
    rowSpan: 4,
    kind: 'image',
  },
  {
    id: 'callout1',
    col: 0,
    row: 3,
    colSpan: 6,
    rowSpan: 2,
    kind: 'callout',
  },
  {
    id: 'code1',
    col: 0,
    row: 5,
    colSpan: 12,
    rowSpan: 4,
    kind: 'code',
  },
  {
    id: 'math1',
    col: 0,
    row: 9,
    colSpan: 6,
    rowSpan: 2,
    kind: 'math',
  },
  {
    id: 'pdf1',
    col: 6,
    row: 9,
    colSpan: 6,
    rowSpan: 6,
    kind: 'pdf',
  },
];

export const KIND_LABELS: Record<string, string> = {
  markdown: 'Markdown',
  image: 'Image',
  code: 'Code',
  callout: 'Callout',
  math: 'Math',
  pdf: 'PDF',
  jupyter: 'Jupyter',
  'nn-viz': 'NN viz',
  'agent-flow': 'Agent flow',
};

export const KIND_HUES: Record<string, string> = {
  markdown: 'oklch(60% 0.04 280)', // muted purple
  image: 'oklch(65% 0.12 240)', // blue
  code: 'oklch(60% 0.10 140)', // green
  callout: 'oklch(65% 0.13 50)', // orange
  math: 'oklch(60% 0.10 320)', // magenta
  pdf: 'oklch(60% 0.10 30)', // red-orange
  jupyter: 'oklch(60% 0.10 80)', // yellow-green
  'nn-viz': 'oklch(60% 0.10 200)', // cyan
  'agent-flow': 'oklch(60% 0.10 0)', // red
};

export const KIND_GLYPHS: Record<string, string> = {
  markdown: '¶',
  image: '◧',
  code: '<>',
  callout: '!',
  math: '∑',
  pdf: '◈',
  jupyter: '⌘',
  'nn-viz': '◉',
  'agent-flow': '⇄',
};
