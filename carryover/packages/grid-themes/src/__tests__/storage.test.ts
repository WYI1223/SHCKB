/**
 * Storage / resolution: per-doc frontmatter > localStorage > default.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  DEFAULT_THEME,
  getUserTheme,
  resolveTheme,
  setUserTheme,
  STORAGE_KEY,
} from '../storage';

describe('resolveTheme precedence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  test('default when nothing set', () => {
    expect(resolveTheme({})).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe('lego-studs');
  });

  test('localStorage wins over default', () => {
    setUserTheme('graph-paper');
    expect(resolveTheme({})).toBe('graph-paper');
  });

  test('frontmatter wins over localStorage', () => {
    setUserTheme('graph-paper');
    expect(resolveTheme({ frontmatterTheme: 'bento-canvas' })).toBe(
      'bento-canvas',
    );
  });

  test('invalid frontmatter falls through to next layer', () => {
    setUserTheme('graph-paper');
    expect(resolveTheme({ frontmatterTheme: 'typo-theme' })).toBe(
      'graph-paper',
    );
  });

  test('invalid localStorage falls through to default', () => {
    window.localStorage.setItem(STORAGE_KEY, 'garbage');
    expect(resolveTheme({})).toBe(DEFAULT_THEME);
  });

  test('explicit userTheme arg overrides localStorage read', () => {
    setUserTheme('graph-paper');
    expect(resolveTheme({ userTheme: 'bento-canvas' })).toBe('bento-canvas');
  });
});

describe('getUserTheme / setUserTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('round-trip', () => {
    expect(getUserTheme()).toBeUndefined();
    setUserTheme('graph-paper');
    expect(getUserTheme()).toBe('graph-paper');
  });

  test('returns undefined for invalid stored value', () => {
    window.localStorage.setItem(STORAGE_KEY, 'garbage');
    expect(getUserTheme()).toBeUndefined();
  });
});
