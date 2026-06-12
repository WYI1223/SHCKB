/**
 * Active-block editing surface: monospace source editor. The language
 * select lives in the host's tool panel (CodeTools, MVP-5) — the
 * editing surface is all editor.
 */
import { useTheme } from '@skb/theme';
import type { BlockViewProps } from '../types';
import type { CodeContent } from './code';

export function CodeEditView({ content, onChange }: BlockViewProps<CodeContent>) {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', minHeight: 0 }}>
      <textarea
        value={content.source}
        onChange={(e) => onChange({ ...content, source: e.target.value })}
        spellCheck={false}
        aria-label="Source code"
        placeholder="Write code… (draft editor: no tab/bracket assist yet)"
        style={{
          flex: 1,
          minHeight: 0,
          resize: 'none',
          border: `1px solid ${theme.accent}`,
          borderRadius: '4px',
          padding: '6px 8px',
          fontSize: '12.5px',
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          color: theme.textColor,
          background: theme.blockBg,
          outline: 'none',
        }}
      />
    </div>
  );
}
