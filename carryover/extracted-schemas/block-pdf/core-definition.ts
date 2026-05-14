import { defineCore, type BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

const propsSchema = z
  .object({
    src: z.string().min(1),
    page: z.number().int().min(1).default(1),
    searchable: z.boolean().default(false),
  })
  .strict();

export const pdfCore: BlockCoreDefinition<typeof propsSchema> = defineCore({
  name: 'pdf',
  kind: 'render',
  propsSchema,
  mdxComponent: 'Pdf',
});
