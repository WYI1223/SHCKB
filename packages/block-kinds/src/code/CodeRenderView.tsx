/**
 * Reader/preview rendering: syntax-highlighted static markup via
 * highlight.js core + curated language subset (sync API — works under
 * renderToStaticMarkup and in the browser identically).
 */
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import { useTheme } from '@skb/theme';
import type { CodeContent } from './code';

const LANGS = {
  plaintext,
  typescript,
  javascript,
  python,
  rust,
  go,
  json,
  bash,
  html: xml,
  css,
  sql,
  c,
  cpp,
  java,
  markdown,
} as const;

for (const [name, lang] of Object.entries(LANGS)) {
  hljs.registerLanguage(name, lang);
}

export function CodeRenderView({ content }: { content: CodeContent }) {
  const theme = useTheme();
  const lang = content.language in LANGS ? content.language : 'plaintext';
  const { value } = hljs.highlight(content.source, { language: lang });
  return (
    <pre
      style={{
        margin: 0,
        height: '100%',
        overflow: 'auto',
        fontSize: '12.5px',
        lineHeight: 1.5,
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        color: theme.textColor,
      }}
    >
      <style>{theme.codeCss}</style>
      <code dangerouslySetInnerHTML={{ __html: value }} />
    </pre>
  );
}
