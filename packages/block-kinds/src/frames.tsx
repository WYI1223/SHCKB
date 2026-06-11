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
      style={{
        position: 'relative',
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        ...canvasBaseplateStyle(theme),
      }}
    >
      {children}
    </div>
  );
}

export function DefaultPageTitle({ title }: PageTitleProps) {
  const theme = useTheme();
  return <h1 style={{ color: theme.textColor, fontSize: '26px', margin: '0 0 24px' }}>{title}</h1>;
}
