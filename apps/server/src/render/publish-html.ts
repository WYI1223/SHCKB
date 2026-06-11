/**
 * Publish-time static HTML rendering (mvp2 M2-D1 #4).
 *
 * The published snapshot is frozen at publish time, so the reader-grade
 * HTML can be rendered once and stored — fast public reads, SEO, and
 * no-JS readability without any runtime SSR machinery.
 *
 * This is a server-owned minimal renderer, deliberately independent of
 * the SPA's React RenderViews (drift risk recorded in the build log;
 * a shared block-render package is the fix when a third consumer
 * appears). Raw HTML in markdown is dropped (no rehype-raw), matching
 * the SPA's sanitize-by-omission stance.
 */
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type { PublishedDoc } from '../db/schema';

// Mirrors the graph-paper theme's editor geometry (web theme tokens).
const SLOT = 60;
const PAD = 4;
const COLS = 12;

function kindHue(kind: string): string {
  return (
    {
      markdown: 'oklch(60% 0.04 280)',
      image: 'oklch(65% 0.12 240)',
    }[kind] ?? 'oklch(60% 0.05 0)'
  );
}

const markdownPipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype) // raw HTML nodes are dropped by default
  .use(rehypeStringify);

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isMarkdownContent(c: unknown): c is { markdown: string } {
  return typeof c === 'object' && c !== null && typeof (c as { markdown?: unknown }).markdown === 'string';
}

function isImageContent(c: unknown): c is { blobHash: string | null; alt: string } {
  if (typeof c !== 'object' || c === null) return false;
  const i = c as { blobHash?: unknown; alt?: unknown };
  return (i.blobHash === null || typeof i.blobHash === 'string') && typeof i.alt === 'string';
}

function renderBlockBody(kind: string, content: unknown): string {
  if (kind === 'markdown' && isMarkdownContent(content)) {
    return `<div class="md">${String(markdownPipeline.processSync(content.markdown))}</div>`;
  }
  if (kind === 'image' && isImageContent(content)) {
    if (!content.blobHash) return `<div class="fallback">${escapeHtml(content.alt) || 'Image'}</div>`;
    return `<img src="/api/public/blobs/${escapeHtml(content.blobHash)}" alt="${escapeHtml(content.alt)}">`;
  }
  // Unsupported kinds degrade locally (blocks.md contained-failure rule).
  return `<div class="fallback">Unsupported content</div>`;
}

/* Mirrors the web graph-paper theme tokens (apps/web/src/theme/tokens.ts)
 * so read mode matches edit mode minus editing chrome — keep in sync. */
const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: oklch(98% 0.005 80); color: oklch(35% 0.02 80); }
main { max-width: ${COLS * SLOT}px; margin: 0 auto; padding: 40px 20px; }
h1.page-title { font-size: 26px; margin: 0 0 24px; }
.grid {
  position: relative;
  background-image: radial-gradient(circle, oklch(70% 0.01 80) 1px, transparent 1px);
  background-size: ${SLOT}px ${SLOT}px;
  background-position: ${SLOT - 1}px ${SLOT - 1}px;
}
.block {
  position: absolute; overflow: auto;
  background: white;
  border: 1px solid oklch(85% 0.01 80);
  border-top-width: 2px;
  border-radius: 3px;
  padding: 8px 10px;
  font-size: 14px; line-height: 1.55;
}
.block img { width: 100%; height: 100%; object-fit: contain; display: block; }
.fallback { color: oklch(50% 0.02 80); font-style: italic; font-size: 13px; }
.md > :first-child { margin-top: 0; }
.md > :last-child { margin-bottom: 0; }
.md pre { background: oklch(95% 0.01 80); padding: 8px; border-radius: 4px; overflow-x: auto; }
.md code { background: oklch(95% 0.01 80); padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
.md pre code { background: transparent; padding: 0; }
.md table { border-collapse: collapse; }
.md th, .md td { border: 1px solid oklch(85% 0.01 80); padding: 4px 8px; }
.md img { max-width: 100%; }
.md blockquote { margin: 0.5em 0; padding-left: 10px; border-left: 3px solid oklch(85% 0.01 80); color: oklch(50% 0.02 80); }
`;

export function renderPublishedHtml(doc: PublishedDoc, slug: string): string {
  const rows = Math.max(1, ...doc.blocks.map((b) => b.row + b.rowSpan));
  const blocksHtml = doc.blocks
    .map((b) => {
      const style =
        `left:${b.col * SLOT + PAD}px;top:${b.row * SLOT + PAD}px;` +
        `width:${b.colSpan * SLOT - 2 * PAD}px;height:${b.rowSpan * SLOT - 2 * PAD}px;` +
        `border-top-color:${kindHue(b.kind)}`;
      return `<div class="block" style="${style}">${renderBlockBody(b.kind, b.content)}</div>`;
    })
    .join('\n');

  const title = escapeHtml(doc.title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="canonical" href="/notes/${escapeHtml(slug)}">
<meta property="og:title" content="${title}">
<style>${CSS}</style>
</head>
<body>
<main>
<h1 class="page-title">${title}</h1>
<div class="grid" style="width:${COLS * SLOT}px;height:${rows * SLOT}px">
${blocksHtml}
</div>
</main>
</body>
</html>`;
}

export const NOT_FOUND_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Not found</title></head>
<body style="font-family:system-ui,sans-serif;color:oklch(50% 0.02 80);text-align:center;margin-top:80px">
This page does not exist.
</body></html>`;
