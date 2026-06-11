import type { BlockKindModule } from '../types';
import { coerceContent, createContent, extractText, type ImageContent } from './image';
import { ImageEditView } from './ImageEditView';
import { ImageRenderView } from './ImageRenderView';

export const imageModule: BlockKindModule<ImageContent> = {
  kind: 'image',
  label: 'Image',
  glyph: '◧',
  defaultSize: { colSpan: 6, rowSpan: 4 },
  createContent,
  EditView: ImageEditView,
  RenderView: ImageRenderView,
  extractText,
};

export { coerceContent, type ImageContent };
