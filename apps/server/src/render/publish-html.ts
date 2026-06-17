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
 * Coerce the stored/working autofit mode ('follow' | 'fix') to the boolean
 * `follow` render shape expected by PublishedDocShape / BlockFrameProps.
 * Assembly boundary — call this before passing a PublishedDoc to renderStaticPage.
 *
 * Legacy-aware: the DB may not be migrated yet, so the old enum values
 * ('grow' / 'grow+shrink') still resolve to follow. Mirrors
 * apps/web/src/pages/ReadPage.tsx so the SPA and static published
 * surfaces stay in lockstep (follow → clip, anything else → scroll).
 */
export function toRenderDoc(doc: PublishedDoc): PublishedDocShape {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => ({
      ...b,
      follow: b.autofit === 'follow' || b.autofit === 'grow' || b.autofit === 'grow+shrink',
    })),
  };
}
