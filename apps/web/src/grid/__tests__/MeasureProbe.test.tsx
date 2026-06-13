// @vitest-environment happy-dom
/**
 * MeasureProbe (spec §5.3): an offscreen theme-Frame-wrapped RenderView
 * at the block's geometry width that reports fit = ceil(outerHeight/slot)
 * via onFit, re-reporting through a ResizeObserver. happy-dom does no
 * layout, so we stub ResizeObserver and inject the wrapper's offsetHeight.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, act } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { MeasureProbe } from '../MeasureProbe';

// no vitest globals → testing-library never auto-cleans.
afterEach(cleanup);

// Capture the observed element + trigger so we can fire a "resize".
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

/** Force the measured wrapper's offsetHeight (happy-dom returns 0). */
function setWrapperHeight(px: number) {
  Object.defineProperty(observed as HTMLElement, 'offsetHeight', { value: px, configurable: true });
}

describe('MeasureProbe', () => {
  test('reports fit = ceil(offsetHeight/slot) on observed resize', () => {
    const onFit = vi.fn();
    render(
      <ThemeProvider theme={graphPaper}>
        <MeasureProbe kind="markdown" blockId="g" colSpan={6} shell={null} content={{ markdown: 'hi' }} onFit={onFit} />
      </ThemeProvider>,
    );
    // slot=60: 130px outer -> ceil(130/60) = 3 rows
    setWrapperHeight(130);
    act(() => fireResize!());
    expect(onFit).toHaveBeenLastCalledWith(3);
  });

  test('lays the offscreen box out at the block geometry width', () => {
    render(
      <ThemeProvider theme={graphPaper}>
        <MeasureProbe kind="markdown" blockId="g" colSpan={2} shell={null} content={{ markdown: 'hi' }} onFit={() => {}} />
      </ThemeProvider>,
    );
    // graphPaper slot=60 pad=4 → 2*60 - 8 = 112px
    expect((observed as HTMLElement).style.width).toBe('112px');
  });
});
