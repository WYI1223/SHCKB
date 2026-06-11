/**
 * Reader/inactive-preview rendering. No author-only controls here
 * (consumed by both the editor's inactive previews and the public read
 * route). Raw HTML in markdown is skipped (see markdown.ts note).
 */
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@skb/theme';
import type { MarkdownContent } from './markdown';

export function MarkdownRenderView({ content }: { content: MarkdownContent }) {
  const theme = useTheme();
  if (content.markdown.trim() === '') {
    return <div style={{ color: theme.mutedColor, fontSize: '13px', fontStyle: 'italic' }}>Empty markdown block</div>;
  }
  return (
    <div className="skb-md" style={{ fontSize: '14px', lineHeight: 1.55, color: theme.textColor }}>
      <style>{`
        .skb-md > :first-child { margin-top: 0; }
        .skb-md > :last-child { margin-bottom: 0; }
        .skb-md h1, .skb-md h2, .skb-md h3 { line-height: 1.25; }
        .skb-md pre { background: ${theme.surfaceInsetBg}; padding: 8px; border-radius: 4px; overflow-x: auto; }
        .skb-md code { background: ${theme.surfaceInsetBg}; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
        .skb-md pre code { background: transparent; padding: 0; }
        .skb-md table { border-collapse: collapse; }
        .skb-md th, .skb-md td { border: 1px solid ${theme.hairline}; padding: 4px 8px; }
        .skb-md img { max-width: 100%; }
        .skb-md blockquote { margin: 0.5em 0; padding-left: 10px; border-left: 3px solid ${theme.hairline}; color: ${theme.quoteColor}; }
      `}</style>
      <Markdown remarkPlugins={[remarkGfm]}>{content.markdown}</Markdown>
    </div>
  );
}
