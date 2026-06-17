// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider, THEMES, resolveSkin, skinOptionsFor } from '@skb/theme';
import { BlockFrameCore } from '../BlockFrameCore';

afterEach(cleanup);

const KINDS = ['markdown', 'richtext', 'image', 'code'];

// Every theme × every kind × (default skin + each author-pickable skin): the
// host content box must stay the overflow owner in normal flow. happy-dom has
// no layout, so we assert the STRUCTURE the invariant depends on: the content
// box carries the host inline invariants and the rendered content is inside it
// (not a detached/sibling absolutely-positioned layer — the stationery bug).
describe('frame invariant: content box stays host-owned for every theme/kind/skin', () => {
  for (const [themeId, theme] of Object.entries(THEMES)) {
    for (const kind of KINDS) {
      const skinIds = [null, ...skinOptionsFor(theme, kind).map((o) => o.id)];
      for (const skinId of skinIds) {
        test(`${themeId} · ${kind} · ${skinId ?? 'default'}`, () => {
          const skin = resolveSkin(theme, kind, skinId);
          const { container } = render(
            <ThemeProvider theme={theme}>
              <BlockFrameCore kind={kind} blockId="b" colSpan={6} rowSpan={2} follow skin={skin}>
                <p>content</p>
              </BlockFrameCore>
            </ThemeProvider>,
          );
          const box = container.querySelector('.skb-content-box') as HTMLElement;
          expect(box).toBeTruthy();
          expect(box.style.position).toBe('relative');
          expect(box.style.overflow).toBe('hidden'); // follow
          expect(box.style.height).toBe('100%');
          expect(box.textContent).toContain('content');
        });
      }
    }
  }
});
