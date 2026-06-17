/**
 * First-class link capability (MVP-10, spec §6). A LinkRef is the universal
 * internal-link target — page-level (blockId absent) or block-level. Every
 * block kind extracts its outbound links to LinkRef[] (host-uniform), and the
 * web host's delegated click handler + navigateToPage consume the same shape.
 * `/p/:id(#blockId)` stays the canonical external permalink string; this file
 * is the single parser, so markdown extraction and the handler agree.
 */
export type LinkRef = { pageId: string; blockId?: string };

const PERMALINK = /^\/p\/([^/#?]+)(?:#([^#/?]+))?$/;

/** Parse a `/p/:id` or `/p/:id#:blockId` permalink href → LinkRef, else null.
 * Ids are percent-decoded. Any other href (external, /notes/, fragment) → null.
 * Malformed percent-encoding (e.g. `/p/%GG`) is not a valid permalink → null. */
export function parsePermalink(href: string): LinkRef | null {
  const m = PERMALINK.exec(href);
  if (!m) return null;
  try {
    const pageId = decodeURIComponent(m[1]!);
    const rawBlock = m[2];
    const blockId = rawBlock ? decodeURIComponent(rawBlock) : undefined;
    return blockId ? { pageId, blockId } : { pageId };
  } catch {
    return null;
  }
}

/** Build the canonical permalink string from a LinkRef. */
export function permalinkOf(ref: LinkRef): string {
  const base = `/p/${encodeURIComponent(ref.pageId)}`;
  return ref.blockId ? `${base}#${encodeURIComponent(ref.blockId)}` : base;
}
