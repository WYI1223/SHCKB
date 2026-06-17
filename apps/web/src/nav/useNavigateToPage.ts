/**
 * The MVP-10 navigation primitive (spec §5). Resolves a LinkRef against the
 * CURRENT surface and keeps you in it: Editor→Editor, In-app View→View
 * (client-side, chrome stays mounted). Same-page block target = pure scroll.
 * Public surface has no client id→slug map, so it falls back to the /p/:id
 * permalink (server 302) — acceptable for the anonymous read surface.
 */
import type React from 'react';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parsePermalink, permalinkOf, type LinkRef } from '@skb/block-kinds';
import { scrollToBlock } from './scrollToBlock';

export type Surface = 'editor' | 'view' | 'public' | 'other';

export function surfaceOf(pathname: string): Surface {
  if (pathname.startsWith('/edit/')) return 'editor';
  if (pathname.startsWith('/view/')) return 'view';
  if (pathname.startsWith('/notes/')) return 'public';
  return 'other';
}

function currentId(pathname: string): string {
  return decodeURIComponent(pathname.split('/')[2] ?? '');
}

export type NavAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'scroll'; blockId: string }
  | { kind: 'permalink'; to: string };

/** Pure resolver (unit-tested). The hook below performs the side effect. */
export function resolveTarget(pathname: string, ref: LinkRef): NavAction {
  const surface = surfaceOf(pathname);
  const appById = surface === 'editor' || surface === 'view';
  if (appById && ref.blockId && ref.pageId === currentId(pathname)) {
    return { kind: 'scroll', blockId: ref.blockId };
  }
  const hash = ref.blockId ? `#${encodeURIComponent(ref.blockId)}` : '';
  if (surface === 'editor') return { kind: 'navigate', to: `/edit/${encodeURIComponent(ref.pageId)}${hash}` };
  if (surface === 'view') return { kind: 'navigate', to: `/view/${encodeURIComponent(ref.pageId)}${hash}` };
  if (surface === 'public') return { kind: 'permalink', to: permalinkOf(ref) };
  // default app surface = the in-app draft preview
  return { kind: 'navigate', to: `/view/${encodeURIComponent(ref.pageId)}${hash}` };
}

export function useNavigateToPage(): (ref: LinkRef) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (ref: LinkRef) => {
      const action = resolveTarget(pathname, ref);
      if (action.kind === 'scroll') scrollToBlock(action.blockId);
      else if (action.kind === 'navigate') navigate(action.to);
      else window.location.assign(action.to); // permalink (public) → server 302
    },
    [navigate, pathname],
  );
}

/** A delegated click handler: any click on a rendered internal link
 * (a[data-skb-page], or a[href^="/p/"] fallback) routes through navigateToPage,
 * client-side. New-tab / modified clicks pass through.
 *
 * MVP-10 Task 11: the Public surface passes an optional `toPath` so links whose
 * href was MATERIALIZED to /notes/:slug (publish-time rewrite) client-navigate
 * via the router instead of falling back to the /p/:id permalink (full reload).
 * The fragment rides along in the href, so block targeting still works. Editor /
 * In-app View call sites omit `toPath` and keep their exact behavior. */
export function makeLinkClickHandler(nav: (ref: LinkRef) => void, toPath?: (path: string) => void) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    // materialized internal link on the public surface: navigate the SPA route
    // directly (must precede the data-skb-page branch, which would otherwise
    // fall back to the /p/:id permalink = full reload on the public surface).
    if (toPath && href.startsWith('/notes/')) {
      e.preventDefault();
      toPath(href);
      return;
    }
    const pageId = a.getAttribute('data-skb-page');
    const ref: LinkRef | null = pageId
      ? { pageId, ...(a.getAttribute('data-skb-block') ? { blockId: a.getAttribute('data-skb-block')! } : {}) }
      : parsePermalink(href);
    if (!ref) return;
    e.preventDefault();
    nav(ref);
  };
}
