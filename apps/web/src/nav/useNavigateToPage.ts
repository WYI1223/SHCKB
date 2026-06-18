/**
 * The MVP-10 navigation primitive (spec §5). Resolves a LinkRef against the
 * CURRENT surface and keeps you in it: Editor→Editor, In-app View→View,
 * Read→Read, Note→Note (client-side, chrome stays mounted).
 * Same-page block target = pure scroll. All surfaces address by id (SSOT).
 */
import type React from 'react';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parsePermalink, type LinkRef } from '@skb/block-kinds';
import { scrollToBlock } from './scrollToBlock';

export type Surface = 'edit' | 'view' | 'read' | 'note' | 'other';

export function surfaceOf(pathname: string): Surface {
  if (pathname.startsWith('/edit/')) return 'edit';
  if (pathname.startsWith('/view/')) return 'view';
  if (pathname.startsWith('/read/')) return 'read';
  if (pathname.startsWith('/notes/')) return 'note';
  return 'other';
}

function currentId(pathname: string): string {
  return decodeURIComponent(pathname.split('/')[2] ?? '');
}

export type NavAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'scroll'; blockId: string };

const ROUTE_OF: Record<Exclude<Surface, 'other'>, string> = {
  edit: '/edit',
  view: '/view',
  read: '/read',
  note: '/notes',
};

/** Pure resolver (unit-tested). All surfaces address by id (SSOT); resolution
 * is "same surface + same id". Same-page block target = pure scroll, no nav.
 * `other` falls back to the in-app draft preview (view). */
export function resolveTarget(pathname: string, ref: LinkRef): NavAction {
  const surface = surfaceOf(pathname);
  if (surface !== 'other' && ref.blockId && ref.pageId === currentId(pathname)) {
    return { kind: 'scroll', blockId: ref.blockId };
  }
  const hash = ref.blockId ? `#${encodeURIComponent(ref.blockId)}` : '';
  const base = surface === 'other' ? '/view' : ROUTE_OF[surface];
  return { kind: 'navigate', to: `${base}/${encodeURIComponent(ref.pageId)}${hash}` };
}

export function useNavigateToPage(): (ref: LinkRef) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (ref: LinkRef) => {
      const action = resolveTarget(pathname, ref);
      if (action.kind === 'scroll') scrollToBlock(action.blockId);
      else navigate(action.to);
    },
    [navigate, pathname],
  );
}

/** A delegated click handler: any click on a rendered internal link
 * (a[data-skb-page], or a[href^="/p/"] fallback) routes through navigateToPage,
 * client-side. New-tab / modified clicks pass through. All-id: there is no
 * materialized-slug form anymore, so no per-surface href rewriting here — the
 * surface is resolved by navigateToPage from the current pathname. */
export function makeLinkClickHandler(nav: (ref: LinkRef) => void) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    const pageId = a.getAttribute('data-skb-page');
    const ref: LinkRef | null = pageId
      ? { pageId, ...(a.getAttribute('data-skb-block') ? { blockId: a.getAttribute('data-skb-block')! } : {}) }
      : parsePermalink(href);
    if (!ref) return;
    e.preventDefault();
    nav(ref);
  };
}
