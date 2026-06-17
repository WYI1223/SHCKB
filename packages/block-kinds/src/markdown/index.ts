import type { BlockKindModule } from '../types';
import { coerceContent, createContent, extractText, type MarkdownContent } from './markdown';
import { MarkdownEditView } from './MarkdownEditView';
import { MarkdownRenderView } from './MarkdownRenderView';

export const markdownModule: BlockKindModule<MarkdownContent> = {
  kind: 'markdown',
  label: 'Markdown',
  glyph: '¶',
  defaultSize: { colSpan: 6, rowSpan: 3 },
  createContent,
  EditView: MarkdownEditView,
  RenderView: MarkdownRenderView,
  extractText,
  autofit: { default: 'grow' },
};

export { coerceContent, type MarkdownContent };
