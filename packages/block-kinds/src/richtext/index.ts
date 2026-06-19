import type { BlockKindModule } from '../types';
import { coerceContent, createContent, extractText, links, type RichtextContent } from './richtext';
import { RichtextEditView } from './RichtextEditView';
import { RichtextRenderView } from './RichtextRenderView';

export const richtextModule: BlockKindModule<RichtextContent> = {
  kind: 'richtext',
  label: 'Richtext',
  glyph: '✒',
  defaultSize: { colSpan: 6, rowSpan: 3 },
  createContent,
  EditView: RichtextEditView,
  RenderView: RichtextRenderView,
  extractText,
  links,
  autofit: { default: 'follow' },
};

export { coerceContent, links, type RichtextContent };
