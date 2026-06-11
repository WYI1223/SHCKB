import { describe, expect, test } from 'vitest';
import { createElement } from 'react';
import { graphPaper, type Theme } from '@skb/theme';
import { renderStaticPage } from '../static';

const DOC = {
  title: 'slots',
  blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'hello' } }],
};

describe('theme render slots', () => {
  test('default rendering exposes class hooks', () => {
    const html = renderStaticPage(DOC, 's', graphPaper);
    expect(html).toContain('class="skb-canvas"');
    expect(html).toContain('skb-block');
    expect(html).toContain('data-kind="markdown"');
  });

  test('custom BlockFrame replaces the shell; custom PageTitle replaces h1', () => {
    const themed: Theme = {
      ...graphPaper,
      id: 'custom',
      BlockFrame: ({ kind, blockId, children }) =>
        createElement('section', { className: 'my-frame', 'data-kind': kind, 'data-bid': blockId }, children),
      PageTitle: ({ title }) => createElement('h2', { className: 'my-title' }, title),
    };
    const html = renderStaticPage(DOC, 's', themed);
    expect(html).toContain('class="my-frame"');
    expect(html).toContain('data-bid="b1"');
    expect(html).toContain('<h2 class="my-title">slots</h2>');
    expect(html).toContain('hello'); // content still renders inside
  });

  test('globalCss lands in the static head', () => {
    const themed: Theme = { ...graphPaper, id: 'css', globalCss: '.skb-block{outline:1px solid red}' };
    const html = renderStaticPage(DOC, 's', themed);
    expect(html).toContain('.skb-block{outline:1px solid red}');
  });
});
