/**
 * code kind content — kind-owned, opaque to the platform [CONTRACT.md].
 * No runner fields: executable code is a future family; the export
 * format-migration pipeline exists precisely for adding fields later.
 */
export type CodeContent = { language: string; source: string };

export const CODE_LANGUAGES = [
  'plaintext',
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'json',
  'bash',
  'html',
  'css',
  'sql',
  'c',
  'cpp',
  'java',
  'markdown',
] as const;

export function createContent(): CodeContent {
  return { language: 'plaintext', source: '' };
}

export function isCodeContent(c: unknown): c is CodeContent {
  if (typeof c !== 'object' || c === null) return false;
  const v = c as CodeContent;
  return typeof v.language === 'string' && typeof v.source === 'string';
}

export function coerceContent(c: unknown): CodeContent {
  return isCodeContent(c) ? c : createContent();
}

/** Search/export surface: the source itself. */
export function extractText(content: CodeContent): string {
  return content.source;
}
