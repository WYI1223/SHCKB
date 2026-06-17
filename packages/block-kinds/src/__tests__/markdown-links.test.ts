import { describe, expect, test } from 'vitest';
import { links } from '../markdown/markdown';

const md = (src: string) => ({ markdown: src });

describe('markdown links()', () => {
  test('extracts /p/:id link targets', () => {
    expect(links(md('see [other](/p/P1) and [blk](/p/P1#B2)'))).toEqual([
      { pageId: 'P1' },
      { pageId: 'P1', blockId: 'B2' },
    ]);
  });
  test('ignores external links', () => {
    expect(links(md('[x](https://example.com)'))).toEqual([]);
  });
});
