// @vitest-environment happy-dom
/**
 * MeasureProbe (spec §5.3): an offscreen theme-Frame-wrapped RenderView at
 * the block's geometry width AND a definite tall cell height. It reports
 * fit = ceil((content + chrome + 2*pad)/slot) via onFit, where chrome is
 * derived as (probe cell height - content AREA). happy-dom does no layout,
 * so we stub ResizeObserver and inject the AREA and CONTENT offsetHeights.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, act } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { MeasureProbe } from '../MeasureProbe';

// no vitest globals → testing-library never auto-cleans.
afterEach(cleanup);

// The probe's definite cell height (mirror of MEASURE_CELL_PX). chrome is
// probeCell - area, so to drive a chrome of C set area = PROBE_CELL - C.
const PROBE_CELL = 4096;

// Capture the observed element (the CONTENT node) + trigger a "resize".
let observed: Element | null = null;
let fireResize: (() => void) | null = null;

beforeEach(() => {
  observed = null;
  fireResize = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe(el: Element) {
        observed = el;
        fireResize = () => this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function setHeight(el: Element | null, px: number) {
  Object.defineProperty(el as HTMLElement, 'offsetHeight', { value: px, configurable: true });
}

describe('MeasureProbe', () => {
  test('reports fit = ceil((content + chrome + 2*pad)/slot) on resize', () => {
    const onFit = vi.fn();
    const { container } = render(
      <ThemeProvider theme={graphPaper}>
        <MeasureProbe kind="markdown" blockId="g" colSpan={6} shell={null} content={{ markdown: 'hi' }} onFit={onFit} />
      </ThemeProvider>,
    );
    const area = container.querySelector('[data-skb-measure-area]');
    // chrome 0 (area fills the whole probe cell), content 130:
    // graphPaper slot=60 pad=4 → ceil((130 + 0 + 8)/60) = 3 rows
    setHeight(area, PROBE_CELL);
    setHeight(observed, 130); // observed === the CONTENT node
    act(() => fireResize!());
    expect(onFit).toHaveBeenLastCalledWith(3);
  });

  test('subtracts the frame chrome revealed by the content AREA', () => {
    const onFit = vi.fn();
    const { container } = render(
      <ThemeProvider theme={graphPaper}>
        <MeasureProbe kind="markdown" blockId="g" colSpan={6} shell={null} content={{ markdown: 'hi' }} onFit={onFit} />
      </ThemeProvider>,
    );
    const area = container.querySelector('[data-skb-measure-area]');
    // chrome 24 (area = cell - 24), content 310 → ceil((310+24+8)/60) = 6
    setHeight(area, PROBE_CELL - 24);
    setHeight(observed, 310);
    act(() => fireResize!());
    expect(onFit).toHaveBeenLastCalledWith(6);
  });

  test('lays the offscreen box out at the block geometry width', () => {
    const { container } = render(
      <ThemeProvider theme={graphPaper}>
        <MeasureProbe kind="markdown" blockId="g" colSpan={2} shell={null} content={{ markdown: 'hi' }} onFit={() => {}} />
      </ThemeProvider>,
    );
    // graphPaper slot=60 pad=4 → 2*60 - 8 = 112px on the probe wrapper
    const probe = container.querySelector('[data-skb-measure-probe]') as HTMLElement;
    expect(probe.style.width).toBe('112px');
  });
});
