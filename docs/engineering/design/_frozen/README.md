# Frozen DI Docs

**完全 frozen** —— historical conversation records，作为 ADR 决策的源头 trace。

## 修改规则

- ❌ Contributor / gatekeeper / AI agent 不修改
- ✅ Owner 可 fix typo / 修 link / 调整 markdown 渲染问题（不改实质内容）
- ❌ 不允许补充新决策 / 新分析（新内容写新 doc 或新 ADR）
- ❌ 不删除（这是历史 record；新 repo 起步源头）

## 当前 frozen docs

| 文件 | 日期 | 内容 |
|---|---|---|
| [`grid-redesign-2026-05-11.md`](./grid-redesign-2026-05-11.md) | 2026-05-11 | Grid 心智模型重设计 discussion：12-col baseplate / AABB 碰撞 / Option A gravity / 3 主题（graph-paper / lego-studs / bento-canvas）lock |
| [`architecture-rebuild-2026-05-11.md`](./architecture-rebuild-2026-05-11.md) | 2026-05-11 到 2026-05-13 | 全 architecture rebuild discussion：framing-control critique / constrained canvas / Tiptap+MDX 删 / DB-backed substrate / plugin extension model / agent semantic API (MCP+SKILL) / 9-layer architecture / 12 zone mapping / Lighthouse acceptance / 5-mode deploy matrix / Tailwind+cva+shadcn CSS stack / 等等 |

## 这些文档的角色

- ADR 是**决策结论 + 简短 reasoning**
- Frozen DI 是**完整 discussion + framing critique + 替代方案 + 怎么 emerge 出决策**
- 想 trace "为什么这个决策" → 看对应 ADR；想看 "怎么辩论出来的" → 看 frozen DI doc 的对应 section

Frozen DI 体量大（grid-redesign ~280 lines / architecture-rebuild ~1700 lines）。日常 reference 用 ADR；只在审计 / 深度复盘时回到 frozen DI。
