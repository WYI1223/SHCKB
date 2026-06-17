/** Scroll a block into view + a brief highlight (MVP-10 spec §5.3). Block
 * tiles already carry data-block-id (GridCanvas/PublishedCanvas). No-op if the
 * block isn't on the current page (e.g. not in the published snapshot). */
let flashStyleInjected = false;
function ensureFlashStyle() {
  if (flashStyleInjected || typeof document === 'undefined') return;
  flashStyleInjected = true;
  const s = document.createElement('style');
  s.textContent =
    '@keyframes skb-block-flash{0%{box-shadow:0 0 0 3px var(--skb-accent,#3b82f6)}100%{box-shadow:0 0 0 3px transparent}}' +
    '.skb-block-flash{animation:skb-block-flash 1.1s ease-out 1}' +
    '@media (prefers-reduced-motion: reduce){.skb-block-flash{animation:none}}';
  document.head.appendChild(s);
}

export function scrollToBlock(blockId: string): void {
  if (typeof document === 'undefined') return;
  const el = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null;
  if (!el) return;
  ensureFlashStyle();
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('skb-block-flash');
  void el.offsetWidth; // restart the animation
  el.classList.add('skb-block-flash');
  window.setTimeout(() => el.classList.remove('skb-block-flash'), 1300);
}
