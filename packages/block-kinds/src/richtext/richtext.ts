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

export type RichtextContent = {
  /** ProseMirror doc JSON for the schema in schema.ts. */
  doc: PmNode;
};

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
      return { doc: doc as PmNode };
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

/** Page ids referenced by pagelink marks — future backlink feed. */
export function linkedPageIds(content: RichtextContent): string[] {
  const ids = new Set<string>();
  const walk = (node: PmNode) => {
    for (const mark of node.marks ?? []) {
      if (mark.type === 'pagelink' && typeof mark.attrs?.pageId === 'string') {
        ids.add(mark.attrs.pageId);
      }
    }
    (node.content ?? []).forEach(walk);
  };
  walk(content.doc);
  return [...ids];
}
