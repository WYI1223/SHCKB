/**
 * The richtext PM schema — deliberately small and in LOCKSTEP with the
 * RenderView walker (every node/mark here has a render branch there;
 * adding one without the other is a review error). Editing-surface
 * only: prosemirror-model is DOM-free, but nothing on the publish path
 * imports this file.
 */
import { Schema } from 'prosemirror-model';

export const richtextSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1 } },
      defining: true,
      parseDOM: [1, 2, 3].map((level) => ({ tag: `h${level}`, attrs: { level } })),
      toDOM: (node) => [`h${node.attrs.level}`, 0],
    },
    blockquote: {
      group: 'block',
      content: 'block+',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    },
    bullet_list: {
      group: 'block',
      content: 'list_item+',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },
    ordered_list: {
      group: 'block',
      content: 'list_item+',
      parseDOM: [{ tag: 'ol' }],
      toDOM: () => ['ol', 0],
    },
    list_item: {
      content: 'paragraph block*',
      defining: true,
      parseDOM: [{ tag: 'li' }],
      toDOM: () => ['li', 0],
    },
    text: { group: 'inline' },
    hard_break: {
      group: 'inline',
      inline: true,
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
  },
  marks: {
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }],
      toDOM: () => ['strong', 0],
    },
    em: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
      toDOM: () => ['em', 0],
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code', 0],
    },
    /** External link — plain href. */
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom) => ({ href: (dom as HTMLElement).getAttribute('href') }),
        },
      ],
      toDOM: (mark) => ['a', { href: mark.attrs.href as string }, 0],
    },
    /** First-class inter-page link (M9-D1): stores only the pageId —
     * renders as the /p/:id permalink, so renames never break it. */
    pagelink: {
      attrs: { pageId: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[data-skb-page]',
          getAttrs: (dom) => ({ pageId: (dom as HTMLElement).getAttribute('data-skb-page') }),
        },
      ],
      toDOM: (mark) => [
        'a',
        { href: `/p/${mark.attrs.pageId as string}`, 'data-skb-page': mark.attrs.pageId as string },
        0,
      ],
    },
  },
});
