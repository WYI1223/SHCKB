/**
 * BlockKindModule — the block product contract (CONTRACT.md). In-tree
 * kinds are plugins that happen to live in this repo: they consume the
 * exact surface a plugin would (registry + HostServices + ThemeContext).
 */
import { createContext, useContext } from 'react';
import type { ComponentType } from 'react';
import type { BlockSize } from '@skb/grid-engine';

export type BlockViewProps<C = unknown> = {
  content: C;
  /** Hands changed content to the notepage host (author working state). */
  onChange: (next: C) => void;
};

/** Same surface as a view: tools edit the active block's content. */
export type BlockToolProps<C = unknown> = BlockViewProps<C>;

/** A control the module contributes to the host's tool panel (MVP-5
 * M5-D4 split: the module owns WHAT the tool is, the host owns WHERE
 * the panel lives and how it looks). Compose ui-kit primitives; reach
 * host capabilities only through useHost(). */
export type BlockTool<C = unknown> = {
  id: string;
  label: string;
  View: ComponentType<BlockToolProps<C>>;
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
  /** Tools for the active block, rendered in the host's tool panel.
   *  Editing-surface only — never reachable from RenderView. */
  tools?: Array<BlockTool<C>>;
};

/** Host capabilities injected by the embedding app — the seed of the
 * plugin host API. EditViews must reach the host ONLY through this. */
export type HostServices = {
  uploadBlob: (file: File) => Promise<{ hash: string; size: number; mimeType: string }>;
};

export const HostContext = createContext<HostServices | null>(null);

export function useHost(): HostServices {
  const host = useContext(HostContext);
  if (!host) throw new Error('HostContext not provided — wrap editing surfaces in <HostContext.Provider>');
  return host;
}
