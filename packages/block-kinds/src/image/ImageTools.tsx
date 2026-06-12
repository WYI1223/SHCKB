/**
 * Image kind tool-panel contributions (MVP-5): alt text moves out of
 * the editing surface into the host's tool panel — the edit surface
 * keeps upload + preview only.
 */
import { UiTextInput } from '@skb/ui-kit';
import type { BlockToolProps } from '../types';
import type { ImageContent } from './image';

export function AltTextTool({ content, onChange }: BlockToolProps<ImageContent>) {
  return (
    <UiTextInput
      value={content.alt}
      onChange={(alt) => onChange({ ...content, alt })}
      placeholder="Describe the image"
      title="Alt text for readers and screen readers"
    />
  );
}
