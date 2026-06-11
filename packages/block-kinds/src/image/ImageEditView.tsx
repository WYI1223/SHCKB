/**
 * Active-block editing surface: pick/replace the image (uploads to the
 * content-addressed blob store) + edit alt text. Replacing the image
 * yields a new hash — published snapshots keep the old one.
 */
import { useRef, useState } from 'react';
import { useTheme } from '@skb/theme';
import { useHost, type BlockViewProps } from '../types';
import { blobUrl, type ImageContent } from './image';

export function ImageEditView({ content, onChange }: BlockViewProps<ImageContent>) {
  const theme = useTheme();
  const { uploadBlob } = useHost();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { hash } = await uploadBlob(file);
      onChange({ ...content, blobHash: hash });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          style={{
            background: theme.accent,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '12px',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Uploading…' : content.blobHash ? 'Replace image' : 'Choose image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
          aria-label="Image file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
            e.target.value = '';
          }}
        />
        <input
          value={content.alt}
          onChange={(e) => onChange({ ...content, alt: e.target.value })}
          placeholder="Alt text (describe the image)"
          aria-label="Alt text"
          style={{
            flex: 1,
            minWidth: 0,
            border: theme.blockBorder,
            borderRadius: '6px',
            padding: '5px 8px',
            fontSize: '12px',
            color: theme.textColor,
          }}
        />
      </div>
      {error && <div style={{ color: theme.danger, fontSize: '12px', flexShrink: 0 }}>{error}</div>}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {content.blobHash ? (
          <img
            src={blobUrl(content.blobHash)}
            alt={content.alt}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed oklch(85% 0.01 80)',
              borderRadius: '4px',
              color: theme.mutedColor,
              fontSize: '12px',
            }}
          >
            Pick an image file to upload
          </div>
        )}
      </div>
    </div>
  );
}
