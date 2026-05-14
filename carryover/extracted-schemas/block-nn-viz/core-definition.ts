import { defineCore, type BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

/**
 * propsSchema for nn-viz block.
 *
 * `.strict()` is applied on BOTH the outer object AND the inner layer object.
 * Reason: ADR-0006 #3 — Zod's `.strict()` does NOT propagate through nested
 * z.object schemas. A user supplying `{layers:[{name,units,activation,bogus:1}]}`
 * would slip past an outer-only `.strict()` because the layer item validator
 * is a separate z.object that defaults to `passthrough`. We freeze the inner
 * shape too so unknown keys at any depth fail loudly.
 */
const layerSchema = z
  .object({
    name: z.string(),
    units: z.number().int().positive(),
    activation: z.enum(['relu', 'softmax', 'sigmoid', 'tanh', 'linear']),
  })
  .strict();

const propsSchema = z
  .object({
    modelUrl: z.string().min(1),
    layers: z.array(layerSchema).default([]),
    showWeights: z.boolean().default(false),
  })
  .strict();

export const nnVizCore: BlockCoreDefinition<typeof propsSchema> = defineCore({
  name: 'nn-viz',
  kind: 'viz',
  propsSchema,
  mdxComponent: 'NnViz',
});
