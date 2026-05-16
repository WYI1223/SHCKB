# Doc conventions

**Status**: living
**Last updated**: 2026-05-16

跨 ADR / PRD / Living / Method 文档共享的写作约定。第一条规则是 cross-reference 风格——采用学术 citation 模式（in-text `[bracket identifier]` citation marker + footer markdown link 集中管理）。

## 1. Cross-reference 形式 — bracketed scholarly citation

正文用 `[identifier]` 方括号 citation marker 引用其他 doc；markdown link 集中在 References / Dependencies / Related 段。理由：

- **视觉区分** —— `[ADR-0003]` 一眼可识别为 citation，跟普通词区分开
- **保留 identifier meaning** —— 方括号里是 ADR identifier / 文件名，reader 不用查表就知道引用什么（vs IEEE numeric `[1]` 必须翻 References 才知道）
- **零维护** —— 插入 / 删除 cite 不需重 number；ADR identifier 本身就是 ID
- **跨 doc 一致** —— 同 ADR 在不同 doc 都是 `[ADR-0003]`，不像 numeric 在每个 doc 含义不同
- **References 段顺序自由** —— 可按 ADR 编号 / 字母 / 相关性 / 任意逻辑排
- **集中** —— 所有外部引用一处可见（References 段），便于审计 / 维护

### In-text 形式（citation markers）

| 引用类型 | 形式 | 例 |
|---|---|---|
| ADR | `[ADR-XXXX]` | "per [ADR-0003], engine is kind-opaque" |
| Feature PRD | `[<filename>]` | "see [canvas-editing.md] for user stories" |
| Project PRD | `[<filename>]` | "per [project.md] vision" |
| Living doc | `[<filename>]` | "详 [mental-model.md]" |
| Method doc | `[<filename>]` | "遵 [doc-conventions.md] 风格" |
| Frozen DI | `[<filename>]` | "frozen DI [grid-redesign-2026-05-11.md] §3" |
| CONTRACT | `[<package> CONTRACT.md]` 或 `[CONTRACT.md]`（如上下文清晰）| "详 [grid-engine CONTRACT.md]" |
| Audit register | `[AUDIT-YYYY-MM.md]` | "AUDIT trigger 详 [AUDIT-2026-05.md]" |
| Section ref | `[<identifier>] §<section>` | "per [ADR-0003] §induction-3" |
| Code path | plain 反引号 | `packages/grid-engine/src/intent.ts:153` |
| External spec / URL | inline markdown link | "详 [MCP spec](https://modelcontextprotocol.io)" |

**不**在正文使用 markdown link 形式 `[text](path)`（除外部 URL）。反引号留给真实代码 / 文件路径（而非引用其他 doc）。

### Footer（links 集中）

每 doc 在 References / Dependencies / Related ADRs / Source DI doc 段集中 markdown link：

```markdown
## References

- [ADR-0002](./ADR-0002-substrate-db-backed.md) — DB substrate
- [ADR-0014](./ADR-0014-plugin-contract.md) — plugin contract
- [grid-engine CONTRACT.md](../../../packages/grid-engine/CONTRACT.md) — types / ops / invariants
- [grid-redesign-2026-05-11.md](../../engineering/design/_frozen/grid-redesign-2026-05-11.md) — source DI doc
```

Footer 段（References / Dependencies / Related ADRs / Source DI doc / 等任意"集中 link"位置）的每个 entry 形式：`[identifier](path) — description`。Identifier 跟正文 citation marker 一致（不带方括号包外的方括号）。

### Citation 多次出现

每次正文 mention 都用 `[identifier]` —— 学术 cite 不简化为"首次 link，后续 plain"。理由：

- 简单规则比"什么算首次"判定容易
- Reader 跳读时每次看到 cite 都立刻识别为引用
- 不依赖阅读顺序（reader 可能从中间开始读 doc）

如果同 ADR 在同段反复出现导致 noise，可重组段落（说话方式不应该需要 5 次 cite 同一 source）。

### Anti-pattern（不要这样写）

```markdown
❌ 详 [ADR-0014](./ADR-0014-plugin-contract.md) plugin contract（inline link 正文，未集中 footer）
❌ Per ADR-0003（无 citation 标记，看起来像普通词）
❌ Per `ADR-0003`（反引号 wrap identifier，应该方括号）
❌ 见 [`packages/grid-engine/CONTRACT.md`](../../../packages/grid-engine/CONTRACT.md)（反引号 + inline link 双错）
❌ 详 [1] / [2] / [3] 学术 numeric（不用；identifier 本身就有 meaning）
```

### Pattern（这样写）

