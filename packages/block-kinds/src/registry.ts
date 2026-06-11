/**
 * Static block-kind registry (mvp-scope D4: seam, not system). The
 * plugin-system extension framework later owns registration; consumers
 * only ever see this lookup shape.
 */
import type { BlockSize } from '@skb/grid-engine';
import { codeModule } from './code';
import { imageModule } from './image';
import { markdownModule } from './markdown';
import type { BlockKindModule } from './types';

export const BLOCK_KINDS: Record<string, BlockKindModule<never>> = {
  // Content type erased at the registry boundary; modules are internally typed.
  markdown: markdownModule as unknown as BlockKindModule<never>,
  image: imageModule as unknown as BlockKindModule<never>,
  code: codeModule as unknown as BlockKindModule<never>,
};

export function blockModule(kind: string): BlockKindModule<never> | null {
  return BLOCK_KINDS[kind] ?? null;
}

export function defaultSizeFor(kind: string): BlockSize {
  return BLOCK_KINDS[kind]?.defaultSize ?? { colSpan: 6, rowSpan: 2 };
}
