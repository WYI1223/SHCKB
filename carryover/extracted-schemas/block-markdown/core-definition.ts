import type { BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

/**
 * Wave 6 cf-25 — `@skb/block-markdown` core definition.
 *
 * Wave 7 Phase 2A (ADR-0020 D1): rowSpan is a discrete integer. The
 * legacy `'auto'` literal has been removed; markdown defaults to 12 × 1
 * and content overflow scrolls inside the block (design-doc §5).
 * Legacy `rowSpan='auto'` in existing .mdx files is normalized to 1 by
 * `mdx-bridge/parseRowSpan` on read; first save then drops the attr.
 *
 * Naming: `name: 'markdown'` (kebab/lowercase, matches existing
 * grid-rtt + grid-defensive test fixtures).
 * `mdxComponent: 'Markdown'` (PascalCase, matches the JSX wrapper
 * tag emitted on serialize when grid attrs are non-default).
 */
const propsSchema = z
  .object({
    col: z.number().int().min(1).max(12),
    row: z.number().int().min(1).optional(),
    colSpan: z.number().int().positive(),
    rowSpan: z.number().int().positive(),
  })
  .strict();

export const markdownCore: BlockCoreDefinition<typeof propsSchema> = {
  name: 'markdown',
  kind: 'prose',
  propsSchema,
  mdxComponent: 'Markdown',
};

export type MarkdownProps = z.infer<typeof propsSchema>;
