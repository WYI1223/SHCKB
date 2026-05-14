/**
 * @skb/grid-themes — built-in themes registry registration.
 *
 * Module-load side effect: registers all 3 built-in themes via
 * `registerTheme`. Importing `@skb/grid-themes` (which re-exports from
 * `index.ts`) is sufficient — no need to call `registerTheme` from
 * consumer code.
 */
import { registerTheme } from '../registry';
import { bentoCanvasTheme } from './bento-canvas';
import { graphPaperTheme } from './graph-paper';
import { legoStudsTheme } from './lego-studs';

registerTheme(graphPaperTheme);
registerTheme(legoStudsTheme);
registerTheme(bentoCanvasTheme);

export { graphPaperTheme, legoStudsTheme, bentoCanvasTheme };
