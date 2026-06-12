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

/** Menu vocabulary a module may hand to the host (M9-D3 finding #3):
 * the universal panel face is the HOST's visual sovereignty — plugins
 * describe items, the host draws them. Mirrors the chrome overlay menu
 * shape (item / separator / label / choices) without importing it. */
export type HostMenuItem =
  | {
      kind?: 'item';
      label: string;
      onSelect: () => void;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
    }
  | { kind: 'separator' }
  | { kind: 'label'; label: string }
  | {
      kind: 'choices';
      label: string;
      options: Array<{ id: string; name: string; swatch?: string; selected?: boolean }>;
      onPick: (id: string) => void;
    };

/** Host capabilities injected by the embedding app — the seed of the
 * plugin host API. EditViews must reach the host ONLY through this.
 *
 * The optional members are findings from the M9 plugin stress test
 * (richtext): capabilities a real plugin needed that the contract
 * lacked. Optional so older/leaner hosts stay valid — modules must
 * degrade (hide the affordance) when one is absent. */
export type HostServices = {
  uploadBlob: (file: File) => Promise<{ hash: string; size: number; mimeType: string }>;
  /** Author-side page directory — link pickers (M9 finding: plugins
   * cannot reach the host's tree state). */
  listPages?: () => Promise<Array<{ id: string; title: string }>>;
  /** Host-rendered modal text prompt (M9 finding: plugins must never
   * own window.* dialogs, and chrome overlays are host-private). */
  promptText?: (opts: { title: string; message?: string; initial?: string }) => Promise<string | null>;
  /** Host-rendered universal menu (M9-D3 finding: in-content menus must
   * wear the SAME panel face as the chrome context menus — owner
   * ruling). Anchor is a viewport point. */
  menu?: (anchor: { x: number; y: number }, items: HostMenuItem[], opts?: { header?: string }) => void;
};

export const HostContext = createContext<HostServices | null>(null);

export function useHost(): HostServices {
  const host = useContext(HostContext);
  if (!host) throw new Error('HostContext not provided — wrap editing surfaces in <HostContext.Provider>');
  return host;
}
