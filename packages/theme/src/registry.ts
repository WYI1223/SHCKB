/**
 * Theme registry — the ONLY module that imports concrete theme files.
 * Split from themes.ts (MVP-6 M6-D6) so slot components may read
 * tokens via useTheme() at render time without an import cycle:
 *   theme file → context → themes(types + graphPaper) → (nothing)
 * Before this split, themes.ts itself imported the theme files, which
 * closed the cycle and forced closure-over-TOKENS (the Bun TDZ
 * workaround) — making palette variants a no-op on deep-slot themes.
 */
import { graphPaper, ink, type Theme } from './themes';
import { blueprint } from './blueprint';
import { stationery } from './stationery';
import { workbench } from './workbench';

export const THEMES: Record<string, Theme> = { 'graph-paper': graphPaper, ink, workbench, stationery, blueprint };
export const DEFAULT_THEME_ID = 'graph-paper';
