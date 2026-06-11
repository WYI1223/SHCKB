/**
 * Style-round review tool: render one rich sample page through every
 * registered theme via the real static renderer, for side-by-side
 * screenshots. Output is scratch (gitignored).
 *
 *   bun packages/theme/scripts/render-samples.ts [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderStaticPage } from '../../block-kinds/src/static';
import { THEMES } from '../src/themes';

const SAMPLE_DOC = {
  title: 'Field Notes — Style Round Sample',
  blocks: [
    {
      id: 'b1',
      kind: 'markdown',
      col: 0,
      row: 0,
      colSpan: 7,
      rowSpan: 5,
      content: {
        markdown: [
          '# 网格上的笔记',
          '',
          'SHCKB 的每一页都是 **12 列网格** 上的块拼贴。这个样页用来评审主题候选：标题、正文、列表、引用、表格、行内 `code` 都在这里。',
          '',
          '- 长文阅读的舒适度',
          '- 块卡片与底板的层次',
          '- kind 色条的分类感',
          '',
          '> 主题是数据，不是代码——publishedHtml 是 (doc, slug, theme) 的纯函数。',
          '',
          '| Token | 用途 |',
          '|---|---|',
          '| canvasBg | 底板 |',
          '| blockBg | 卡片 |',
        ].join('\n'),
      },
    },
    {
      id: 'b2',
      kind: 'code',
      col: 7,
      row: 0,
      colSpan: 5,
      rowSpan: 3,
      content: {
        language: 'typescript',
        source: [
          '// effective theme resolution',
          'export function effectiveTheme(',
          '  page: { themeId: string | null },',
          '): Theme {',
          "  const id = page.themeId ?? 'instance';",
          '  return THEMES[id] ?? DEFAULT;',
          '}',
        ].join('\n'),
      },
    },
    {
      id: 'b3',
      kind: 'image',
      col: 7,
      row: 3,
      colSpan: 5,
      rowSpan: 2,
      content: { blobHash: null, alt: '示例图片（缺资产降级框）' },
    },
    {
      id: 'b4',
      kind: 'markdown',
      col: 0,
      row: 5,
      colSpan: 12,
      rowSpan: 1,
      content: { markdown: '横跨整页的脚注块 — muted 文本与窄行高在这里检验。' },
    },
  ],
};

const outDir = process.argv[2] ?? '.playwright-mcp/style-round';
mkdirSync(outDir, { recursive: true });
for (const theme of Object.values(THEMES)) {
  const html = renderStaticPage(SAMPLE_DOC, `sample-${theme.id}`, theme);
  writeFileSync(join(outDir, `${theme.id}.html`), html);
  console.log(`rendered ${theme.id} (${html.length} bytes)`);
}
