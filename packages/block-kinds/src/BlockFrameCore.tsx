/**
 * BlockFrameCore — the host-owned block frame (spec 2026-06-14 §4). Used by
 * the editor (GridCanvas), the published view (PublishedCanvas), AND the
 * autofit MeasureProbe — so "what is measured" == "what is rendered" by
 * construction. The `.skb-content-box` is the INVARIANT: always in normal
 * flow, establishes the content's natural height, and is the overflow/clip
 * container. The skin dresses it but its box/root styles are visual-only
 * (typed), and the host applies its invariant props LAST so a skin can never
 * reintroduce the absolute-positioned collapse. (ADR-0025 amendment.)
 */
import type { ReactNode } from 'react';
import { blockOverflow, kindHue, useTheme, DEFAULT_SKIN_ID, type BlockSkin, type SkinCtx } from '@skb/theme';

export type BlockFrameCoreProps = {
  kind: string;
  blockId: string;
  colSpan: number;
  rowSpan: number;
  autofit?: boolean;
  skin: BlockSkin;
  children: ReactNode;
};

export function BlockFrameCore({ kind, blockId, colSpan, rowSpan, autofit, skin, children }: BlockFrameCoreProps) {
  const theme = useTheme();
  const ctx: SkinCtx = { blockId, kind, colSpan, rowSpan, tokens: theme };
  // Framework default skin: the graph-paper-ish card, token-driven. Applied
  // when the resolved skin is the sentinel (theme defined no skin).
  const isDefault = skin.id === DEFAULT_SKIN_ID;
  const defaultBox = isDefault
    ? {
        background: theme.blockBg,
        border: theme.blockBorder,
        borderTop: `2px solid ${kindHue(theme, kind)}`,
        borderRadius: theme.blockRadius,
        padding: '8px 10px',
        fontSize: '14px',
        lineHeight: 1.55,
        color: theme.textColor,
      }
    : {};

  return (
    <div
      className={`skb-frame-root${skin.root?.className ? ' ' + skin.root.className : ''}`}
      data-kind={kind}
      style={{ position: 'relative', width: '100%', height: '100%', ...skin.root?.style, ...skin.rootStyleOf?.(ctx) }}
    >
      {skin.behind?.(ctx)}
      <div
        className={`skb-content-box${skin.box?.className ? ' ' + skin.box.className : ''}`}
        style={{
          ...defaultBox,
          ...skin.box?.style,
          // HOST INVARIANT wins (a skin cannot override these):
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: blockOverflow(autofit),
        }}
      >
        {children}
      </div>
      {skin.front?.(ctx)}
    </div>
  );
}
