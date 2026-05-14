/**
 * @skb/grid-themes — Theme registry (v1 closed, API extensible).
 *
 * Per ADR-0020 D7. 3 built-in themes self-register at module load
 * (via `./built-in/index.ts`). User code does NOT need to call
 * `registerTheme`. The API shape is preserved for future v2 opening
 * (ThemeKey → `string`, third-party theme packages, etc.).
 */
import type { GridTheme, ThemeKey } from './types';

const themes = new Map<ThemeKey, GridTheme>();

export function registerTheme(theme: GridTheme): void {
  themes.set(theme.key, theme);
}

export function getTheme(key: ThemeKey): GridTheme {
  const t = themes.get(key);
  if (!t) {
    throw new Error(
      `[grid-themes] unknown theme key: "${key}". Available: ${listThemeKeys().join(', ')}`,
    );
  }
  return t;
}

export function tryGetTheme(key: ThemeKey): GridTheme | undefined {
  return themes.get(key);
}

export function listThemes(): GridTheme[] {
  return Array.from(themes.values());
}

export function listThemeKeys(): ThemeKey[] {
  return Array.from(themes.keys());
}

/** Test-only: clear the registry. Production code should not call this. */
export function _resetRegistry(): void {
  themes.clear();
}
