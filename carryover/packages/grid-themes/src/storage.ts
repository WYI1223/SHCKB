/**
 * @skb/grid-themes — Theme resolution + storage.
 *
 * Per ADR-0020 D8:
 *   per-doc MDX frontmatter `theme:` (highest priority)
 *   > per-user localStorage `'skb.grid.theme'`
 *   > default 'lego-studs'
 *
 * Storage layer is SSR-safe: `resolveTheme` works in Node + browser;
 * `setUserTheme` / `getUserTheme` no-op outside browser.
 */
import { tryGetTheme } from './registry';
import type { ThemeKey } from './types';

export const STORAGE_KEY = 'skb.grid.theme';
export const DEFAULT_THEME: ThemeKey = 'lego-studs';

const VALID_KEYS: readonly ThemeKey[] = ['graph-paper', 'lego-studs', 'bento-canvas'];

function isValidThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (VALID_KEYS as readonly string[]).includes(value);
}

/**
 * Resolve which theme to use for a given doc, applying the precedence
 * rule. Returns a key that is GUARANTEED to be a valid ThemeKey, even
 * if the user has corrupted localStorage or frontmatter has a typo —
 * unknown values fall through to the next layer.
 */
export function resolveTheme(options: {
  /** From the doc's MDX frontmatter, e.g. `theme: 'bento-canvas'`. */
  frontmatterTheme?: string | undefined;
  /** Pass an explicit localStorage value when running in non-browser
   * contexts (SSR, tests). Optional — defaults to reading from `window`
   * if available. */
  userTheme?: string | undefined;
}): ThemeKey {
  if (isValidThemeKey(options.frontmatterTheme)) return options.frontmatterTheme;
  const user = options.userTheme ?? getUserTheme();
  if (isValidThemeKey(user)) return user;
  return DEFAULT_THEME;
}

/** Read user theme from localStorage. SSR-safe (returns undefined). */
export function getUserTheme(): ThemeKey | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isValidThemeKey(raw) ? raw : undefined;
  } catch {
    // Privacy mode / SecurityError / quota — silently fall back.
    return undefined;
  }
}

/** Persist user theme to localStorage. SSR-safe (no-op). */
export function setUserTheme(key: ThemeKey): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * Convenience: resolve + return the GridTheme object. Throws if the
 * resolved key isn't registered (which should never happen for the 3
 * built-ins, but might for typo'd custom keys in a future v2).
 */
export function resolveAndGetTheme(options: {
  frontmatterTheme?: string | undefined;
  userTheme?: string | undefined;
}): import('./types').GridTheme {
  const key = resolveTheme(options);
  const theme = tryGetTheme(key);
  if (!theme) {
    throw new Error(
      `[grid-themes] resolved key "${key}" but theme not registered. Did module load complete?`,
    );
  }
  return theme;
}
