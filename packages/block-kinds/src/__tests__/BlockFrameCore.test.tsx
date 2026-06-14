// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider, graphPaper, type BlockSkin } from '@skb/theme';
import { BlockFrameCore } from '../BlockFrameCore';

afterEach(cleanup);

const skin: BlockSkin = {
  id: 's', name: 'S',
  root: { className: 'r', style: { transform: 'rotate(1deg)' } },
  box: { className: 'b', style: { padding: '7px' } },
  behind: () => <div data-testid="behind" />,
  front: () => <div data-testid="front" />,
};

function renderCore(autofit: boolean) {
  return render(
    <ThemeProvider theme={graphPaper}>
      <BlockFrameCore kind="markdown" blockId="x" colSpan={6} rowSpan={2} autofit={autofit} skin={skin}>
        <p data-testid="content">hi</p>
      </BlockFrameCore>
    </ThemeProvider>,
  );
}

describe('BlockFrameCore', () => {
  test('renders root + behind + content-box(content) + front', () => {
    const { getByTestId, container } = renderCore(false);
    expect(getByTestId('behind')).toBeTruthy();
    expect(getByTestId('front')).toBeTruthy();
    expect(getByTestId('content').textContent).toBe('hi');
    const box = container.querySelector('.skb-content-box') as HTMLElement;
    expect(box.contains(getByTestId('content'))).toBe(true);
  });

  test('content box owns overflow per autofit; HOST invariants win over the skin', () => {
    const box = renderCore(true).container.querySelector('.skb-content-box') as HTMLElement;
    expect(box.style.overflow).toBe('hidden');
    expect(box.style.position).toBe('relative');
    expect(box.style.padding).toBe('7px');
    const auto = renderCore(false).container.querySelector('.skb-content-box') as HTMLElement;
    expect(auto.style.overflow).toBe('auto');
  });

  test('skin root style (tilt) lands on the root, not the box', () => {
    const root = renderCore(false).container.querySelector('.skb-frame-root') as HTMLElement;
    expect(root.style.transform).toBe('rotate(1deg)');
  });
});
