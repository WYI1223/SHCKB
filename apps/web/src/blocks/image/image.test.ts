import { describe, expect, test } from 'vitest';
import { coerceContent, createContent, extractText } from './image';

describe('image block module', () => {
  test('createContent + coercion fallback', () => {
    expect(createContent()).toEqual({ blobHash: null, alt: '' });
    expect(coerceContent({ blobHash: 'abc', alt: 'a cat' })).toEqual({ blobHash: 'abc', alt: 'a cat' });
    expect(coerceContent({ markdown: 'wrong kind' })).toEqual({ blobHash: null, alt: '' });
    expect(coerceContent(null)).toEqual({ blobHash: null, alt: '' });
  });

  test('extractText is the alt text', () => {
    expect(extractText({ blobHash: 'abc', alt: '  diagram of the grid engine  ' })).toBe(
      'diagram of the grid engine',
    );
    expect(extractText(createContent())).toBe('');
  });
});
