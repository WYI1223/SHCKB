/**
 * Image block content model (block-image.md M2-slice): a content-
 * addressed blob reference + alt text. The blob is immutable, so
 * published snapshots referencing the hash stay valid forever.
 */
export type ImageContent = {
  blobHash: string | null;
  alt: string;
};

export function createContent(): ImageContent {
  return { blobHash: null, alt: '' };
}

export function isImageContent(c: unknown): c is ImageContent {
  if (typeof c !== 'object' || c === null) return false;
  const i = c as ImageContent;
  return (i.blobHash === null || typeof i.blobHash === 'string') && typeof i.alt === 'string';
}

export function coerceContent(c: unknown): ImageContent {
  return isImageContent(c) ? c : createContent();
}

export function blobUrl(hash: string): string {
  return `/api/public/blobs/${hash}`;
}

/** Search/export surface: the alt text is the extractable content. */
export function extractText(content: ImageContent): string {
  return content.alt.trim();
}
