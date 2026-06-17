/**
 * ⚠️ DRAFT kind (owner decision 2026-06-12): the editing surface is a
 * plain textarea — no tab handling, bracket auto-close, or indent
 * preservation yet. Render path (highlight.js) is production-grade;
 * the editor UX is a startup version pending a dedicated pass (likely
 * alongside the executable-code family). Recorded in AUDIT register.
 */
import type { BlockKindModule } from '../types';
import { CodeEditView } from './CodeEditView';
import { CodeRenderView } from './CodeRenderView';
import { LanguageTool } from './CodeTools';
import { coerceContent, createContent, extractText, type CodeContent } from './code';

export const codeModule: BlockKindModule<CodeContent> = {
  kind: 'code',
  label: 'Code (draft)',
  glyph: '{}',
  defaultSize: { colSpan: 6, rowSpan: 3 },
  createContent,
  EditView: CodeEditView,
  RenderView: CodeRenderView,
  extractText,
  tools: [{ id: 'language', label: 'Language', View: LanguageTool }],
  autofit: { default: 'grow' },
};

export { coerceContent, type CodeContent };
