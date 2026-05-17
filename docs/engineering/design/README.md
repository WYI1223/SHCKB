# Design Documents

设计 discussions / mental models / cross-cut integration views。

## 文件分类

### Living docs（顶层 `.md`）

可持续更新；commit message 标 `living: update <name> for <reason>`。

| 文件 | 主题 | Status (Phase C 待写) |
|---|---|---|
| `mental-model.md` | Constrained canvas 心智模型；非 Notion / 非 free canvas / 非 puzzle | TODO |
| `architecture-overview.md` | 12 zone + 9 layer 系统总览；cross-cut integration view | TODO |
| `bootstrap-evolution.md` | M1-M4 演化路径；milestone-level，不绑时间 | TODO |
| `ux-design-intent.md` | 12 项 UX design intent inventory（drag handle / resize / kebab / slash / palette / 等）| TODO |

### Frozen DI docs ([`_frozen/`](./_frozen/))

Historical conversation records；**完全 frozen**；只 owner 可 fix typo / link；不删。

| 文件 | 类型 | 大小 |
|---|---|---|
| [`_frozen/grid-redesign-2026-05-11.md`](./_frozen/grid-redesign-2026-05-11.md) | Parent DI；grid-engine 心智 + 3 theme lock | ~280 lines |
| [`_frozen/architecture-rebuild-2026-05-11.md`](./_frozen/architecture-rebuild-2026-05-11.md) | 完整 architecture rebuild DI；所有决策 trace 源头 | ~1700 lines |

### Discussion records ([`discussions/`](./discussions/))

**Living** records of ongoing framing / 架构层 design discussion；记录 reviewer + owner + claude 多方讨论过程；**不**是决策本身（决策归 ADR / PRD）。

| 文件 | 主题 | Status |
|---|---|---|
| [`discussions/README.md`](./discussions/README.md) | folder 制度 + 命名约定 + 何时写 | living |
| [`discussions/auth-setup-2026-05-17.md`](./discussions/auth-setup-2026-05-17.md) | Phase E Day-1 PRD #3 authentication framing review；reviewer 10 findings + Claude 5 challenges（其中 3 条 self-withdrawn）；待 owner 拍 B3 / B4 | pending owner decisions |

## DI doc 写作规则

### Living DI

- 持续更新；改时 commit message 前缀 `living:`
- 顶部含 `Status: living` + `Last updated: YYYY-MM-DD` + `Source ADRs: ADR-XXXX`
- 不维护 changelog（git log 自身够）
- 引用 ADR + frozen DI doc 时用相对路径 markdown link

### Frozen DI

- 决策 lock + 完成 discussion 后冻结
- 顶部含 `Status: frozen <date>` + `Source ADRs derived: <list>`
- 只有 owner 能改（typo / link / 不实质改内容）
- ADR + living doc 反向 link 回 frozen doc 作为 source

## 何时新建 Living DI

- 跨 ADR 的高层 integration view（如 architecture-overview）
- 心智模型 / 范畴 reframe（如 mental-model）
- 长期规划 / roadmap（如 bootstrap-evolution）
- 跨功能 UX 原则（如 ux-design-intent）

## 何时新建 Frozen DI

- 完成一轮重大设计 discussion 后，把整个 conversation 记录冻结
- 用作"为什么 emerge 出这套决策"的 trace 源
- 不替代 ADR；ADR 是简洁决策，Frozen DI 是完整辩论

## 何时新建 Discussion record

详 [`discussions/README.md`](./discussions/README.md)。简述：
- 新 PRD / ADR initial draft 后 reviewer 给 multi-findings 时
- 跨多个 stakeholder 的 framing 决策（reviewer + owner + claude 多方）
- Multi-round review 触发的 layer / scope reframe
- 涉及多个 PRD / ADR 反向 sync 的 architectural reframe
