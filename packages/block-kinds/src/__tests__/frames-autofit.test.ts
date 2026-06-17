import { describe, expect, test } from 'vitest';
import { galley, graphPaper, marginalia, stationery, workbench, type Theme } from '@skb/theme';
import { renderStaticPage } from '../static';

const base = {
  id: 'b1',
  kind: 'markdown' as const,
  col: 0,
  row: 0,
  colSpan: 6,
  rowSpan: 2,
  content: { markdown: 'hello' },
};

function docWith(autofit: boolean | undefined) {
  return { title: 't', blocks: [{ ...base, autofit }] };
}

describe('BlockFrameCore autofit overflow (published path)', () => {
  // Published path now routes through BlockFrameCore + resolveSkin.
  // Overflow is set on .skb-content-box (not .skb-block — that class no
  // longer appears in the default-skin output). String assertions on
  // overflow:hidden / overflow:auto remain semantically identical.
  test('autofit block clips (overflow:hidden on .skb-content-box)', () => {
    const html = renderStaticPage(docWith(true), 's', graphPaper);
    expect(html).toContain('class="skb-frame-root"');
    expect(html).toContain('class="skb-content-box"');
    expect(html).not.toContain('class="skb-block"');
    expect(html).toContain('overflow:hidden');
    expect(html).not.toContain('overflow:auto');
  });

  test('non-autofit block scrolls (overflow:auto on .skb-content-box)', () => {
    const html = renderStaticPage(docWith(false), 's', graphPaper);
    expect(html).toContain('class="skb-frame-root"');
    expect(html).toContain('class="skb-content-box"');
    expect(html).not.toContain('class="skb-block"');
    expect(html).toContain('overflow:auto');
  });

  test('absent autofit defaults to scroll (legacy/off)', () => {
    const html = renderStaticPage(docWith(undefined), 's', graphPaper);
    expect(html).toContain('overflow:auto');
  });
});

const SHELL_CASES: Array<{ theme: Theme; shells: Array<string | null> }> = [
  { theme: workbench, shells: [null, 'flat'] },
  { theme: galley, shells: [null, 'keyline', 'cutout'] },
  { theme: marginalia, shells: [null, 'plate', 'aside'] },
  { theme: stationery, shells: [null, 'card', 'bare'] },
];

function docWithShell(autofit: boolean, shell: string | null) {
  return { title: 't', blocks: [{ ...base, autofit, shell }] };
}

describe('curated shell autofit overflow', () => {
  for (const { theme, shells } of SHELL_CASES) {
    for (const shell of shells) {
      test(`${theme.id}/${shell ?? 'default'} clips when autofit`, () => {
        const html = renderStaticPage(docWithShell(true, shell), 's', theme);
        expect(html, `${theme.id}/${shell}`).toContain('overflow:hidden');
      });
      test(`${theme.id}/${shell ?? 'default'} scrolls when not autofit`, () => {
        const html = renderStaticPage(docWithShell(false, shell), 's', theme);
        expect(html, `${theme.id}/${shell}`).toContain('overflow:auto');
      });
    }
  }
});
