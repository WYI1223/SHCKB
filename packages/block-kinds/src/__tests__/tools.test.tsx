import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { codeModule } from '../code';
import { imageModule } from '../image';
import { markdownModule } from '../markdown';

function render(node: React.ReactElement) {
  return renderToStaticMarkup(<ThemeProvider theme={graphPaper}>{node}</ThemeProvider>);
}

describe('tool-panel contributions (M5-D4)', () => {
  test('code contributes a language tool; markdown contributes none', () => {
    expect(codeModule.tools?.map((t) => t.id)).toEqual(['language']);
    expect(imageModule.tools?.map((t) => t.id)).toEqual(['alt']);
    expect(markdownModule.tools).toBeUndefined();
  });

  test('language tool renders the current language as a themed select', () => {
    const Tool = codeModule.tools![0]!.View;
    let next: unknown;
    const html = render(
      <Tool content={{ language: 'typescript', source: 'x' }} onChange={(n) => (next = n)} />,
    );
    expect(html).toContain('skb-ui-select');
    expect(html).toContain('typescript');
    expect(next).toBeUndefined(); // rendering alone must not emit changes
  });

  test('alt tool renders current alt and preserves other fields shape', () => {
    const Tool = imageModule.tools![0]!.View;
    const html = render(<Tool content={{ blobHash: 'abc', alt: 'a cat' }} onChange={() => undefined} />);
    expect(html).toContain('value="a cat"');
  });

  test('RenderViews stay tool-free (no author-only controls leak)', () => {
    const code = render(<codeModule.RenderView content={{ language: 'plaintext', source: 'hi' }} />);
    expect(code).not.toContain('<select');
    const image = render(<imageModule.RenderView content={{ blobHash: null, alt: '' }} />);
    expect(image).not.toContain('<input');
  });

  test('EditViews no longer embed the migrated controls', () => {
    const code = render(
      <codeModule.EditView content={{ language: 'plaintext', source: '' }} onChange={() => undefined} />,
    );
    expect(code).not.toContain('<select'); // language now lives in the tool panel
  });
});
