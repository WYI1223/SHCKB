import type { BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

const propsSchema = z
  .object({
    src: z.string().min(1),
    alt: z.string(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

export const imageCore: BlockCoreDefinition<typeof propsSchema> = {
  name: 'image',
  kind: 'component',
  propsSchema,
  mdxComponent: 'Image',
};
