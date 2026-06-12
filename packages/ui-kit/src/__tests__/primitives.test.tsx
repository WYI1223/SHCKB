import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, graphPaper, ink } from '@skb/theme';
import { UiButton, UiSelect, UiTextInput, UiToggle } from '../primitives';

function render(node: React.ReactElement, theme = graphPaper) {
  return renderToStaticMarkup(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

const noop = () => undefined;

describe('ui-kit primitives', () => {
  test('UiSelect renders options and theme tokens', () => {
    const html = render(
      <UiSelect value="b" onChange={noop} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />,
    );
    expect(html).toContain('skb-ui-select');
    expect(html).toContain('>A</option>');
    expect(html).toContain(`border:1px solid ${graphPaper.hairline}`);
    expect(html).toContain('selected');
  });

  test('UiButton variants tint from theme tokens', () => {
    expect(render(<UiButton onClick={noop}>go</UiButton>)).toContain(graphPaper.hairline);
    expect(render(<UiButton onClick={noop} variant="accent">go</UiButton>)).toContain(graphPaper.accent);
    expect(render(<UiButton onClick={noop} variant="danger">x</UiButton>)).toContain(graphPaper.danger);
  });

  test('UiTextInput carries value and mono opt', () => {
    const html = render(<UiTextInput value="alt text" onChange={noop} mono />);
    expect(html).toContain('value="alt text"');
    expect(html).toContain('ui-monospace');
  });

  test('UiToggle renders label and accent checkbox', () => {
    const html = render(<UiToggle checked onChange={noop} label="Gravity" />);
    expect(html).toContain('Gravity');
    expect(html).toContain('checked');
    expect(html).toContain(graphPaper.accent);
  });

  test('primitives restyle under a different theme', () => {
    const a = render(<UiButton onClick={noop} variant="accent">t</UiButton>, graphPaper);
    const b = render(<UiButton onClick={noop} variant="accent">t</UiButton>, ink);
    expect(a).not.toBe(b);
    expect(b).toContain(ink.accent);
  });
});
