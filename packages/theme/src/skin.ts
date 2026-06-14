/**
 * BlockSkin — the material/decoration a theme dresses the host frame-core's
 * content box with (spec 2026-06-14-unified-block-capability §3/§5). The
 * box/root styles are type-restricted to VISUAL-ONLY props, so a skin
 * physically cannot set position/overflow/height/display and thus cannot
 * break the host box invariant (the stationery autofit-collapse class).
 * Replaces the per-theme BlockFrame + ShellDefinition (ADR-0025 amendment).
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Theme } from './themes';

export type SkinCtx = {
  blockId: string;
  kind: string;
  colSpan: number;
  rowSpan: number;
  tokens: Pick<Theme, 'textColor' | 'mutedColor' | 'hairline' | 'accent' | 'blockBg' | 'surfaceInsetBg' | 'quoteColor' | 'kindHues' | 'kindHueFallback'>;
};

export type SkinRootStyle = Pick<
  CSSProperties,
  'transform' | 'transformOrigin' | 'filter' | 'opacity' | 'mixBlendMode' | 'isolation'
>;

export type SkinBoxStyle = Pick<
  CSSProperties,
  | 'background' | 'backgroundColor' | 'backgroundImage' | 'backgroundSize'
  | 'backgroundRepeat' | 'backgroundPosition' | 'backgroundClip'
  | 'border' | 'borderTop' | 'borderLeft' | 'borderBottom' | 'borderRadius' | 'borderImage'
  | 'padding' | 'color' | 'boxShadow' | 'fontSize' | 'lineHeight'
  | 'scrollbarWidth'
>;

export type BlockSkin = {
  id: string;
  name: string;
  /** Kinds this skin may be picked for; omitted = all. */
  kinds?: string[];
  root?: { className?: string; style?: SkinRootStyle };
  /** Per-block root visual (e.g. blockId-derived tilt); merged AFTER root.style.
   * Still SkinRootStyle, so it can't express layout-breaking props. */
  rootStyleOf?: (ctx: SkinCtx) => SkinRootStyle;
  box?: { className?: string; style?: SkinBoxStyle };
  behind?: (ctx: SkinCtx) => ReactNode;
  front?: (ctx: SkinCtx) => ReactNode;
};

export const DEFAULT_SKIN_ID = '__default';

type DefaultSkin = BlockSkin | ((kind: string) => BlockSkin);

function skinApplies(s: BlockSkin, kind: string): boolean {
  return !s.kinds || s.kinds.includes(kind);
}

const FRAMEWORK_DEFAULT: BlockSkin = { id: DEFAULT_SKIN_ID, name: 'Default' };

/** Resolve the BlockSkin for a block: author pick (if applicable) → theme
 * default (per kind) → framework default. Always returns a skin. */
export function resolveSkin(theme: Theme, kind: string, skinId: string | null | undefined): BlockSkin {
  const skins = theme.skins;
  if (skinId && skins?.[skinId] && skinApplies(skins[skinId], kind)) return skins[skinId];
  const def = (theme as Theme & { defaultSkin?: DefaultSkin }).defaultSkin;
  if (def) return typeof def === 'function' ? def(kind) : def;
  return FRAMEWORK_DEFAULT;
}

/** Author-pickable skins for a kind (inspector/menu feed) — excludes the
 * theme default (that's the "no pick" state). Mirrors old shellOptionsFor. */
export function skinOptionsFor(theme: Theme, kind: string): Array<{ id: string; name: string }> {
  return Object.entries(theme.skins ?? {})
    .filter(([, s]) => skinApplies(s, kind))
    .map(([id, s]) => ({ id, name: s.name }));
}
