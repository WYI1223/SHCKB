import type { BlockKindModule } from '../types';
import { CodeEditView } from './CodeEditView';
import { CodeRenderView } from './CodeRenderView';
import { coerceContent, createContent, extractText, type CodeContent } from './code';

export const codeModule: BlockKindModule<CodeContent> = {
  kind: 'code',
  label: 'Code',
  glyph: '{}',
  defaultSize: { colSpan: 6, rowSpan: 3 },
  createContent,
  EditView: CodeEditView,
  RenderView: CodeRenderView,
  extractText,
};

export { coerceContent, type CodeContent };
