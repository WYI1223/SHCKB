/** Position layer (MVP-10 spec §5.5): stash scrollTop per (surface,pageId);
 * restore on (re)entry; save on unmount/leave. In-memory (per session) — a
 * Map keyed `surface pageId`. The hook returns a ref for the scroll box. */
import { useEffect, useRef } from 'react';

const mem = new Map<string, number>();
const k = (surface: string, pageId: string) => `${surface} ${pageId}`;

export const __store = {
  set: (surface: string, pageId: string, top: number) => mem.set(k(surface, pageId), top),
  get: (surface: string, pageId: string) => mem.get(k(surface, pageId)),
};

export function useScrollRestore(pageId: string, surface: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !pageId) return;
    const saved = __store.get(surface, pageId);
    if (saved !== undefined) el.scrollTop = saved;
    const onScroll = () => __store.set(surface, pageId, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      __store.set(surface, pageId, el.scrollTop); // save on leave
      el.removeEventListener('scroll', onScroll);
    };
  }, [pageId, surface]);
  return ref;
}
