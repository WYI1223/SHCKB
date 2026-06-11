/**
 * Active-block editing surface: language select + monospace source
 * editor. The language select is the contract's first per-block
 * setting — exactly the API face the future plugin system must carry.
 */
import { useTheme } from '@skb/theme';
import type { BlockViewProps } from '../types';
import { CODE_LANGUAGES, type CodeContent } from './code';

export function CodeEditView({ content, onChange }: BlockViewProps<CodeContent>) {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', minHeight: 0 }}>
      <select
        value={content.language}
        onChange={(e) => onChange({ ...content, language: e.target.value })}
        aria-label="Language"
        style={{
          alignSelf: 'flex-start',
          fontSize: '12px',
          border: theme.blockBorder,
          borderRadius: '4px',
          padding: '2px 6px',
          color: theme.textColor,
        }}
      >
        {CODE_LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
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
          background: 'white',
          outline: 'none',
        }}
      />
    </div>
  );
}
