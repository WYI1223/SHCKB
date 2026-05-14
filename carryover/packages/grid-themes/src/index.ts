/**
 * @skb/grid-themes — public surface.
 *
 * Per ADR-0020 D7-D9. Importing this barrel registers the 3 built-in
 * themes (`graph-paper`, `lego-studs`, `bento-canvas`) automatically
 * via `./built-in/index.ts` module-load side effect.
 */
export type {
  GridTheme,
  ThemeKey,
  ResizeAxis,
  BaseplateProps,
  BlockRenderProps,
  DropPreviewProps,
  ResizeHandleProps,
} from './types';

export {
  registerTheme,
  getTheme,
  tryGetTheme,
  listThemes,
  listThemeKeys,
  _resetRegistry,
} from './registry';

export {
  resolveTheme,
  resolveAndGetTheme,
  getUserTheme,
  setUserTheme,
  STORAGE_KEY,
  DEFAULT_THEME,
} from './storage';

export { ThemeSwitcher } from './ThemeSwitcher';
export type { ThemeSwitcherProps } from './ThemeSwitcher';

// Side effect: register 3 built-in themes at module load.
export { graphPaperTheme, legoStudsTheme, bentoCanvasTheme } from './built-in';
