/**
 * Active-block editing surface: lightweight source-plus-preview per
 * block-markdown.md M2 shape. Mounted only on the single active block;
 * parsing/preview stay inside the block module.
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
    <div style={{ display: 'flex', gap: '8px', height: '100%', minHeight: 0 }}>
      <textarea
        ref={taRef}
        value={content.markdown}
        onChange={(e) => onChange({ markdown: e.target.value })}
        placeholder="Write markdown…"
        aria-label="Markdown source"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          resize: 'none',
          border: `1px solid ${theme.accent}`,
          borderRadius: '4px',
          padding: '8px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '13px',
          lineHeight: 1.5,
          color: theme.textColor,
          background: 'white',
          outline: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          overflow: 'auto',
          padding: '0 4px',
          borderLeft: `1px dashed ${theme.hairline}`,
        }}
      >
        <MarkdownRenderView content={content} />
      </div>
    </div>
  );
}
