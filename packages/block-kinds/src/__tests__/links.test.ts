import { describe, expect, test } from 'vitest';
import { parsePermalink, type LinkRef } from '../links';

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
  test('non-permalink hrefs → null', () => {
    expect(parsePermalink('https://example.com')).toBeNull();
    expect(parsePermalink('/notes/some-slug')).toBeNull();
    expect(parsePermalink('#frag')).toBeNull();
  });
});
