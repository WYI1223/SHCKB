/**
 * MVP-4: the hand-written renderer is gone. Static HTML comes from the
 * same React components the SPA renders (@skb/block-kinds static entry)
 * — the mvp2 dual-renderer drift debt is repaid by construction
 * [ADR-0024].
 */
export { NOT_FOUND_HTML, escapeHtml, renderStaticPage } from '@skb/block-kinds/static';

import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { notepages, type PublishedDoc } from '../db/schema';
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

/**
 * MVP-10: rewrite internal permalinks in published HTML so the public SPA can
 * navigate client-side. `/p/:id(#b)` → `/notes/:slug(#b)` when id∈idToSlug;
 * unresolved ids stay `/p/:id` (the server 302 still resolves them). The
 * data-skb-page/data-skb-block attributes are preserved (only the href
 * changes), so the public click handler can route either form. Pure function:
 * call it on the renderStaticPage output just before storing publishedHtml.
 *
 * The id captured from the href is percent-encoded (RichtextRenderView emits
 * encodeURIComponent ids; markdown passes the author href verbatim) — decode
 * before the map lookup, re-encode the resolved slug for the new href.
 */
export function materializeInternalLinks(html: string, idToSlug: Map<string, string>): string {
  return html.replace(/href="\/p\/([^"#]+)(#[^"]*)?"/g, (m, id: string, frag?: string) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(id);
    } catch {
      return m; // malformed %-encoding: leave the href untouched (302 still resolves)
    }
    const slug = idToSlug.get(decoded);
    if (!slug) return m;
    return `href="/notes/${encodeURIComponent(slug)}${frag ?? ''}"`;
  });
}

/**
 * MVP-10: map every public+published page id → its current slug, the input to
 * materializeInternalLinks. Lives here (not in a route module) so all four
 * publishedHtml write sites — publish, theme-pin, rerenderAllPublished, import
 * — share ONE definition and stay consistent (importer builds its own map from
 * the in-memory bundle, since rows don't exist yet).
 *
 * Predicate mirrors the /notes/:slug + /p/:id serving gate (visibility='public'
 * AND a published snapshot present), so an id is rewritten ONLY when the slug
 * route would actually serve it. Gates on publishedDoc (set atomically with
 * publishedHtml) to avoid loading every page's full HTML blob into memory.
 */
export function publicIdToSlug(db: Db): Map<string, string> {
  const rows = db
    .select({ id: notepages.id, slug: notepages.slug, publishedDoc: notepages.publishedDoc })
    .from(notepages)
    .where(eq(notepages.visibility, 'public'))
    .all();
  const map = new Map<string, string>();
  for (const row of rows) if (row.publishedDoc !== null) map.set(row.id, row.slug);
  return map;
}
