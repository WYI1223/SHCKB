import { describe, expect, test } from 'vitest';
import { graphPaper } from '@skb/theme';
import { codeModule } from '../code';
import { BLOCK_KINDS } from '../registry';
import { renderStaticPage } from '../static';

describe('code kind', () => {
  test('registered with sane defaults', () => {
    expect(BLOCK_KINDS.code).toBeDefined();
    const c = codeModule.createContent();
    expect(c).toEqual({ language: 'plaintext', source: '' });
  });

  test('extractText returns the source verbatim', () => {
    expect(codeModule.extractText({ language: 'ts', source: 'const a = 1;' })).toBe('const a = 1;');
  });

  test('static render highlights known language, survives unknown language', () => {
    const doc = {
      title: 'c',
      blocks: [
        { id: 'a', kind: 'code', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { language: 'typescript', source: 'const x: number = 1;' } },
        { id: 'b', kind: 'code', col: 6, row: 0, colSpan: 6, rowSpan: 2, content: { language: 'no-such-lang', source: '<unsafe> & sound' } },
      ],
    };
    const html = renderStaticPage(doc, 's', graphPaper);
    expect(html).toContain('hljs-keyword'); // typescript highlighted
    expect(html).toContain('&lt;unsafe&gt; &amp; sound'); // fallback escaped, never raw
  });
});
