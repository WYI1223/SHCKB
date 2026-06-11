/**
 * Markdown block-owned logic, kept behind module boundaries per
 * block-markdown.md: canonical content is the markdown string; package
 * choices (unified/remark) are spike-level and replaceable without
 * touching the contract.
 *
 * Sanitization note (build-log decision): raw HTML inside markdown is
 * NOT rendered in MVP — react-markdown skips raw HTML by default, and
 * extraction works on the mdast tree. If raw HTML rendering is ever
 * enabled, a rehype sanitizer must enter the render pipeline here.
 */
import { toString as mdastToString } from 'mdast-util-to-string';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export type MarkdownContent = {
  markdown: string;
};

export function createContent(): MarkdownContent {
  return { markdown: '' };
}

export function isMarkdownContent(c: unknown): c is MarkdownContent {
  return typeof c === 'object' && c !== null && typeof (c as MarkdownContent).markdown === 'string';
}

/** Coerce unknown stored content into a safe shape (unsupported-content fallback). */
export function coerceContent(c: unknown): MarkdownContent {
  return isMarkdownContent(c) ? c : { markdown: '' };
}

const parser = unified().use(remarkParse);

/** Plain text from the parsed mdast tree — never from rendered DOM. */
export function extractText(content: MarkdownContent): string {
  // includeHtml: false — raw HTML is not rendered (see note above), so
  // it must not leak into extraction either.
  return mdastToString(parser.parse(content.markdown), { includeHtml: false }).trim();
}
