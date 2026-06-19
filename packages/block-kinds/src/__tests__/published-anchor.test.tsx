// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { PublishedCanvas } from '../PublishedCanvas';

afterEach(cleanup);

test('each published block tile carries data-block-id', () => {
  const doc = { title: 'T', gravityEnabled: true, blocks: [
    { id: 'B1', kind: 'markdown', col: 0, row: 0, colSpan: 4, rowSpan: 1, content: { markdown: 'hello' }, follow: true },
  ] } as never;
  const { container } = render(<ThemeProvider theme={graphPaper}><PublishedCanvas doc={doc} /></ThemeProvider>);
  expect(container.querySelector('[data-block-id="B1"]')).toBeTruthy();
});
