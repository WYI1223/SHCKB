import { defineCore, type BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

const propsSchema = z
  .object({
    code: z.string(),
    runOnLoad: z.boolean().default(false),
    showLineNumbers: z.boolean().default(true),
    libraries: z.array(z.string()).default([]),
  })
  .strict();

export const jupyterCore: BlockCoreDefinition<typeof propsSchema> = defineCore({
  name: 'jupyter',
  kind: 'viz',
  propsSchema,
  mdxComponent: 'Jupyter',
});
