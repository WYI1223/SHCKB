# Doc conventions

**Status**: living
**Last updated**: 2026-05-16

跨 ADR / PRD / Living / Method 文档共享的写作约定。第一条规则是 cross-reference 风格——采用学术 citation 模式（in-text plain identifier + footer markdown link 集中管理）。

## 1. Cross-reference 形式 — scholarly citation 风格

正文用 plain identifier 引用其他 doc；markdown link 集中在 References / Dependencies / Related 段。理由：

- **简单** —— 正文不被 link 语法噪声打断
- **集中** —— 所有外部引用一处可见，便于审计 / 维护
- **易管理** —— 文件移动只改一处（footer），不用 grep 整个 doc
- **科研论文同模式** —— [Author 2020] 在文中、bibliography 在文末

### In-text（引文）

| 引用类型 | 形式 | 例 |
|---|---|---|
| ADR | plain `ADR-XXXX` | "per ADR-0003" |
| Feature PRD | plain filename | "per canvas-editing.md" |
| Project PRD | plain identifier | "per project.md" |
| Living doc | plain filename | "per mental-model.md" |
| Frozen DI | plain filename | "per grid-redesign-2026-05-11.md §3" |
| Section ref | identifier + section name | "per ADR-0003 induction 3" |
| Code path | plain path in 反引号 | `packages/grid-engine/src/intent.ts:153` |
| External spec / URL | inline markdown link | [MCP spec](https://modelcontextprotocol.io) |

**不**在正文使用 markdown link 形式（除外部 URL）。**不**在正文反引号 wrap ADR / PRD identifier（反引号留给真实代码 / 文件路径）。

### Footer（links 集中）

每 doc 在 References / Dependencies / Related ADRs / Source DI doc 段集中 markdown link：

```markdown
## References

- Source DI doc: [grid-redesign-2026-05-11.md](../../engineering/design/_frozen/grid-redesign-2026-05-11.md)
- Related ADRs:
  - [ADR-0002](./ADR-0002-substrate-db-backed.md) — DB substrate
  - [ADR-0014](./ADR-0014-plugin-contract.md) — plugin contract
- Contract: [grid-engine CONTRACT.md](../../../packages/grid-engine/CONTRACT.md)
```

Footer 段可以是 References / Dependencies / Related ADRs / Source DI doc / 等任意"集中 link"位置；只要 doc 里有这么个 nav-hub 即可。

### Anti-pattern（不要这样写）

```markdown
❌ 详 [ADR-0014](./ADR-0014-plugin-contract.md) plugin contract
❌ Per `ADR-0003`
❌ 见 [`packages/grid-engine/CONTRACT.md`](../../../packages/grid-engine/CONTRACT.md)
❌ Source DI doc: `engineering/design/_frozen/grid-redesign-2026-05-11.md`
```

### Pattern（这样写）

```markdown
✅ 详 ADR-0014 plugin contract（footer References 含 link）
✅ Per ADR-0003
✅ 见 grid-engine CONTRACT.md
✅ Source DI doc: grid-redesign-2026-05-11.md（footer 含 link）
```

## 2. Section anchor

仅在 "确实要 reader 去看某个 specific section" 时使用。Anchor 限制 ASCII 字符以保 renderer 兼容：

- ✅ GitHub markdown renderer：中文 anchor 多数 work
- ❌ VSCode markdown preview：中文 anchor 不可靠
- ❌ 各 wiki / docs site renderer 行为不一

实践规则：

- 90% 时间不用 anchor —— doc-level link 已经够
- 若用 anchor，限 ASCII section title（写 `## Decision` / `## Scope boundary` / `## Induction 1 — leaf node`；不写 `## 决策` / `## 范围边界`）
- Anchor link 仍放 footer，不放正文

## 3. External URLs（spec / blog / standards）

保持 inline markdown link 形式：

```markdown
✅ 详 [MCP spec](https://modelcontextprotocol.io/specification)
✅ Lighthouse 评分 see [web.dev](https://web.dev/performance-scoring/)
```

外部 URL 与 in-project doc 规则不同 —— 外部链接是访问性主要手段，inline link 直观。

## 4. Chat output vs doc 内部

两个 surface 规则不同：

| Surface | 规则 |
|---|---|
| Doc 内部（本 convention 规定） | Scholarly cite — in-text plain + footer link |
| Chat output to user（Claude IDE 环境） | 任何 file / code reference 用 markdown link 形式（IDE 规则）|

不冲突：doc 是 long-form，集中 link 便于管理；chat 是 short-form，inline link 便于即时点击。

## 5. Format details

- ADR identifier 形式：`ADR-XXXX`（4 位数字零填充，dash 分隔，无空格）
- PRD identifier 形式：filename `<name>.md`（feature PRDs 在 `features/`）
- 路径用相对路径，不用绝对路径
- Section title 优先 ASCII（保 anchor renderer 兼容）

## 6. Migration

写本 convention 时（2026-05-16），下列 doc 已存在 inline link 形式，进入 backfill 队列：

**Stage 2 batch 1**（本 commit）：

- doc-conventions.md（本 doc，新增）
- adr-discipline.md
- prd-discipline.md
- decisions/README.md（ADR index）
- contracts/README.md（CONTRACT index）
- packages/grid-engine/README.md
- project.md（top-level PRD）
- canvas-editing.md（Day-1 PRD #1）

**Stage 2 batch 2**（下 commit）：

- ADR-0001 / 0002 / 0003 / 0007 / 0014 / 0017 / 0018（7 个 reworked ADRs）
- AUDIT-2026-05.md
- packages/grid-engine/CONTRACT.md

**未在 backfill 范围**：

- ADR-0004 / 0005 / 0006 / 0008 / 0009 / 0010 / 0011 / 0012 / 0013 / 0015 / 0016（11 个未 reworked ADRs）—— 各自走 rework round 2 时 sync 本 convention，不另起 backfill
- frozen DI docs —— 历史 immutable，不动

## Changelog

- 2026-05-16 initial draft（Stage 1 of doc-conventions; 触发 Stage 2 backfill）
