/**
 * Reader/preview rendering: the image fills the block, preserving
 * aspect ratio. Missing asset → alt-text fallback box (block-image.md
 * missing-asset behavior), never a broken page.
 *
 * Boundary (mvp7 review C-img): the styled fallback box needs the
 * onError event, so it only appears where React runs (editor + SPA
 * reader). Published static HTML degrades to the browser-native alt
 * text — acceptable because the blob GC reference contract [ADR-0023]
 * keeps published blobs alive; a broken image there means file-system
 * level loss, not normal operation.
 */
import { useState } from 'react';
import { useTheme } from '@skb/theme';
import { blobUrl, type ImageContent } from './image';

export function ImageRenderView({ content }: { content: ImageContent }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (!content.blobHash || failed) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px dashed ${theme.hairline}`,
          borderRadius: '4px',
          color: theme.mutedColor,
          fontSize: '12px',
          fontStyle: 'italic',
          padding: '8px',
          textAlign: 'center',
        }}
      >
        {failed ? `Image unavailable${content.alt ? `: ${content.alt}` : ''}` : 'No image selected'}
      </div>
    );
  }

  return (
    <img
      src={blobUrl(content.blobHash)}
      alt={content.alt}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );
}
