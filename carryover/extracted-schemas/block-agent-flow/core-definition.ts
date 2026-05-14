import { defineCore, type BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

/**
 * Nested `.strict()` at every ZodObject level — ADR-0006 item #3 trip-hazard:
 * `.strict()` does NOT propagate into children, so each `z.object(...)` inside
 * `nodes`/`edges`/`position` must be marked individually. Tests in
 * `__tests__/core.test.ts` exercise unknown-key reject at every level.
 */
const propsSchema = z
  .object({
    nodes: z
      .array(
        z
          .object({
            id: z.string(),
            label: z.string(),
            type: z.enum(['agent', 'tool', 'memory', 'router']),
            position: z
              .object({
                x: z.number(),
                y: z.number(),
              })
              .strict(),
          })
          .strict(),
      )
      .default([]),
    edges: z
      .array(
        z
          .object({
            id: z.string(),
            source: z.string(),
            target: z.string(),
            label: z.string().optional(),
          })
          .strict(),
      )
      .default([]),
    interactive: z.boolean().default(true),
  })
  .strict();

export const agentFlowCore: BlockCoreDefinition<typeof propsSchema> = defineCore({
  name: 'agent-flow',
  kind: 'viz',
  propsSchema,
  mdxComponent: 'AgentFlow',
});
