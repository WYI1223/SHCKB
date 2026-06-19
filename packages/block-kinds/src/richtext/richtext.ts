/**
 * Richtext content model (MVP-9 M9-D1) — the block stores a ProseMirror
 * doc as plain JSON. Everything in THIS file walks the raw JSON with
 * zero prosemirror imports: it is consumed by the publish pipeline
 * (Bun, no DOM) and by RenderView. The PM schema lives in schema.ts and
 * is only ever loaded by the editing surface.
 *
 * Plugin-posture discipline (the stress test): the richtext folder may
 * consume registry + HostServices + ThemeContext + ui-kit — never the
 * host app's chrome.
 */
import type { LinkRef } from '../links';

export type RichtextSpacing = 'compact' | 'normal' | 'relaxed';

export type RichtextContent = {
  /** ProseMirror doc JSON for the schema in schema.ts. */
  doc: PmNode;
  /** Block-level line spacing (M9-D3); absent = normal. */
  spacing?: RichtextSpacing;
};

/** Spacing id → line-height, shared by edit and render surfaces. */
export const SPACING_LINE_HEIGHT: Record<RichtextSpacing, number> = {
  compact: 1.3,
  normal: 1.55,
  relaxed: 1.85,
};

/** Fixed text-color palette (M9-D3) — Notion-style finite choices.
 * Persisted into the doc as plain CSS colors, so they survive theme
 * switches; the render walker re-validates before painting. */
export const COLOR_PALETTE: Array<{ id: string; name: string; css: string }> = [
  { id: 'grey', name: 'Grey', css: 'oklch(55% 0 0)' },
  { id: 'brown', name: 'Brown', css: 'oklch(50% 0.06 60)' },
  { id: 'red', name: 'Red', css: 'oklch(55% 0.18 25)' },
  { id: 'orange', name: 'Orange', css: 'oklch(62% 0.14 60)' },
  { id: 'green', name: 'Green', css: 'oklch(55% 0.12 150)' },
  { id: 'blue', name: 'Blue', css: 'oklch(55% 0.12 250)' },
  { id: 'purple', name: 'Purple', css: 'oklch(55% 0.14 300)' },
  { id: 'pink', name: 'Pink', css: 'oklch(62% 0.14 350)' },
];

/** Raw PM JSON shapes — structural, not imported from prosemirror. */
export type PmNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
  marks?: PmMark[];
};

export type PmMark = { type: string; attrs?: Record<string, unknown> };

export const EMPTY_DOC: PmNode = { type: 'doc', content: [{ type: 'paragraph' }] };

export function createContent(): RichtextContent {
  return { doc: structuredClone(EMPTY_DOC) };
}

/** Defensive read of persisted content — unknown/legacy shapes degrade
 * to an empty doc, never throw (blocks.md fallback discipline). */
export function coerceContent(raw: unknown): RichtextContent {
  if (raw && typeof raw === 'object' && 'doc' in raw) {
    const doc = (raw as { doc: unknown }).doc;
    if (doc && typeof doc === 'object' && (doc as PmNode).type === 'doc') {
      const spacing = (raw as { spacing?: unknown }).spacing;
      return {
        doc: doc as PmNode,
        ...(spacing === 'compact' || spacing === 'normal' || spacing === 'relaxed' ? { spacing } : {}),
      };
    }
  }
  return createContent();
}

/** Plain text for search/export — joins text leaves, newline between
 * top-level blocks (contract: derived from content, not DOM). */
export function extractText(content: RichtextContent): string {
  const blocks = content.doc.content ?? [];
  return blocks.map(textOf).filter((s) => s !== '').join('\n');
}

function textOf(node: PmNode): string {
  if (node.text !== undefined) return node.text;
  if (node.type === 'hard_break') return '\n';
  return (node.content ?? []).map(textOf).join('');
}

/** Outbound internal links (MVP-10) — walks pagelink marks → LinkRef, deduped.
 * Supersedes linkedPageIds ("future backlink feed"): now block-aware. */
export function links(content: RichtextContent): LinkRef[] {
  const out: LinkRef[] = [];
  const seen = new Set<string>();
  const walk = (node: PmNode) => {
    for (const mark of node.marks ?? []) {
      if (mark.type === 'pagelink' && typeof mark.attrs?.pageId === 'string') {
        const pageId = mark.attrs.pageId;
        const blockId = typeof mark.attrs?.blockId === 'string' && mark.attrs.blockId ? mark.attrs.blockId : undefined;
        const key = `${pageId}#${blockId ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(blockId ? { pageId, blockId } : { pageId });
        }
      }
    }
    (node.content ?? []).forEach(walk);
  };
  walk(content.doc);
  return out;
}

/** Page ids referenced by pagelink marks — future backlink feed.
 * @deprecated Use links() which returns LinkRef[] and is block-aware. */
export function linkedPageIds(content: RichtextContent): string[] {
  return [...new Set(links(content).map((l) => l.pageId))];
}
