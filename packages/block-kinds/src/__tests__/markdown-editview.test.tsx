// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { MarkdownEditView } from '../markdown/MarkdownEditView';

function renderEdit(markdown: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(
    <ThemeProvider theme={graphPaper}>
      <MarkdownEditView content={{ markdown }} onChange={() => undefined} />
    </ThemeProvider>,
  );
  return host;
}

describe('MarkdownEditView single-pane + ghost preview', () => {
  test('renders exactly one textarea (no dual editing pane)', () => {
    const host = renderEdit('# hi');
    expect(host.querySelectorAll('textarea')).toHaveLength(1);
  });

  test('the source textarea carries the markdown value and a label', () => {
    const host = renderEdit('# hi');
    const ta = host.querySelector('textarea')!;
    expect(ta.value).toBe('# hi');
    expect(ta.getAttribute('aria-label')).toBe('Markdown source');
  });

  test('ghost preview is present and renders the markdown (feedback loop)', () => {
    const host = renderEdit('# hi **bold**');
    const ghost = host.querySelector('[data-skb-ghost-preview]');
    expect(ghost).not.toBeNull();
    // the SAME MarkdownRenderView component renders inside it
    expect(ghost!.querySelector('.skb-md')).not.toBeNull();
    expect(ghost!.querySelector('strong')?.textContent).toBe('bold');
  });

  test('ghost preview is visible (right-aligned floating, NOT the old aria-hidden=true pane)', () => {
    const host = renderEdit('hi');
    const ghost = host.querySelector('[data-skb-ghost-preview]') as HTMLElement;
    // a visible preview the author can see — the old dual pane set aria-hidden
    expect(ghost.getAttribute('aria-hidden')).not.toBe('true');
    expect(ghost.style.position).toBe('absolute');
    expect(ghost.style.right).not.toBe('');
  });
});
