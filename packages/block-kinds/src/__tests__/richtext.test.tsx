// @vitest-environment happy-dom
/**
 * Richtext kind (M9): the JSON walkers (zero-PM contract for the
 * publish path), the schema↔walker lockstep, and RenderView output —
 * including pagelink permalinks and href sanitization. Rendering uses
 * renderToStaticMarkup like the rest of this package: it is literally
 * the publish pipeline's render mode.
 */
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Node as PmNode } from 'prosemirror-model';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { SPACING_LINE_HEIGHT, coerceContent, createContent, extractText, linkedPageIds, type RichtextContent } from '../richtext/richtext';
import { richtextSchema } from '../richtext/schema';
import { RichtextRenderView } from '../richtext/RichtextRenderView';

const SAMPLE: RichtextContent = {
  doc: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Some ' },
          { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
          { type: 'text', text: ' and a ' },
          { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://x.test' } }] },
          { type: 'text', text: ' plus ' },
          { type: 'text', text: 'June notes', marks: [{ type: 'pagelink', attrs: { pageId: 'pg_42' } }] },
        ],
      },
      {
        type: 'bullet_list',
        content: [
          { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item one' }] }] },
          { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item two' }] }] },
        ],
      },
    ],
  },
};

/** Render exactly like the publish pipeline, query like a reader. */
function renderRt(content: RichtextContent): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(
    <ThemeProvider theme={graphPaper}>
      <RichtextRenderView content={content} />
    </ThemeProvider>,
  );
  return host;
}

describe('richtext content model', () => {
  test('createContent is an empty single-paragraph doc', () => {
    const c = createContent();
    expect(c.doc.type).toBe('doc');
    expect(extractText(c)).toBe('');
  });

  test('coerceContent degrades garbage to empty, keeps valid docs', () => {
    expect(coerceContent(null)).toEqual(createContent());
    expect(coerceContent('garbage')).toEqual(createContent());
    expect(coerceContent({ doc: { type: 'nonsense' } })).toEqual(createContent());
    expect(coerceContent(SAMPLE)).toEqual(SAMPLE);
  });

  test('extractText joins blocks with newlines, drops formatting', () => {
    const text = extractText(SAMPLE);
    expect(text).toContain('Title');
    expect(text).toContain('Some bold and a link plus June notes');
    expect(text).toContain('item one');
    expect(text).not.toContain('https://x.test');
    expect(text).not.toContain('pg_42');
  });

  test('linkedPageIds collects pagelink targets', () => {
    expect(linkedPageIds(SAMPLE)).toEqual(['pg_42']);
    expect(linkedPageIds(createContent())).toEqual([]);
  });
});

describe('schema ↔ walker lockstep', () => {
  test('the sample doc is valid under the PM schema (round-trips)', () => {
    const node = PmNode.fromJSON(richtextSchema, SAMPLE.doc);
    expect(node.toJSON()).toEqual(SAMPLE.doc);
  });

  test('every schema node and mark renders through a walker branch', () => {
    const everything: RichtextContent = {
      doc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'h' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'a', marks: [{ type: 'strong' }, { type: 'em' }, { type: 'code' }] },
              { type: 'hard_break' },
              { type: 'text', text: 'b', marks: [{ type: 'link', attrs: { href: '/x' } }] },
            ],
          },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'q' }] }] },
          {
            type: 'ordered_list',
            content: [{ type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'li' }] }] }],
          },
        ],
      },
    };
    expect(() => PmNode.fromJSON(richtextSchema, everything.doc)).not.toThrow();
    const host = renderRt(everything);
    for (const tag of ['h1', 'strong', 'em', 'code', 'br', 'a', 'blockquote', 'ol', 'li']) {
      expect(host.querySelector(tag), tag).not.toBeNull();
    }
  });
});

describe('RichtextRenderView', () => {
  test('renders structure: headings, marks, lists', () => {
    const host = renderRt(SAMPLE);
    expect(host.querySelector('h2')?.textContent).toBe('Title');
    expect(host.querySelector('strong')?.textContent).toBe('bold');
    expect(host.querySelectorAll('li')).toHaveLength(2);
  });

  test('pagelink renders the /p/:id permalink with the data attribute', () => {
    const host = renderRt(SAMPLE);
    const a = host.querySelector('a[data-skb-page]');
    expect(a?.getAttribute('href')).toBe('/p/pg_42');
    expect(a?.textContent).toBe('June notes');
  });

  test('unsafe hrefs are neutralized', () => {
    const host = renderRt({
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'evil', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }],
          },
        ],
      },
    });
    expect(host.querySelector('a')?.getAttribute('href')).toBe('#');
  });

  test('unknown nodes degrade to their children (content preserved)', () => {
    const host = renderRt({
      doc: {
        type: 'doc',
        content: [{ type: 'future_node', content: [{ type: 'text', text: 'survives' }] }],
      },
    });
    expect(host.textContent).toContain('survives');
  });

  test('empty doc shows the muted placeholder', () => {
    const host = renderRt(createContent());
    expect(host.textContent).toContain('Empty richtext block');
  });

  test('color mark paints palette values, rejects unsafe ones (M9-D3)', () => {
    const colored = (css: string): RichtextContent => ({
      doc: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'tinted', marks: [{ type: 'color', attrs: { color: css } }] }] },
        ],
      },
    });
    const ok = renderRt(colored('oklch(55% 0.18 25)'));
    expect(ok.querySelector('p [style]')?.getAttribute('style') ?? '').toContain('oklch');
    const evil = renderRt(colored('red;background:url(x)'));
    expect(evil.querySelector('p [style]')).toBeNull();
  });

  test('spacing drives line-height; coerce keeps valid values only (M9-D3)', () => {
    const base = { ...SAMPLE, spacing: 'relaxed' as const };
    const host = renderRt(base);
    expect((host.querySelector('.skb-rt') as HTMLElement).style.lineHeight).toBe(String(SPACING_LINE_HEIGHT.relaxed));
    expect(coerceContent(base)).toEqual(base);
    expect(coerceContent({ ...SAMPLE, spacing: 'gigantic' })).toEqual(SAMPLE);
  });
});
