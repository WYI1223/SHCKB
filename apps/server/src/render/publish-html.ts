/**
 * MVP-4: the hand-written renderer is gone. Static HTML comes from the
 * same React components the SPA renders (@skb/block-kinds static entry)
 * — the mvp2 dual-renderer drift debt is repaid by construction
 * [ADR-0024].
 */
export { NOT_FOUND_HTML, escapeHtml, renderStaticPage } from '@skb/block-kinds/static';

import type { PublishedDoc } from '../db/schema';
import type { PublishedDocShape } from '@skb/block-kinds';

/**
 * Coerce the stored/working string autofit ('grow' | 'off' | null) to the
 * boolean render shape expected by PublishedDocShape / BlockFrameProps.
 * Assembly boundary — call this before passing a PublishedDoc to renderStaticPage.
 */
export function toRenderDoc(doc: PublishedDoc): PublishedDocShape {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => ({
      ...b,
      autofit: b.autofit === 'grow',
    })),
  };
}
