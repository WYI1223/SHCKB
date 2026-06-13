/**
 * MeasureProbe — the autofit measurement surface (spec §5.3).
 *
 * Wraps the kind's RenderView in the REAL resolved theme Frame at the
 * block's exact grid geometry width (colSpan*slot - 2*pad), so wrapping
 * width AND theme typography/globalCss match the live/published render
 * by construction. A ResizeObserver re-derives fit = ceil(wrapper
 * offsetHeight / slot) on every reflow (content / colSpan / theme-font /
 * mount). We measure the FRAME WRAPPER's outer height and never subtract
 * chrome, never measure a bare RenderView.
 *
 * This node is ALWAYS offscreen/invisible (measurement-only). The sole
 * visible preview is the EditView ghost (data-skb-ghost-preview, spec §7).
 */
import { useLayoutEffect, useRef } from 'react';
import { blockModule, DefaultBlockFrame } from '@skb/block-kinds';
import { resolveBlockFrame, useTheme } from '@skb/theme';
import { fitFromOuterHeight, measuredWidthPx } from './measureFit';

export type MeasureProbeProps = {
  kind: string;
  blockId: string;
  colSpan: number;
  shell: string | null;
  content: unknown;
  onFit: (fit: number) => void;
};

export function MeasureProbe({ kind, blockId, colSpan, shell, content, onFit }: MeasureProbeProps) {
  const theme = useTheme();
  const mod = blockModule(kind);
  const Frame = resolveBlockFrame(theme, kind, shell) ?? theme.BlockFrame ?? DefaultBlockFrame;
  const wrapRef = useRef<HTMLDivElement>(null);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;
  const width = measuredWidthPx(colSpan, theme.slot, theme.pad);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const report = () => onFitRef.current(fitFromOuterHeight(el.offsetHeight, theme.slot));
    report(); // mount measurement
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
    // re-measure when geometry width or theme metrics change
  }, [width, theme.slot]);

  if (!mod) return null;
  const Render = mod.RenderView;
  const safe = (content ?? mod.createContent()) as never;

  return (
    <div
      aria-hidden
      data-skb-measure-probe
      ref={wrapRef}
      style={{
        position: 'absolute',
        width: `${width}px`,
        // always offscreen — measurement-only; EditView ghost is the visible preview
        left: '-99999px',
        top: 0,
        visibility: 'hidden',
      }}
    >
      <Frame kind={kind} blockId={blockId} colSpan={colSpan} rowSpan={1} shell={shell}>
        <Render content={safe} />
      </Frame>
    </div>
  );
}
