/**
 * Active-block editing surface (autofit design §7): a SINGLE textarea
 * filling the block — canonical content is the markdown source — plus a
 * VISIBLE right-aligned floating ghost preview. The ghost is the SAME
 * MarkdownRenderView the reader/publish path uses (and the §5.3
 * measurement loop wraps in the real Frame), so "edit-time render" and
 * "published render" can never drift. The dual editing pane is gone:
 * one source of truth for measurement (RenderView), one for authoring
 * (the source textarea). The measurement-loop subsystem owns the
 * offscreen Frame-wrapped instance + fit derivation; this surface owns
 * the author-facing ghost so the render feedback loop survives without
 * re-activating the block (block-markdown.md "keep the feedback loop").
 */
import { useEffect, useRef } from 'react';
import { useTheme } from '@skb/theme';
import type { BlockViewProps } from '../types';
import type { MarkdownContent } from './markdown';
import { MarkdownRenderView } from './MarkdownRenderView';

export function MarkdownEditView({ content, onChange }: BlockViewProps<MarkdownContent>) {
  const theme = useTheme();
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <textarea
        ref={taRef}
        value={content.markdown}
        onChange={(e) => onChange({ markdown: e.target.value })}
        placeholder="Write markdown…"
        aria-label="Markdown source"
        style={{
          width: '100%',
          height: '100%',
          resize: 'none',
          border: `1px solid ${theme.accent}`,
          borderRadius: '4px',
          padding: '8px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '13px',
          lineHeight: 1.5,
          color: theme.textColor,
          background: theme.blockBg,
          outline: 'none',
        }}
      />
      {/* Visible right-aligned floating ghost preview — the SAME
       * RenderView the reader sees. Floats over the textarea's top-right
       * so it never steals authoring width; pointer-events none so it is
       * a window, not a control. The measurement-loop subsystem finds it
       * via [data-skb-ghost-preview] to reuse this exact RenderView for
       * fit (no second render). */}
      <div
        data-skb-ghost-preview
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          maxWidth: '45%',
          maxHeight: 'calc(100% - 8px)',
          overflow: 'hidden',
          padding: '6px 8px',
          borderRadius: '4px',
          border: `1px dashed ${theme.hairline}`,
          background: theme.blockBg,
          boxShadow: '0 2px 6px oklch(40% 0.02 80 / 14%)',
          pointerEvents: 'none',
          opacity: 0.96,
          zIndex: 2,
        }}
      >
        <MarkdownRenderView content={content} />
      </div>
    </div>
  );
}
