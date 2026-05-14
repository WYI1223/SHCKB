# SHCKB Documentation

Self-hostable canvas-based knowledge platform.

## 3-tier 文档结构

| Tier | 路径 | 性质 | 谁主导 |
|---|---|---|---|
| **Product** | [`product/`](./product/) | WHY + WHAT —— vision / PRD / retrospectives | Owner + product 视角 |
| **Engineering** | [`engineering/`](./engineering/) | HOW —— design discussions / ADR decisions / runbooks | Engineering + tech lead |
| **Process** | [`process/`](./process/) | HOW WE WORK —— method docs / SOP / 文档分类规则 | All contributors |

## 文档类型 + 修改规则

| 类型 | 路径 | 修改规则 |
|---|---|---|
| **PRD** (project + features) | [`product/prd/`](./product/prd/) | Living；改时更新 changelog |
| **Retrospective** | [`product/retrospectives/`](./product/retrospectives/) | 写完不改；新教训 → 新 retro doc |
| **DI doc (frozen)** | [`engineering/design/_frozen/`](./engineering/design/_frozen/) | 完全 frozen；只 owner 可 fix typo/link；historical record |
| **DI doc (living)** | [`engineering/design/`](./engineering/design/) | 持续更新；commit message 标 `living: update <name>` |
| **ADR** | [`engineering/decisions/`](./engineering/decisions/) | **Append-only**；锁定后不改；变更 → 新 ADR with `Supersedes:` |
| **Runbook** | [`engineering/runbooks/`](./engineering/runbooks/) | Living；operational guide；按需更新 |
| **Method doc** | [`process/methods/`](./process/methods/) | Living；workflow / 文档约定 |

详细修改规则见 [`process/methods/adr-discipline.md`](./process/methods/adr-discipline.md) + [`process/methods/di-doc-class.md`](./process/methods/di-doc-class.md)。

## 快速入门

新 contributor 推荐阅读顺序：

1. [`product/prd/project.md`](./product/prd/project.md) — 项目级 PRD（产品定义 + 原则 + non-goals）
2. [`engineering/design/architecture-overview.md`](./engineering/design/architecture-overview.md) — 系统架构总览
3. [`engineering/design/mental-model.md`](./engineering/design/mental-model.md) — Constrained canvas 心智
4. [`engineering/design/bootstrap-evolution.md`](./engineering/design/bootstrap-evolution.md) — M1-M4 路径
5. [`engineering/decisions/README.md`](./engineering/decisions/README.md) — ADR 索引（按需 deep-dive）

需要 trace "为什么这个决策"：
- 决策结论 + 简短 reasoning → 对应 ADR
- 完整 discussion / 怎么想出来的 → [`engineering/design/_frozen/architecture-rebuild-2026-05-11.md`](./engineering/design/_frozen/architecture-rebuild-2026-05-11.md)
- Grid 设计 → [`engineering/design/_frozen/grid-redesign-2026-05-11.md`](./engineering/design/_frozen/grid-redesign-2026-05-11.md)
