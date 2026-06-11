/**
 * MVP-4: the hand-written renderer is gone. Static HTML comes from the
 * same React components the SPA renders (@skb/block-kinds static entry)
 * — the mvp2 dual-renderer drift debt is repaid by construction
 * [ADR-0024].
 */
export { NOT_FOUND_HTML, escapeHtml, renderStaticPage } from '@skb/block-kinds/static';
