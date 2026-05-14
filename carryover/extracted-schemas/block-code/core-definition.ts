import type { BlockCoreDefinition } from '@skb/block-foundation';
import { z } from 'zod';

const propsSchema = z
  .object({
    language: z.string().min(1),
    code: z.string(),
    showLineNumbers: z.boolean().default(true),
  })
  .strict();

export const codeCore: BlockCoreDefinition<typeof propsSchema> = {
  // Wave 6 carry-forward #15b 2026-05-08 — renamed from 'code' to
  // 'componentCode' so the Tiptap node name no longer collides with
  // StarterKit's inline `code` MARK. ProseMirror forbids the same
  // name on both a node and a mark; pre-rename, the editor disabled
  // the inline-code mark via StarterKit.configure({ code: false })
  // and `loadFromMdx` stripped MDX-emitted `code` marks at the
  // editor boundary, costing inline-code-formatting fidelity.
  // The user-facing slash-menu label stays 'Code'; the MDX tag
  // stays `<Code>`; only the internal BlockKind identifier changed.
  name: 'componentCode',
  kind: 'component',
  propsSchema,
  mdxComponent: 'Code',
};
