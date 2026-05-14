import { defineCore, type BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

const propsSchema = z
  .object({
    expression: z.string().min(1),
    display: z.boolean().default(false),
  })
  .strict();

export const mathCore: BlockCoreDefinition<typeof propsSchema> = defineCore({
  name: 'math',
  kind: 'render',
  propsSchema,
  mdxComponent: 'Math',
});
