# ADR-0013: Markdown tile editor — Lexical-based WYSIWYG + DB markdown source

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.1 |

## Context

`packages/plugins/markdown/` 是 first reference plugin（per M2 in bootstrap-evolution）。内部如何 edit markdown 影响：
- User 体验（WYSIWYG vs source）
- Plugin contract 演示
- 后续 callout / 等富文本 tile 模式

User initial direction: WYSIWYG。但 gatekeeper 初次推 (a) source-only on 错误诊断（"WYSIWYG 边界问题"）；user push back 指出 "可能不是 WYSIWYG 边界的问题，而是原来的其他问题"。

Misdiagnosis correction：Wave 6 cf-15..cf-25 14/15 痛点是 **Tiptap-as-host** 问题（schema collision / NodeView abstraction tax / .ProseMirror → grid hack / etc.），不是 WYSIWYG-inherent 问题（cursor at mark boundary / selection across formatting / undo granularity / paste from Word），后者 Lexical / Slate / Tiptap 库自身 handle 得很好。

只要满足两条，WYSIWYG 在 tile 内 safe：
1. Editor instance 不当 grid host（每 markdown tile 一独立 instance，不知道 grid / 其他 tile 存在）
2. Editor 不暴露 NodeView 给外部（inline 元素全在 editor 内部 schema，不暴露 plugin contract）

## Decision

### Markdown tile editor = **Lexical-based WYSIWYG**

Per tile mount 一个 `LexicalComposer` instance：

```ts
function MarkdownEditView({ content, onChange }: BlockViewProps) {
  return (
    <LexicalComposer initialConfig={config}>
      <RichTextPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <HistoryPlugin />
      <LinkPlugin />
      <ListPlugin />
      <OnChangePlugin onChange={(editor) => {
        editor.update(() => {
          const markdown = $convertToMarkdownString(TRANSFORMERS);
          onChange(markdown);
        });
      }} />
    </LexicalComposer>
  );
}
```

Plugin `serializer`:

```ts
toRow: (state) => ({ content: state.markdown }),    // DB 存 markdown string
fromRow: (row) => ({ markdown: row.content || '' }),
```

**DB content 仍是 markdown string** —— Lexical 是 view-layer；AI agent 通过 `agentOps.set_markdown(content)` 改字符串；git diff / 备份 readable。

### 替代候选

`MDXEditor`（基于 Lexical 预配置 markdown） —— 如默认 Lexical 配置太重可 drop-in。

### 同形态延展

- `callout` body → 同 Lexical instance（rich markdown body）
- `code` plugin → CodeMirror language mode（source-only；code 无 WYSIWYG）
- `math` plugin → TeX source + KaTeX preview
- `image` / `pdf` / `nn-viz` / `agent-flow` → no rich text；跳过
- `discussion` plugin posts body → Lexical instance

### 非 markdown-fluent 用户

User explicit: **不替代 markdown plugin，以新 plugin 形式提供**。

未来 Phase 2+ 可加：
- `rich-text` plugin (`kind: 'rich-text'`) —— 完全隐藏 markdown 语法 from user；存储是 Lexical JSON tree（不是 markdown string）；适合 Word / Notion 迁移用户
- `prose-canvas` plugin —— nested canvas 形态

不动 markdown plugin。

### 跨引用层次

5 个 level，Day-1 / Phase 2+ 拆分：

| Level | Syntax | Day-1 | Phase 2+ |
|---|---|---|---|
| 1 跨 note 链接 | `[text](/notes/slug)` 标准 markdown | ✅ LinkPlugin 开箱 | |
| 2 跳到 note 内特定 block | `[text](/notes/slug#block-b3)` URL fragment | ✅ 需 read-mode SSR emit `id="block-<id>"` | |
| 3 跳到 block 内 heading | `[text](/notes/slug#heading-slug)` | ✅ `@lexical/markdown` GFM heading 自动 slugify；冲突防御加 `block-<id>-` prefix | |
| 4 Wikilink + @-mention | `[[slug]]` / `@user` 非标 | ✗ | ✅ 自定义 Lexical DecoratorNode + TypeaheadMenuPlugin + LinkResolver service |
| 5 反向链接 + transclusion | "Referenced by" / `![[slug#block]]` | ✗ | ✅ DB `block_links` index + `packages/plugins/embed/` |

### Architectural prerequisites

依赖 Block ID stability invariants（详 ADR-0002）：
- `blocks.id` UUID 永不重用
- Read mode SSR emit `<article id="block-<id>" data-skb-block ...>` wrapper
- 跨外部 hyperlink 稳定的基础

## Consequences

**Positive**:
- User 写 markdown 时看见格式化文本（WYSIWYG），不写源码
- 单 plugin 实例隔离；no Tiptap-as-host history pain
- DB content 仍是 markdown string；diff / agent / backup 都简单
- 跨 note 链接 / 块级 fragment / heading anchor Day-1 ship 完
- Wikilink / backlink phase 2+ progressive enhance

**Negative / Trade-offs**:
- Lexical 比 CodeMirror source-only 复杂；plugin author 学习成本（但只针对 markdown plugin 作者；其他 plugin 不需要）
- Markdown round-trip Lexical 可能 lose 边缘 GFM 特性；mitigate by `@lexical/markdown` 主流 transformer 覆盖 + bundle test

**Risks**:
- Lexical 演化破坏 markdown serializer；mitigate by pinning + sample-driven 集成 test

## Alternatives considered

- **(a) CodeMirror source-only**: gatekeeper 初次默认；rejected per user "倾向 b" + misdiagnosis correction
- **(c) Nested canvas (inline blocks)**: recursive constrained canvas；scope 大；rejected for Day-1，留作 future `prose-canvas` plugin
- **Tiptap inside tile**: 库本身能用但品牌伤口太新（Wave 6 经历）；rejected per gatekeeper hesitation + ecosystem 已转 Lexical
- **Slate.js**: 旧；性能 + TS-first 不如 Lexical；rejected
- **Quill / etc.**: 不 modular；rejected
- **Pure markdown source textarea + preview split**: 不 WYSIWYG；rejected per user (b)

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.1
- Related ADRs: ADR-0002 (block ID stability), ADR-0004 (plugin contract), ADR-0016 (CSS framework incl. `@tailwindcss/typography` for `.prose`)
- External: Lexical docs / @lexical/markdown / MDXEditor

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-12 in source DI doc post misdiagnosis correction)
