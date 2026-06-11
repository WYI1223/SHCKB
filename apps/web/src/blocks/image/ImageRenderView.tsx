/**
 * Reader/preview rendering: the image fills the block, preserving
 * aspect ratio. Missing asset → alt-text fallback box (block-image.md
 * missing-asset behavior), never a broken page.
 */
import { useState } from 'react';
import { theme } from '../../theme/tokens';
import { blobUrl, type ImageContent } from './image';

export function ImageRenderView({ content }: { content: ImageContent }) {
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
          border: '1px dashed oklch(85% 0.01 80)',
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
