/**
 * MeasureProbe — the autofit measurement surface (spec §5.3).
 *
 * Wraps the kind's RenderView in the REAL resolved theme Frame at the
 * block's exact grid geometry width (colSpan*slot - 2*pad) AND a DEFINITE
 * tall cell height, so wrapping width, theme typography/globalCss, AND the
 * frame's own layout all match the live/published render by construction.
 * The definite height matters: a block fills the cell the canvas gives it,
 * and some frames draw content in an absolutely-positioned inset layer
 * (e.g. the stationery paper slip) that collapses to zero height when given
 * no cell — measuring the frame's auto height would silently report fit=1.
 *
 * Inside the frame we mount two nested probes:
 *  - AREA  (height:100%): stretches to the frame's content box → its height
 *    is the content area available at the probe cell height.
 *  - CONTENT (height:auto): the RenderView at its natural height.
 * chrome = probeCellHeight - area; fit = ceil((content + chrome + 2*pad)/slot)
 * (see measureFit.fitFromContent). No per-frame knowledge, no getComputedStyle.
 *
 * This node is ALWAYS offscreen/invisible (measurement-only). The sole
 * visible preview is the EditView ghost (data-skb-ghost-preview, spec §7).
 */
import { useLayoutEffect, useRef } from 'react';
import { blockModule, DefaultBlockFrame } from '@skb/block-kinds';
import { resolveBlockFrame, useTheme } from '@skb/theme';
import { fitFromContent, measuredWidthPx } from './measureFit';

/** Definite cell height for the probe: tall enough that any realistic
 * block's content area is established (frames fill it via height:100% /
 * inset). chrome is constant in this height, so the exact value is
 * immaterial as long as it dwarfs the chrome. */
const MEASURE_CELL_PX = 4096;

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
  const areaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;
  const width = measuredWidthPx(colSpan, theme.slot, theme.pad);

  useLayoutEffect(() => {
    const contentEl = contentRef.current;
    const areaEl = areaRef.current;
    if (!contentEl || !areaEl) return;
    const report = () => {
      // area = the frame's content box height at the probe cell height;
      // chrome = everything the frame consumes between cell edge and content.
      const chrome = MEASURE_CELL_PX - areaEl.offsetHeight;
      onFitRef.current(fitFromContent(contentEl.offsetHeight, chrome, theme.slot, theme.pad));
    };
    report(); // mount measurement
    // content height changes (typing) re-fire; geometry/theme changes
    // re-run the effect (width/slot/pad deps) and rebuild the observer.
    const ro = new ResizeObserver(report);
    ro.observe(contentEl);
    return () => ro.disconnect();
  }, [width, theme.slot, theme.pad]);

  if (!mod) return null;
  const Render = mod.RenderView;
  const safe = (content ?? mod.createContent()) as never;

  return (
    <div
      aria-hidden
      data-skb-measure-probe
      style={{
        position: 'absolute',
        width: `${width}px`,
        height: `${MEASURE_CELL_PX}px`,
        // always offscreen — measurement-only; EditView ghost is the visible preview
        left: '-99999px',
        top: 0,
        visibility: 'hidden',
      }}
    >
      <Frame kind={kind} blockId={blockId} colSpan={colSpan} rowSpan={1} shell={shell}>
        {/* AREA: stretches to the frame's content box → reveals the
            available content area (and thus the frame's vertical chrome). */}
        <div ref={areaRef} data-skb-measure-area style={{ height: '100%' }}>
          {/* CONTENT: the RenderView at its natural height. */}
          <div ref={contentRef} data-skb-measure-content>
            <Render content={safe} />
          </div>
        </div>
      </Frame>
    </div>
  );
}
