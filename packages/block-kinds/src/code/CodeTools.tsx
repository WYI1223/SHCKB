/**
 * Code kind tool-panel contributions (MVP-5): the language select —
 * the contract's first per-block setting — moves out of the editing
 * surface into the host's tool panel, leaving EditView all editor.
 */
import { UiSelect } from '@skb/ui-kit';
import type { BlockToolProps } from '../types';
import { CODE_LANGUAGES, type CodeContent } from './code';

export function LanguageTool({ content, onChange }: BlockToolProps<CodeContent>) {
  return (
    <UiSelect
      value={content.language}
      onChange={(language) => onChange({ ...content, language })}
      options={CODE_LANGUAGES.map((l) => ({ value: l, label: l }))}
      title="Highlight language"
    />
  );
}
