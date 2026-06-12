import { describe, expect, test } from 'vitest';
import { createElement } from 'react';
import { graphPaper, stationery, type Theme } from '@skb/theme';
import { renderStaticPage } from '../static';

const DOC = {
  title: 'slots',
  blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'hello' } }],
};

describe('theme render slots', () => {
  test('default rendering exposes class hooks', () => {
    const html = renderStaticPage(DOC, 's', graphPaper);
    expect(html).toContain('class="skb-canvas"');
    expect(html).toContain('skb-block');
    expect(html).toContain('data-kind="markdown"');
  });

  test('custom BlockFrame replaces the shell; custom PageTitle replaces h1', () => {
    const themed: Theme = {
      ...graphPaper,
      id: 'custom',
      BlockFrame: ({ kind, blockId, children }) =>
        createElement('section', { className: 'my-frame', 'data-kind': kind, 'data-bid': blockId }, children),
      PageTitle: ({ title }) => createElement('h2', { className: 'my-title' }, title),
    };
    const html = renderStaticPage(DOC, 's', themed);
    expect(html).toContain('class="my-frame"');
    expect(html).toContain('data-bid="b1"');
    expect(html).toContain('<h2 class="my-title">slots</h2>');
    expect(html).toContain('hello'); // content still renders inside
  });

  test('globalCss lands in the static head', () => {
    const themed: Theme = { ...graphPaper, id: 'css', globalCss: '.skb-block{outline:1px solid red}' };
    const html = renderStaticPage(DOC, 's', themed);
    expect(html).toContain('.skb-block{outline:1px solid red}');
  });
});

describe('author appearance (MVP-6 M6-D3/D4)', () => {
  test("default frame interprets 'flat'; unknown shells land on the default card", () => {
    const flat = renderStaticPage(
      { ...DOC, blocks: [{ ...DOC.blocks[0]!, shell: 'flat' }] },
      's',
      graphPaper,
    );
    expect(flat).toContain('data-shell="flat"');
    expect(flat).not.toContain('border:1px solid'); // card chrome dropped

    const unknown = renderStaticPage(
      { ...DOC, blocks: [{ ...DOC.blocks[0]!, shell: 'no-such-shell' }] },
      's',
      graphPaper,
    );
    expect(unknown).toContain('border:1px solid'); // default card retained
  });

  test('stationery shells: card drops torn edge, bare drops the paper entirely', () => {
    // assert on element markup (class="…"), not bare names — globalCss
    // in <style> contains the same selectors for every render
    const paper = renderStaticPage(DOC, 's', stationery);
    expect(paper).toContain('class="skb-paper-edge"');

    const card = renderStaticPage({ ...DOC, blocks: [{ ...DOC.blocks[0]!, shell: 'card' }] }, 's', stationery);
    expect(card).not.toContain('class="skb-paper-edge"');
    expect(card).toContain('class="skb-washi"'); // tape stays — it's the pinning

    const bare = renderStaticPage({ ...DOC, blocks: [{ ...DOC.blocks[0]!, shell: 'bare' }] }, 's', stationery);
    expect(bare).toContain('skb-bare');
    expect(bare).not.toContain('class="skb-washi"');
  });

  test('every declared shell option actually changes the rendered markup (declaration ↔ implementation)', () => {
    // regression guard: stationery shipped card/bare branches without
    // declaring shellOptions — the inspector showed nothing (owner
    // caught it). A declared option whose render equals the default is
    // the same class of bug from the other side.
    const themes = [graphPaper, stationery];
    for (const t of themes) {
      const def = renderStaticPage(DOC, 's', t);
      for (const o of t.shellOptions ?? []) {
        const out = renderStaticPage({ ...DOC, blocks: [{ ...DOC.blocks[0]!, shell: o.id }] }, 's', t);
        expect(out, `${t.id}/${o.id} must differ from the default shell`).not.toBe(def);
      }
    }
    expect(stationery.shellOptions?.map((o) => o.id)).toEqual(['card', 'bare']);
  });

  test('page background: color replaces canvas, image layers as cover', () => {
    const html = renderStaticPage(
      { ...DOC, background: { color: 'oklch(90% 0.05 200)', blobHash: 'a'.repeat(64) } },
      's',
      graphPaper,
    );
    expect(html).toContain('background:oklch(90% 0.05 200)');
    expect(html).toContain(`/api/public/blobs/${'a'.repeat(64)}`);
    expect(html).toContain('background-size:cover');
  });
});

// ----- stationery deep showcase -----

describe('stationery deep showcase', () => {
  const DOC2 = {
    title: 'paper',
    blocks: [
      { id: 'alpha', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'a' } },
      { id: 'beta', kind: 'image', col: 6, row: 0, colSpan: 6, rowSpan: 2, content: { blobHash: null, alt: 'b' } },
    ],
  };

  test('deterministic: identical bytes across renders; distinct rotations per block', () => {
    const a = renderStaticPage(DOC2, 's', stationery);
    const b = renderStaticPage(DOC2, 's', stationery);
    expect(a).toBe(b);
    const angles = [...a.matchAll(/rotate\((-?[\d.]+)deg\)/g)].map((m) => m[1]);
    expect(new Set(angles).size).toBeGreaterThan(1); // alpha and beta tilt differently
  });

  test('washi tape carries the kind hue; globalCss ships keyframes + reduced-motion guard', () => {
    const html = renderStaticPage(DOC2, 's', stationery);
    expect(html).toContain(stationery.kindHues.markdown!); // tape color present
    expect(html).toContain('@keyframes skb-paper-drop');
    expect(html).toContain('prefers-reduced-motion');
  });
});
