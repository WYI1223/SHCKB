/**
 * MVP-10 Task 11 — publish-time /p/:id → /notes/:slug link materialization.
 * The pure helper is the unit under test; a second block feeds REAL
 * renderStaticPage output through it so the regex stays locked to the
 * actual renderer's attribute order (href first, then data-skb-*).
 */
import { describe, expect, test } from 'bun:test';
import { graphPaper } from '@skb/theme';
import { materializeInternalLinks, renderStaticPage, toRenderDoc } from '../src/render/publish-html';
import type { PublishedDoc } from '../src/db/schema';

describe('materializeInternalLinks (pure)', () => {
  test('resolvable /p/:id → /notes/:slug (fragment preserved); unresolvable left untouched', () => {
    const html =
      '<a href="/p/pg_known#b7" data-skb-page="pg_known" data-skb-block="b7">x</a>' +
      '<a href="/p/pg_missing" data-skb-page="pg_missing">y</a>';
    const out = materializeInternalLinks(html, new Map([['pg_known', 'my-note']]));

    // resolved: href rewritten, fragment kept, data attributes preserved
    expect(out).toContain('href="/notes/my-note#b7"');
    expect(out).toContain('data-skb-page="pg_known"');
    expect(out).toContain('data-skb-block="b7"');
    // unresolved: completely untouched (server 302 still resolves it)
    expect(out).toContain('href="/p/pg_missing"');
    expect(out).not.toContain('/notes/pg_missing');
  });

  test('page-only link (no fragment) rewrites with no trailing #', () => {
    const out = materializeInternalLinks('<a href="/p/pg1">z</a>', new Map([['pg1', 'slug-1']]));
    expect(out).toContain('href="/notes/slug-1"');
    expect(out).not.toContain('#');
  });

  test('percent-encoded id is decoded for lookup; resolved slug is re-encoded', () => {
    // RichtextRenderView emits encodeURIComponent ids → href carries "a%20b"
    const out = materializeInternalLinks('<a href="/p/a%20b">w</a>', new Map([['a b', 'spaced slug']]));
    expect(out).toContain('href="/notes/spaced%20slug"');
  });

  test('malformed percent-encoding is left untouched (never throws)', () => {
    const html = '<a href="/p/%GG">w</a>';
    expect(() => materializeInternalLinks(html, new Map([['x', 'y']]))).not.toThrow();
    expect(materializeInternalLinks(html, new Map())).toBe(html);
  });

  test('empty map is a no-op', () => {
    const html = '<a href="/p/pg1#b">x</a>';
    expect(materializeInternalLinks(html, new Map())).toBe(html);
  });
});

describe('materializeInternalLinks against real renderStaticPage output', () => {
  // a richtext block whose pagelink targets pg_known (block b7) — exactly the
  // shape RichtextRenderView serializes through the publish pipeline.
  const doc: PublishedDoc = {
    title: 'Linker',
    gravityEnabled: true,
    background: null,
    publishedAt: 0,
    blocks: [
      {
        id: 'blk1',
        kind: 'richtext',
        col: 0,
        row: 0,
        colSpan: 12,
        rowSpan: 2,
        shell: null,
        autofit: null,
        content: {
          doc: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'to ', },
                  { type: 'text', text: 'known', marks: [{ type: 'pagelink', attrs: { pageId: 'pg_known', blockId: 'b7' } }] },
                  { type: 'text', text: ' and ', },
                  { type: 'text', text: 'missing', marks: [{ type: 'pagelink', attrs: { pageId: 'pg_missing', blockId: null } }] },
                ],
              },
            ],
          },
        },
      },
    ],
  } as unknown as PublishedDoc;

  test('the renderer emits /p/:id hrefs that the helper rewrites', () => {
    const rendered = renderStaticPage(toRenderDoc(doc), 'linker', graphPaper);
    expect(rendered).toContain('href="/p/pg_known#b7"');

    const out = materializeInternalLinks(rendered, new Map([['pg_known', 'known-note']]));
    expect(out).toContain('href="/notes/known-note#b7"');
    expect(out).toContain('data-skb-page="pg_known"'); // attrs survive
    expect(out).toContain('href="/p/pg_missing"'); // unresolved stays a permalink
  });
});
