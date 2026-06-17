import { describe, expect, test } from 'vitest';
import { links } from '../richtext/richtext';
import type { PmMark, RichtextContent } from '../richtext/richtext';

const doc = (marks: PmMark[]): RichtextContent => ({
  doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks }] }] },
});

describe('richtext links()', () => {
  test('page-level pagelink → {pageId}', () => {
    expect(links(doc([{ type: 'pagelink', attrs: { pageId: 'P1' } }]))).toEqual([{ pageId: 'P1' }]);
  });
  test('block-level pagelink → {pageId, blockId}', () => {
    expect(links(doc([{ type: 'pagelink', attrs: { pageId: 'P1', blockId: 'B2' } }]))).toEqual([
      { pageId: 'P1', blockId: 'B2' },
    ]);
  });
  test('dedups repeated targets, ignores non-pagelink marks', () => {
    const c = doc([
      { type: 'pagelink', attrs: { pageId: 'P1' } },
      { type: 'pagelink', attrs: { pageId: 'P1' } },
      { type: 'strong' },
    ]);
    expect(links(c)).toEqual([{ pageId: 'P1' }]);
  });
});
