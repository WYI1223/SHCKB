import type { BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

const propsSchema = z
  .object({
    variant: z.enum(['note', 'tip', 'warning', 'danger']),
    title: z.string().optional(),
  })
  .strict();

export const calloutCore: BlockCoreDefinition<typeof propsSchema> = {
  name: 'callout',
  kind: 'component',
  propsSchema,
  mdxComponent: 'Callout',
};
