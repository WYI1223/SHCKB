import { describe, expect, test } from 'vitest';
import {
  DEFAULT_THEME_ID,
  THEMES,
  blockCardStyle,
  canvasBaseplateStyle,
  graphPaper,
  ink,
  kindHue,
} from '../themes';

describe('theme registry', () => {
  test('default theme is graph-paper and registered', () => {
    expect(DEFAULT_THEME_ID).toBe('graph-paper');
    expect(THEMES['graph-paper']).toBe(graphPaper);
    expect(THEMES['ink']).toBe(ink);
  });

  test('every theme carries the full token surface', () => {
    for (const t of Object.values(THEMES)) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(t.slot).toBeGreaterThan(0);
      expect(t.pad).toBeGreaterThanOrEqual(0);
      for (const key of [
        'canvasBg',
        'dotColor',
        'blockBg',
        'blockBorder',
        'blockRadius',
        'textColor',
        'mutedColor',
        'chromeBg',
        'accent',
        'danger',
        'kindHueFallback',
        'codeCss',
        'surfaceInsetBg',
        'hairline',
        'quoteColor',
        'fontFamily',
      ] as const) {
        expect(t[key], `${t.id}.${key}`).toBeTruthy();
      }
      expect(t.kindHues.markdown).toBeTruthy();
      expect(t.kindHues.image).toBeTruthy();
      expect(t.kindHues.code).toBeTruthy();
    }
  });

  test('themes actually diverge', () => {
    expect(graphPaper.canvasBg).not.toBe(ink.canvasBg);
  });

  test('helpers are theme-parametrized', () => {
    expect(kindHue(graphPaper, 'markdown')).toBe(graphPaper.kindHues.markdown);
    expect(kindHue(graphPaper, 'unknown-kind')).toBe(graphPaper.kindHueFallback);
    expect(blockCardStyle(graphPaper, 'markdown').borderTop).toContain(graphPaper.kindHues.markdown);
    expect(canvasBaseplateStyle(ink).backgroundImage).toContain(ink.dotColor);
  });
});
