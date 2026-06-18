import { describe, expect, test } from 'bun:test';
import { renderStaticPage } from '../src/static';
import { graphPaper } from '@skb/theme';

const doc = { title: 'Hi', blocks: [] } as any;

describe('renderStaticPage canonical', () => {
  test('canonical href is the id-based /notes/:id', () => {
    const html = renderStaticPage(doc, 'abc123', graphPaper);
    expect(html).toContain('<link rel="canonical" href="/notes/abc123">');
  });
});
