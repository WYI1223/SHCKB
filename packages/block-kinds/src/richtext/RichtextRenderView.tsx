/**
 * Reader/inactive-preview rendering: a pure PM-JSON → React walker with
 * ZERO prosemirror imports — the publish pipeline renders this on Bun
 * (no DOM), so the dependency line is a contract, not a preference.
 * Kept in lockstep with schema.ts: every node/mark there has a branch
 * here; unknown nodes degrade to their children (content preserved).
 */
import type { ReactNode } from 'react';
import { isSafeCssColor, useTheme } from '@skb/theme';
import type { PmMark, PmNode, RichtextContent } from './richtext';
import { extractText, SPACING_LINE_HEIGHT } from './richtext';

export function RichtextRenderView({ content }: { content: RichtextContent }) {
  const theme = useTheme();
  if (extractText(content).trim() === '') {
    return <div style={{ color: theme.mutedColor, fontSize: '13px', fontStyle: 'italic' }}>Empty richtext block</div>;
  }
  return (
    <div
      className="skb-rt"
      style={{
        fontSize: '14px',
        lineHeight: SPACING_LINE_HEIGHT[content.spacing ?? 'normal'],
        color: theme.textColor,
        overflowWrap: 'anywhere',
      }}
    >
      <style>{`
        .skb-rt > :first-child { margin-top: 0; }
        .skb-rt > :last-child { margin-bottom: 0; }
        .skb-rt h1, .skb-rt h2, .skb-rt h3 { line-height: 1.25; }
        .skb-rt code { background: ${theme.surfaceInsetBg}; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
        .skb-rt blockquote { margin: 0.5em 0; padding-left: 10px; border-left: 3px solid ${theme.hairline}; color: ${theme.quoteColor}; }
        .skb-rt a { color: ${theme.accent}; }
        .skb-rt a[data-skb-page] { text-decoration-style: dotted; }
      `}</style>
      {(content.doc.content ?? []).map((node, i) => renderNode(node, i))}
    </div>
  );
}

function renderNode(node: PmNode, key: number): ReactNode {
  const children = node.text !== undefined ? node.text : (node.content ?? []).map(renderNode);
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{children}</p>;
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      return <Tag key={key}>{children}</Tag>;
    }
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'bullet_list':
      return <ul key={key}>{children}</ul>;
    case 'ordered_list':
      return <ol key={key}>{children}</ol>;
    case 'list_item':
      return <li key={key}>{children}</li>;
    case 'hard_break':
      return <br key={key} />;
    case 'text':
      return <span key={key}>{applyMarks(node.text ?? '', node.marks ?? [])}</span>;
    default:
      // unknown node (schema grew?): keep the content, drop the wrapper
      return <span key={key}>{children}</span>;
  }
}

/** Wrap a text leaf in its marks, innermost-first. */
function applyMarks(text: string, marks: PmMark[]): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'strong':
        out = <strong>{out}</strong>;
        break;
      case 'em':
        out = <em>{out}</em>;
        break;
      case 'code':
        out = <code>{out}</code>;
        break;
      case 'color': {
        // palette values only, but re-validate: docs travel via import
        const c = typeof mark.attrs?.color === 'string' ? mark.attrs.color : '';
        if (isSafeCssColor(c)) out = <span style={{ color: c }}>{out}</span>;
        break;
      }
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
        // reject javascript: etc. — only http(s), mailto, and relative
        const safe = /^(https?:|mailto:|\/|#)/i.test(href) ? href : '#';
        out = (
          <a href={safe} rel="noreferrer noopener">
            {out}
          </a>
        );
        break;
      }
      case 'pagelink': {
        const pageId = typeof mark.attrs?.pageId === 'string' ? mark.attrs.pageId : '';
        const blockId = typeof mark.attrs?.blockId === 'string' ? mark.attrs.blockId : '';
        // /p/:id(#blockId) permalink — the server 302s to the page's CURRENT
        // slug, so renames never break the link (M9-D1 first-class links).
        // RenderView percent-encodes ids for publish-HTML safety; schema.ts
        // toDOM (editing surface only) emits raw ids — both correct for their
        // context, and parsePermalink() always decodeURIComponent()s back.
        out = (
          <a
            href={`/p/${encodeURIComponent(pageId)}${blockId ? '#' + encodeURIComponent(blockId) : ''}`}
            data-skb-page={pageId}
            {...(blockId ? { 'data-skb-block': blockId } : {})}
          >
            {out}
          </a>
        );
        break;
      }
      default:
        break; // unknown mark: render the text undecorated
    }
  }
  return out;
}
