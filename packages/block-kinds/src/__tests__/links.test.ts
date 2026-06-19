import { describe, expect, test } from 'vitest';
import { parsePermalink, permalinkOf, type LinkRef } from '../links';

describe('parsePermalink', () => {
  test('plain page permalink → {pageId}', () => {
    expect(parsePermalink('/p/abc123')).toEqual({ pageId: 'abc123' });
  });
  test('block permalink → {pageId, blockId}', () => {
    expect(parsePermalink('/p/abc123#blk9')).toEqual({ pageId: 'abc123', blockId: 'blk9' });
  });
  test('percent-encoded id is decoded', () => {
    expect(parsePermalink('/p/a%20b')).toEqual({ pageId: 'a b' });
  });
  test('malformed percent-encoding → null', () => {
    expect(parsePermalink('/p/%GG')).toBeNull();
  });
  test('non-permalink hrefs → null', () => {
    expect(parsePermalink('https://example.com')).toBeNull();
    expect(parsePermalink('/notes/some-slug')).toBeNull();
    expect(parsePermalink('#frag')).toBeNull();
  });
});

describe('permalinkOf', () => {
  test('page-only ref', () => {
    expect(permalinkOf({ pageId: 'abc123' })).toBe('/p/abc123');
  });
  test('block ref', () => {
    expect(permalinkOf({ pageId: 'abc123', blockId: 'blk9' })).toBe('/p/abc123#blk9');
  });
  test('round-trips through parsePermalink', () => {
    const ref: LinkRef = { pageId: 'my page', blockId: 'b 1' };
    expect(parsePermalink(permalinkOf(ref))).toEqual(ref);
  });
});
