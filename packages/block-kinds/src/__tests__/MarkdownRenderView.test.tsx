// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { MarkdownRenderView } from '../markdown/MarkdownRenderView';

afterEach(cleanup);

describe('MarkdownRenderView', () => {
  test('empty content renders blank — no placeholder text, no .skb-md', () => {
    const { container } = render(
      <ThemeProvider theme={graphPaper}>
        <MarkdownRenderView content={{ markdown: '' }} />
      </ThemeProvider>,
    );
    // owner decision (frame-core slice): empty = blank everywhere, so readers
    // never see editor jargon and an emptied autofit block measures ~0 → floor.
    expect(container.textContent).toBe('');
    expect(container.querySelector('.skb-md')).toBeNull();
  });

  test('whitespace-only content is also treated as empty', () => {
    const { container } = render(
      <ThemeProvider theme={graphPaper}>
        <MarkdownRenderView content={{ markdown: '   \n  ' }} />
      </ThemeProvider>,
    );
    expect(container.textContent).toBe('');
  });

  test('non-empty content renders the markdown', () => {
    const { getByRole } = render(
      <ThemeProvider theme={graphPaper}>
        <MarkdownRenderView content={{ markdown: '# Hello' }} />
      </ThemeProvider>,
    );
    expect(getByRole('heading', { name: 'Hello' })).toBeTruthy();
  });
});
