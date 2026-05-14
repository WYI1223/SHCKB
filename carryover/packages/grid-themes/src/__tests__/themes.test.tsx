/**
 * Built-in themes smoke render: each theme's renderBaseplate /
 * renderBlock / renderDropPreview returns a React element without
 * throwing. Not full visual regression — just hydration safety.
 */
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { bentoCanvasTheme, graphPaperTheme, legoStudsTheme } from '../built-in';
import type { Block } from '@skb/grid-engine';

const sampleBlock: Block = {
  id: 'b1',
  col: 0,
  row: 0,
  colSpan: 6,
  rowSpan: 2,
  kind: 'markdown',
};

const themes = [
  { name: 'graph-paper', theme: graphPaperTheme },
  { name: 'lego-studs', theme: legoStudsTheme },
  { name: 'bento-canvas', theme: bentoCanvasTheme },
] as const;

describe.each(themes)('$name theme renders', ({ theme }) => {
  test('renderBaseplate', () => {
    const { container } = render(
      <>{theme.renderBaseplate({ totalCols: 12, totalRows: 8, dragInProgress: false, slotSize: theme.slotSize })}</>,
    );
    expect(container.querySelector('[data-skb-baseplate]')).not.toBeNull();
  });

  test('renderBlock with content', () => {
    const { container } = render(
      <>
        {theme.renderBlock({
          block: sampleBlock,
          isDragging: false,
          isResizing: false,
          isFocused: false,
          children: <span data-testid="content">hello</span>,
        })}
      </>,
    );
    expect(container.querySelector('[data-skb-theme-block]')).not.toBeNull();
    expect(container.querySelector('[data-testid="content"]')).not.toBeNull();
  });

  test('renderDropPreview valid + invalid', () => {
    const { rerender, container } = render(
      <>
        {theme.renderDropPreview({
          col: 0,
          row: 0,
          colSpan: 6,
          rowSpan: 2,
          isValid: true,
          slotSize: theme.slotSize,
        })}
      </>,
    );
    expect(container.querySelector('[data-skb-drop-ghost]')).not.toBeNull();
    rerender(
      <>
        {theme.renderDropPreview({
          col: 0,
          row: 0,
          colSpan: 6,
          rowSpan: 2,
          isValid: false,
          slotSize: theme.slotSize,
        })}
      </>,
    );
    expect(container.querySelector('[data-skb-drop-ghost]')).not.toBeNull();
  });

  test('cssVars includes --skb-slot-size and per-kind hues', () => {
    expect(theme.cssVars).toHaveProperty('--skb-slot-size');
    expect(theme.cssVars).toHaveProperty('--skb-kind-markdown');
    expect(theme.cssVars).toHaveProperty('--skb-kind-image');
  });

  test('slotSize matches uniform-square invariant', () => {
    expect(theme.slotSize).toBeGreaterThan(0);
    expect(theme.cssVars['--skb-slot-size']).toBe(`${theme.slotSize}px`);
  });
});
