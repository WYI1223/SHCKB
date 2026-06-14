import { describe, expect, test } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { graphPaper, resolveSkin, skinOptionsFor, stationery, ThemeContext, workbench, type Theme } from '@skb/theme';
import { renderStaticPage } from '../static';
import { BlockFrameCore } from '../BlockFrameCore';

/** Render a block's frame the way BlockFrameCore does — the NEW block-frame
 * path (the published renderer's migration to BlockFrameCore is a later task;
 * assert the skin contract directly so this test tracks the new architecture,
 * not the legacy BlockFrame slot). Uses ThemeContext.Provider (not
 * ThemeProvider) so globalCss is NOT injected — the output is pure block
 * markup, so class/transform assertions don't match the <style> text. */
function renderSkin(theme: Theme, kind: string, skinId: string | null, blockId = 'b1'): string {
  const skin = resolveSkin(theme, kind, skinId);
  return renderToStaticMarkup(
    createElement(
      ThemeContext.Provider,
      { value: theme },
      createElement(BlockFrameCore, {
        kind,
        blockId,
        colSpan: 6,
        rowSpan: 2,
        autofit: false,
        skin,
        children: createElement('p', null, 'hello'),
      }),
    ),
  );
}

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
  test("workbench curates 'flat'; unknown shells land on the default card", () => {
    const flat = renderStaticPage(
      { ...DOC, blocks: [{ ...DOC.blocks[0]!, shell: 'flat' }] },
      's',
      workbench,
    );
    expect(flat).toContain('data-shell="flat"');
    expect(flat).not.toContain('border:1px solid'); // card chrome dropped

    // graph-paper curates no shells: any shell id lands on the default
    const unknown = renderStaticPage(
      { ...DOC, blocks: [{ ...DOC.blocks[0]!, shell: 'flat' }] },
      's',
      graphPaper,
    );
    expect(unknown).toContain('border:1px solid'); // default card retained
  });

  test('stationery skins: card drops torn edge, bare drops the paper entirely', () => {
    // Assert the NEW block-frame contract (BlockSkin via BlockFrameCore),
    // not the legacy published-renderer slot. Class hooks (skb-paper-edge /
    // skb-washi / skb-bare) are the stable surface the globalCss styles.
    const paper = renderSkin(stationery, 'markdown', null); // default = paper slip
    expect(paper).toContain('class="skb-paper-edge"'); // torn silhouette behind
    expect(paper).toContain('class="skb-washi"'); // tape pinned in front

    const card = renderSkin(stationery, 'markdown', 'card');
    expect(card).not.toContain('class="skb-paper-edge"'); // card has no tear
    expect(card).toContain('class="skb-washi"'); // tape stays — it's the pinning

    const bare = renderSkin(stationery, 'markdown', 'bare');
    expect(bare).toContain('skb-bare');
    expect(bare).not.toContain('class="skb-washi"'); // bare = content on the desk
    expect(bare).not.toContain('class="skb-paper-edge"');
  });

  // Legacy shells path (workbench/graph-paper not yet migrated to skins —
  // that is a later task in the unified-block-capability slice). Guards the
  // remaining failure mode: a shell Frame that renders identically to the
  // default. Stationery moved to the skins path (next test).
  test('every declared shell changes the rendered markup (declaration carries implementation)', () => {
    for (const t of [graphPaper, workbench]) {
      const def = renderStaticPage(DOC, 's', t);
      for (const id of Object.keys(t.shells ?? {})) {
        const out = renderStaticPage({ ...DOC, blocks: [{ ...DOC.blocks[0]!, shell: id }] }, 's', t);
        expect(out, `${t.id}/${id} must differ from the default shell`).not.toBe(def);
      }
    }
    expect(Object.keys(workbench.shells ?? {})).toEqual(['flat']);
  });

  test('every author-pickable stationery skin changes the rendered markup (vs the default skin)', () => {
    // BlockSkin replaces the shells map for stationery; same failure mode —
    // an author skin that renders identically to the theme default skin.
    const def = renderSkin(stationery, 'markdown', null);
    for (const { id } of skinOptionsFor(stationery, 'markdown')) {
      const out = renderSkin(stationery, 'markdown', id);
      expect(out, `stationery/${id} must differ from the default skin`).not.toBe(def);
    }
    expect(skinOptionsFor(stationery, 'markdown').map((o) => o.id)).toEqual(['card', 'bare']);
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

  // Stationery's block frame is now a BlockSkin rendered through
  // BlockFrameCore (rotate/washi live on the skin's root/front, not on the
  // legacy DefaultBlockFrame the published renderer still uses until its
  // own migration task). Assert the skin output so per-block tilt is what's
  // actually checked, not the static `.skb-curl` rotations in the <style>.
  test('deterministic: identical bytes across renders; distinct rotations per block', () => {
    const alphaA = renderSkin(stationery, 'markdown', null, 'alpha');
    const alphaB = renderSkin(stationery, 'markdown', null, 'alpha');
    expect(alphaA).toBe(alphaB); // deterministic (publishedHtml purity)
    const beta = renderSkin(stationery, 'image', null, 'beta');
    const tilt = (s: string) => s.match(/rotate\((-?[\d.]+)deg\)/)?.[1];
    // pure block markup (no globalCss <style>), so the first rotate is the
    // per-block root tilt — alpha and beta must differ.
    expect(tilt(alphaA)).toBeTruthy();
    expect(tilt(alphaA)).not.toBe(tilt(beta));
  });

  test('washi tape carries the kind hue on the skin; globalCss ships keyframes + reduced-motion guard', () => {
    const alpha = renderSkin(stationery, 'markdown', null, 'alpha');
    expect(alpha).toContain('class="skb-washi"');
    expect(alpha).toContain(stationery.kindHues.markdown!); // tape color present
    const page = renderStaticPage(DOC2, 's', stationery);
    expect(page).toContain('@keyframes skb-paper-drop'); // globalCss in <style>
    expect(page).toContain('prefers-reduced-motion');
  });
});
