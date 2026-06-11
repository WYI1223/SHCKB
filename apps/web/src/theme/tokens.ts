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

/**
 * Block card chrome shared by edit mode and read mode (theme-system
 * "theme consistent across modes" invariant): readers see the same
 * cards, minus editing affordances.
 */
export function blockCardStyle(kind: string): React.CSSProperties {
  return {
    background: theme.blockBg,
    border: theme.blockBorder,
    borderTop: `2px solid ${theme.kindHue(kind)}`,
    borderRadius: theme.blockRadius,
    padding: '8px 10px',
    overflow: 'hidden',
  };
}

/** Graph-paper baseplate background, shared by edit and read canvases. */
export function canvasBaseplateStyle(): React.CSSProperties {
  return {
    backgroundImage: `radial-gradient(circle, ${theme.dotColor} ${theme.dotSize / 2}px, transparent ${theme.dotSize / 2}px)`,
    backgroundSize: `${theme.slot}px ${theme.slot}px`,
    backgroundPosition: `${theme.slot - theme.dotSize / 2}px ${theme.slot - theme.dotSize / 2}px`,
  };
}

export type Theme = typeof theme;