```markdown
✅ 详 [ADR-0014] plugin contract（footer References 含 link）
✅ Per [ADR-0003]，engine kind-opaque
✅ 见 [grid-engine CONTRACT.md]
✅ Source DI doc 是 [grid-redesign-2026-05-11.md]（footer 含 link）
✅ Section: per [ADR-0003] §induction-3（section 名跟在外）
```

## 2. Section anchor

仅在 "确实要 reader 去看某个 specific section" 时使用，且不放在 in-text citation marker 里。In-text 形式是 `[ADR-XXXX] §section-name`（方括号 + 段名外置），不是 `[ADR-XXXX#anchor]`。

Anchor 链接的具体形式留在 References footer：

```markdown
- [ADR-0003 §induction 3](./ADR-0003-grid-engine-contract.md#induction-3---只承载-block-as-aabb--layout-invariant) — kind-opaque 决策
```

Anchor 限 ASCII 字符以保 renderer 兼容：

- ✅ GitHub markdown renderer: 中文 anchor 多数 work
- ❌ VSCode markdown preview: 中文 anchor 不可靠
- ❌ 各 wiki / docs site renderer 行为不一

实践规则：90% 时间不用 anchor —— doc-level link 已够；只在长 doc + 反复指特定段时用。

## 3. External URLs（spec / blog / standards）

保持 inline markdown link 形式（不进 footer References，除非反复引用）：

```markdown
✅ 详 [MCP spec](https://modelcontextprotocol.io/specification)
✅ Lighthouse 评分 see [web.dev](https://web.dev/performance-scoring/)
```

外部 URL 与 in-project doc 规则不同 —— 外部链接是访问性主要手段，inline 直观。

## 4. Chat output vs doc 内部

两个 surface 规则不同：

| Surface | 规则 |
|---|---|
| Doc 内部（本 convention 规定） | Bracketed scholarly cite — in-text `[identifier]` + footer link |
| Chat output to user（Claude IDE 环境） | 任何 file / code reference 用 inline markdown link 形式（IDE 规则） |

不冲突：doc 是 long-form，集中 link 便于管理；chat 是 short-form，inline link 便于即时点击。

## 5. Format details

- ADR identifier 形式：`ADR-XXXX`（4 位数字零填充，dash 分隔，无空格）
- PRD identifier 形式：filename `<name>.md`（feature PRDs 在 `features/`）
- 路径用相对路径，不用绝对路径
- Section title 优先 ASCII（保 anchor renderer 兼容）

## 6. Migration

写本 convention 时（2026-05-16）已 reworked 文档进入 batch 1 + batch 2 backfill：

**Batch 1**（同本 commit 落地）:

- [doc-conventions.md] 本身
- [adr-discipline.md] / [prd-discipline.md]
- decisions/[README.md]（ADR index）
- contracts/[README.md]
- packages/grid-engine/[README.md]
- [project.md]（top-level PRD）
- [canvas-editing.md]（Day-1 PRD #1）

**Batch 2**（下一 commit）:

- [ADR-0001] / [ADR-0002] / [ADR-0003] / [ADR-0007] / [ADR-0014] / [ADR-0017] / [ADR-0018]
- [AUDIT-2026-05.md]
- packages/grid-engine/[CONTRACT.md]

**未在 backfill 范围**:

- [ADR-0004] / [ADR-0005] / [ADR-0006] / [ADR-0008] / [ADR-0009] / [ADR-0010] / [ADR-0011] / [ADR-0012] / [ADR-0013] / [ADR-0015] / [ADR-0016]（11 个未 reworked ADRs）—— 各自走 rework round 2 时 sync 本 convention，不另起 backfill
- frozen DI docs —— 历史 immutable，不动

## References

- ADR writing method: [adr-discipline.md](./adr-discipline.md)
- PRD writing method: [prd-discipline.md](./prd-discipline.md)
- DI doc taxonomy: [di-doc-class.md](./di-doc-class.md)
- ADR index: [decisions/README.md](../../engineering/decisions/README.md)
- CONTRACT index: [contracts/README.md](../../engineering/contracts/README.md)
- Audit register: [AUDIT-2026-05.md](../../engineering/decisions/AUDIT-2026-05.md)

## Changelog

- 2026-05-16 initial draft（pass 1: in-text plain identifier + footer link）
- 2026-05-16 pass 2 (owner review): in-text 改为 `[bracketed identifier]` citation marker —— pass 1 的 plain identifier 没有视觉区分，不是真 citation；C 形式（bracketed identifier）兼具学术 cite 视觉区分 + identifier meaning 保留 + 零维护成本
