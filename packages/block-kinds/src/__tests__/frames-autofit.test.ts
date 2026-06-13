import { describe, expect, test } from 'vitest';
import { graphPaper } from '@skb/theme';
import { renderStaticPage } from '../static';

const base = {
  id: 'b1',
  kind: 'markdown' as const,
  col: 0,
  row: 0,
  colSpan: 6,
  rowSpan: 2,
  content: { markdown: 'hello' },
};

function docWith(autofit: boolean | undefined) {
  return { title: 't', blocks: [{ ...base, autofit }] };
}

describe('DefaultBlockFrame autofit overflow', () => {
  test('autofit block clips (overflow:hidden)', () => {
    const html = renderStaticPage(docWith(true), 's', graphPaper);
    expect(html).toContain('overflow:hidden');
    expect(html).not.toContain('overflow:auto');
  });

  test('non-autofit block scrolls (overflow:auto)', () => {
    const html = renderStaticPage(docWith(false), 's', graphPaper);
    expect(html).toContain('overflow:auto');
  });

  test('absent autofit defaults to scroll (legacy/off)', () => {
    const html = renderStaticPage(docWith(undefined), 's', graphPaper);
    expect(html).toContain('overflow:auto');
  });
});
