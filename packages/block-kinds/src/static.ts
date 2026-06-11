/**
 * Publish-time static rendering (server-only entry — NOT exported from
 * the package index; the web bundle must never import react-dom/server).
 * publishedHtml = renderStaticPage(publishedDoc, slug, effectiveTheme):
 * a pure function — the theme invariant [ADR-0024].
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, type Theme } from '@skb/theme';
import { PublishedCanvas, type PublishedDocShape } from './PublishedCanvas';

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderStaticPage(doc: PublishedDocShape, slug: string, theme: Theme): string {
  const body = renderToStaticMarkup(
    createElement(ThemeProvider, { theme, children: createElement(PublishedCanvas, { doc }) }),
  );
  const title = escapeHtml(doc.title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="canonical" href="/notes/${escapeHtml(slug)}">
<meta property="og:title" content="${title}">
<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: ${theme.canvasBg}; color: ${theme.textColor}; }
${theme.codeCss}
${theme.globalCss ?? ''}
</style>
</head>
<body>${body}</body>
</html>`;
}

export const NOT_FOUND_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Not found</title></head>
<body style="font-family:system-ui,sans-serif;color:oklch(50% 0.02 80);text-align:center;margin-top:80px">
This page does not exist.
</body></html>`;
