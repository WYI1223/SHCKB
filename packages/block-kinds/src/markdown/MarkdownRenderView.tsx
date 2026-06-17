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
    // Empty = blank (owner decision, frame-core slice): readers never see
    // editor jargon, and an emptied autofit block measures ~0 → shrinks to its
    // floor cleanly. The author affordance for an empty block is the block's
    // own frame (a visible card) + the EditView "Write markdown…" textarea on
    // click — no placeholder text leaks into the rendered/published output.
    return null;
  }
  return (
    // overflow-wrap: anywhere — prose (incl. long inline code / URLs)
    // always wraps, so a markdown block itself never scrolls
    // horizontally; pre and tables get their OWN inner x-scroll instead
    // (GitHub-style). The frame's scrollbar stays vertical-only.
    <div
      className="skb-md"
      style={{ fontSize: '14px', lineHeight: 1.55, color: theme.textColor, overflowWrap: 'anywhere' }}
    >
      <style>{`
        .skb-md > :first-child { margin-top: 0; }
        .skb-md > :last-child { margin-bottom: 0; }
        .skb-md h1, .skb-md h2, .skb-md h3 { line-height: 1.25; }
        .skb-md pre { background: ${theme.surfaceInsetBg}; padding: 8px; border-radius: 4px; overflow-x: auto; max-width: 100%; }
        .skb-md code { background: ${theme.surfaceInsetBg}; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
        .skb-md pre code { background: transparent; padding: 0; }
        .skb-md .skb-md-tablewrap { overflow-x: auto; max-width: 100%; }
        .skb-md table { border-collapse: collapse; }
        .skb-md th, .skb-md td { border: 1px solid ${theme.hairline}; padding: 4px 8px; }
        .skb-md img { max-width: 100%; }
        .skb-md blockquote { margin: 0.5em 0; padding-left: 10px; border-left: 3px solid ${theme.hairline}; color: ${theme.quoteColor}; }
      `}</style>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // wide tables scroll inside their own strip, never the block
          table: (props) => (
            <div className="skb-md-tablewrap">
              <table {...props} />
            </div>
          ),
        }}
      >
        {content.markdown}
      </Markdown>
    </div>
  );
}
