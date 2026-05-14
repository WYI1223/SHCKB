/**
 * Registry contract: register / get / list semantics.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { _resetRegistry, getTheme, listThemeKeys, listThemes, registerTheme, tryGetTheme } from '../registry';
import type { GridTheme, ThemeKey } from '../types';

const stubTheme = (key: ThemeKey, displayName: string): GridTheme => ({
  key,
  displayName,
  slotSize: 80,
  cssVars: {},
  renderBaseplate: () => null,
  renderBlock: () => null,
  renderDropPreview: () => null,
});

describe('registry', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  test('register + get round-trip', () => {
    registerTheme(stubTheme('lego-studs', 'LEGO studs'));
    const t = getTheme('lego-studs');
    expect(t.displayName).toBe('LEGO studs');
  });

  test('tryGetTheme returns undefined for unregistered', () => {
    expect(tryGetTheme('lego-studs')).toBeUndefined();
  });

  test('getTheme throws for unregistered with helpful message', () => {
    expect(() => getTheme('lego-studs')).toThrow(/unknown theme key/);
  });

  test('listThemes returns insertion order', () => {
    registerTheme(stubTheme('graph-paper', 'A'));
    registerTheme(stubTheme('lego-studs', 'B'));
    registerTheme(stubTheme('bento-canvas', 'C'));
    const keys = listThemeKeys();
    expect(keys).toEqual(['graph-paper', 'lego-studs', 'bento-canvas']);
    expect(listThemes()).toHaveLength(3);
  });

  test('re-registering same key overwrites', () => {
    registerTheme(stubTheme('lego-studs', 'first'));
    registerTheme(stubTheme('lego-studs', 'second'));
    expect(getTheme('lego-studs').displayName).toBe('second');
    expect(listThemes()).toHaveLength(1);
  });
});

describe('built-in themes self-register on import', () => {
  beforeEach(() => {
    _resetRegistry();
    // Force re-import to trigger module-load side effect.
    // (vitest module cache makes this tricky; we re-require manually.)
  });

  test('importing the barrel registers all 3 built-ins', async () => {
    // Reset first, then dynamic import to trigger the side effect.
    _resetRegistry();
    const mod = await import('../built-in/index');
    expect(mod.graphPaperTheme.key).toBe('graph-paper');
    expect(mod.legoStudsTheme.key).toBe('lego-studs');
    expect(mod.bentoCanvasTheme.key).toBe('bento-canvas');
    // All 3 should be in registry now.
    expect(listThemeKeys()).toEqual(
      expect.arrayContaining(['graph-paper', 'lego-studs', 'bento-canvas']),
    );
  });
});
