import type { BlockKindModule } from '../types';
import { coerceContent, createContent, extractText, type ImageContent } from './image';
import { ImageEditView } from './ImageEditView';
import { ImageRenderView } from './ImageRenderView';
import { AltTextTool } from './ImageTools';

export const imageModule: BlockKindModule<ImageContent> = {
  kind: 'image',
  label: 'Image',
  glyph: '◧',
  defaultSize: { colSpan: 6, rowSpan: 4 },
  createContent,
  EditView: ImageEditView,
  RenderView: ImageRenderView,
  extractText,
  tools: [{ id: 'alt', label: 'Alt', View: AltTextTool }],
  autofit: false,
};

export { coerceContent, type ImageContent };
