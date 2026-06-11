/**
 * BlockKindModule — the block product contract seam (blocks.md shared
 * block contract; mvp-scope D4). Static registry, zero plugin
 * machinery; the plugin-system later wraps this same interface.
 */
import type { ComponentType } from 'react';
import type { BlockSize } from '@skb/grid-engine';

export type BlockViewProps<C = unknown> = {
  content: C;
  /** Hands changed content to the notepage host (author working state). */
  onChange: (next: C) => void;
};

export type BlockKindModule<C = unknown> = {
  kind: string;
  label: string;
  glyph: string;
  defaultSize: BlockSize;
  createContent: () => C;
  /** Mounted only on the single active block (block-markdown.md performance boundary). */
  EditView: ComponentType<BlockViewProps<C>>;
  /** Inactive preview + public read rendering. Must not show author-only controls. */
  RenderView: ComponentType<{ content: C }>;
  /** Plain text for search/export, derived from content (not DOM). */
  extractText: (content: C) => string;
};
