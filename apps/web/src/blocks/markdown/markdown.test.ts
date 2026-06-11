import { describe, expect, test } from 'vitest';
import { coerceContent, createContent, extractText } from './markdown';

describe('markdown block module', () => {
  test('extractText strips formatting, keeps text', () => {
    const text = extractText({
      markdown: '# Title\n\nSome **bold** and [a link](https://x.test).\n\n- item one\n- item two',
    });
    expect(text).toContain('Title');
    expect(text).toContain('Some bold and a link');
    expect(text).toContain('item one');
    expect(text).not.toContain('#');
    expect(text).not.toContain('**');
    expect(text).not.toContain('https://x.test');
  });

  test('extractText strips raw html markup, keeps inner text', () => {
    const text = extractText({ markdown: 'before <script>alert(1)</script> after' });
    expect(text).toContain('before');
    expect(text).toContain('after');
    // html TAG nodes are excluded from extraction; the inner text node
    // remains (it is plain text content, not executable markup)
    expect(text).not.toContain('<script>');
    expect(text).not.toContain('</script>');
  });

  test('createContent + coerceContent fallback', () => {
    expect(createContent()).toEqual({ markdown: '' });
    expect(coerceContent({ markdown: 'keep' })).toEqual({ markdown: 'keep' });
    expect(coerceContent('garbage')).toEqual({ markdown: '' });
    expect(coerceContent(null)).toEqual({ markdown: '' });
  });
});
