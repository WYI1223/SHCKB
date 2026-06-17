import { describe, expect, test } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { galley, graphPaper, marginalia, resolveSkin, skinOptionsFor, stationery, ThemeContext, workbench, type Theme } from '@skb/theme';
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
        follow: false,
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
    // Published path now routes through BlockFrameCore: .skb-frame-root and
    // .skb-content-box replace the legacy .skb-block class on the default skin.
    const html = renderStaticPage(DOC, 's', graphPaper);
    expect(html).toContain('class="skb-canvas"');
    expect(html).toContain('class="skb-frame-root"');
    expect(html).toContain('class="skb-content-box"');
    expect(html).not.toContain('class="skb-block"');
    expect(html).toContain('data-kind="markdown"');
  });

  test('block renders via BlockFrameCore; custom PageTitle still replaces h1', () => {
    // BlockFrame slot removed (ADR-0025 amendment): block appearance is now
    // controlled via defaultSkin/skins on the theme, rendered through BlockFrameCore.
    // PageTitle is still a CanvasSurface-level slot and is honoured.
    const themed: Theme = {
      ...graphPaper,
      id: 'custom',
      PageTitle: ({ title }) => createElement('h2', { className: 'my-title' }, title),
    };
    const html = renderStaticPage(DOC, 's', themed);
    // Block renders via BlockFrameCore (not any legacy BlockFrame slot).
    expect(html).toContain('class="skb-frame-root"');
    expect(html).toContain('class="skb-content-box"');
    // PageTitle slot IS still used.
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
  test("workbench curates 'flat' skin; unknown skin id lands on the framework default card", () => {
    // workbench migrated to the BlockSkin path: assert via renderSkin.
    const flat = renderSkin(workbench, 'markdown', 'flat');
    expect(flat).toContain('class="skb-content-box skb-block"'); // flat box class applied
    // flat has no background/border on the box — framework card chrome is absent
    expect(flat).not.toContain('border:1px solid');

    // workbench has no defaultSkin → framework default (sentinel) → card chrome injected
    const def = renderSkin(workbench, 'markdown', null);
    expect(def).toContain('border:1px solid'); // default card retained

    // graph-paper curates no skins: any skin id is unknown → framework default card
    const unknown = renderSkin(graphPaper, 'markdown', 'flat');
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

  // Token-only themes (graphPaper, ink, blueprint) curate no skins — they
  // resolve to the framework default. Guard the shape.
  test('token-only themes (graphPaper) expose no skins', () => {
    expect(skinOptionsFor(graphPaper, 'markdown')).toEqual([]);
  });

  // Skin contract: every author-pickable skin must change the rendered markup
  // vs the theme's default (or vs the framework card for token-only themes).
  // Declaration carries implementation — a registered skin that renders
  // identically to the default is a bug.
  test('every author-pickable workbench skin changes the rendered markup (vs the framework default card)', () => {
    const def = renderSkin(workbench, 'markdown', null);
    for (const { id } of skinOptionsFor(workbench, 'markdown')) {
      const out = renderSkin(workbench, 'markdown', id);
      expect(out, `workbench/${id} must differ from the framework default card`).not.toBe(def);
    }
    expect(skinOptionsFor(workbench, 'markdown').map((o) => o.id)).toEqual(['flat']);
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

  test('galley skins: strip default + keyline outline + cutout filter on root', () => {
    // Default skin ('strip'): box shadow + border.
    const strip = renderSkin(galley, 'markdown', null);
    expect(strip).toContain('skb-block'); // box className
    expect(strip).toContain('box-shadow:0 1px 2px oklch(40% 0.02 80 / 14%)');
    expect(strip).toContain('border:1px solid oklch(87% 0.015 90)');

    // 'keyline' skin: adds skb-keyline class (outline rule in globalCss).
    const keyline = renderSkin(galley, 'markdown', 'keyline');
    expect(keyline).toContain('skb-keyline'); // class hook for outline globalCss
    expect(keyline).toContain('border:1px solid oklch(20% 0.01 80)'); // textColor border

    // 'cutout' skin: drop-shadow on root, no border/background on box.
    const cutout = renderSkin(galley, 'markdown', 'cutout');
    expect(cutout).toContain('filter:drop-shadow(0 1px 2px oklch(40% 0.02 80 / 18%))');
    expect(cutout).not.toContain('border:1px solid oklch(87%'); // no strip border

    expect(skinOptionsFor(galley, 'markdown').map((o) => o.id)).toEqual(['keyline', 'cutout']);
  });

  test('every author-pickable galley skin changes the rendered markup (vs the default skin)', () => {
    const def = renderSkin(galley, 'markdown', null);
    for (const { id } of skinOptionsFor(galley, 'markdown')) {
      const out = renderSkin(galley, 'markdown', id);
      expect(out, `galley/${id} must differ from the default skin`).not.toBe(def);
    }
  });

  test('marginalia skins: page default (no chrome) + plate (hairline box) + aside (rubric rule)', () => {
    // Default skin ('page'): transparent/no-border passage.
    const page = renderSkin(marginalia, 'markdown', null);
    expect(page).toContain('skb-block');
    expect(page).toContain('font-size:15px');
    expect(page).not.toContain('border:1px solid'); // marginalia default has no border

    // 'plate' skin: hairline border + slightly off-white background.
    const plate = renderSkin(marginalia, 'markdown', 'plate');
    expect(plate).toContain('border:1px solid oklch(88% 0.012 80)');
    expect(plate).toContain('background:oklch(99% 0.004 90)');

    // 'aside' skin: rubric left-border + reduced font size.
    const aside = renderSkin(marginalia, 'markdown', 'aside');
    expect(aside).toContain('border-left:2px solid oklch(50% 0.135 35)');
    expect(aside).toContain('font-size:13px');

    expect(skinOptionsFor(marginalia, 'markdown').map((o) => o.id)).toEqual(['plate', 'aside']);
  });

  test('every author-pickable marginalia skin changes the rendered markup (vs the default skin)', () => {
    const def = renderSkin(marginalia, 'markdown', null);
    for (const { id } of skinOptionsFor(marginalia, 'markdown')) {
      const out = renderSkin(marginalia, 'markdown', id);
      expect(out, `marginalia/${id} must differ from the default skin`).not.toBe(def);
    }
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

  // Stationery's block frame is a BlockSkin rendered through BlockFrameCore
  // (rotate/washi live on the skin's root/front). The published renderer now
  // also routes through BlockFrameCore + resolveSkin (migration complete).
  // Assert the skin output so per-block tilt is what's actually checked,
  // not the static `.skb-curl` rotations in the <style>.
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
