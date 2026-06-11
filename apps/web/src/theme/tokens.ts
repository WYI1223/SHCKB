/**
 * Theme seam (mvp-scope D4): graph-paper is the only theme; visuals
 * flow through this tokens object. The theme-system cascade replaces
 * this object's role later — components must not hardcode visuals.
 */
export const theme = {
  name: 'graph-paper',
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
  kindHue: (kind: string): string =>
    ({
      markdown: 'oklch(60% 0.04 280)',
      image: 'oklch(65% 0.12 240)',
    })[kind] ?? 'oklch(60% 0.05 0)',
} as const;

export type Theme = typeof theme;
