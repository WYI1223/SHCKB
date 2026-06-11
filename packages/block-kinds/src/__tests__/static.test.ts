import { describe, expect, test } from 'vitest';
import { graphPaper, ink } from '@skb/theme';
import { NOT_FOUND_HTML, renderStaticPage } from '../static';

const DOC = {
  title: 'Hello <World>',
  blocks: [
    { id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: { markdown: '# Hi **there**' } },
    { id: 'b2', kind: 'image', col: 0, row: 1, colSpan: 4, rowSpan: 2, content: { blobHash: 'a'.repeat(64), alt: 'pic' } },
    { id: 'b3', kind: 'mystery', col: 4, row: 1, colSpan: 4, rowSpan: 1, content: {} },
  ],
};

describe('renderStaticPage', () => {
  test('full document with escaped title, markdown html, image src, unknown-kind fallback', () => {
    const html = renderStaticPage(DOC, 'hello-world', graphPaper);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Hello &lt;World&gt;');
    expect(html).toContain('<strong>there</strong>');
    expect(html).toContain(`/api/public/blobs/${'a'.repeat(64)}`);
    expect(html).toContain('Unsupported content');
    expect(html).toContain('/notes/hello-world');
  });

  test('theme tokens are baked in — different theme, different bytes', () => {
    const a = renderStaticPage(DOC, 's', graphPaper);
    const b = renderStaticPage(DOC, 's', ink);
    expect(a).not.toBe(b);
    expect(a).toContain(graphPaper.canvasBg);
    expect(b).toContain(ink.canvasBg);
  });

  test('deterministic: same inputs, same bytes', () => {
    expect(renderStaticPage(DOC, 's', graphPaper)).toBe(renderStaticPage(DOC, 's', graphPaper));
  });

  test('404 page exists', () => {
    expect(NOT_FOUND_HTML).toContain('does not exist');
  });
});

// ----- v2: surface tokens (dark-theme hardcode fix) -----

import { blueprint } from '@skb/theme';

describe('surface tokens', () => {
  test('dark theme: markdown inline code uses surfaceInsetBg, not the old light chip', () => {
    const doc = {
      title: 'dark',
      blocks: [{ id: 'm', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 2, content: { markdown: 'inline `code` here' } }],
    };
    const html = renderStaticPage(doc, 's', blueprint);
    expect(html).toContain(blueprint.surfaceInsetBg);
    expect(html).not.toContain('oklch(95% 0.01 80)'); // the old hardcode
  });
});
